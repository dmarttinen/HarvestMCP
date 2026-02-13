#!/usr/bin/env node

/**
 * Harvest MCP Server
 *
 * SECURITY NOTE: This server is designed to run exclusively over stdio transport.
 * It has NO built-in authentication or authorization layer. The security boundary
 * is provided by the parent process (e.g., Cursor, Claude Desktop) that spawns
 * this server. Do NOT expose this server over HTTP/SSE transport without first
 * adding an authentication middleware layer.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ---------------------------------------------------------------------------
// Environment & Configuration
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root (one level up from build/)
dotenv.config({ path: join(__dirname, "..", ".env") });

const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID;
const HARVEST_ACCESS_TOKEN = process.env.HARVEST_ACCESS_TOKEN;
const HARVEST_API_BASE = "https://api.harvestapp.com/v2";

// User-Agent is configurable; avoids leaking personal email addresses.
const USER_AGENT = process.env.HARVEST_USER_AGENT || "Harvest MCP Server";

// Validate required environment variables
if (!HARVEST_ACCOUNT_ID || !HARVEST_ACCESS_TOKEN) {
  console.error("Error: HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN must be set in environment or .env file");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Axios Client (with request interceptor for dynamic token resolution)
// ---------------------------------------------------------------------------

const harvestClient: AxiosInstance = axios.create({
  baseURL: HARVEST_API_BASE,
  headers: {
    "Content-Type": "application/json"
  }
});

// Resolve credentials per-request so that environment variable changes
// (e.g. token rotation) are picked up without a restart.
harvestClient.interceptors.request.use((config) => {
  const token = process.env.HARVEST_ACCESS_TOKEN;
  const accountId = process.env.HARVEST_ACCOUNT_ID;
  const userAgent = process.env.HARVEST_USER_AGENT || "Harvest MCP Server";

  config.headers["Authorization"] = `Bearer ${token}`;
  config.headers["Harvest-Account-Id"] = accountId!;
  config.headers["User-Agent"] = userAgent;
  return config;
});

// ---------------------------------------------------------------------------
// Rate Limiter (simple sliding-window for write operations)
// ---------------------------------------------------------------------------

interface RateLimiterState {
  timestamps: number[];
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_WRITES = 30;    // max write operations per window

const rateLimiter: RateLimiterState = { timestamps: [] };

function checkRateLimit(): void {
  const now = Date.now();
  // Prune timestamps outside the window
  rateLimiter.timestamps = rateLimiter.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (rateLimiter.timestamps.length >= RATE_LIMIT_MAX_WRITES) {
    throw new Error(
      `Rate limit exceeded: maximum ${RATE_LIMIT_MAX_WRITES} write operations per ${RATE_LIMIT_WINDOW_MS / 1000}s. Please wait before retrying.`
    );
  }
  rateLimiter.timestamps.push(now);
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "harvest-mcp-server",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Sanitize Harvest/Axios errors so that credentials are never leaked.
 * Axios errors can carry the full request config (including Authorization headers)
 * in error.config -- we intentionally only extract safe fields.
 */
function formatHarvestError(error: any): string {
  const status = error?.response?.status;
  const apiMessage = error?.response?.data?.message || error?.response?.data?.error;
  const message = apiMessage || error?.message || "Unknown error";

  if (status === 403) {
    return `Harvest API error (403): ${message}. This usually means your token lacks permission for that endpoint. Try using endpoints under /users/me/* (like /users/me/project_assignments), and verify HARVEST_ACCOUNT_ID matches the token's account.`;
  }

  return `Harvest API error${status ? ` (${status})` : ""}: ${message}`;
}

/**
 * Sanitize an error for top-level logging. Strips request config and headers
 * to prevent credential leakage in logs/crash reports.
 */
function sanitizeErrorForLogging(error: any): string {
  if (!error) return "Unknown error";
  // Only extract safe, non-credential fields
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (error.response?.status) parts.push(`HTTP ${error.response.status}`);
  if (error.response?.data?.message) parts.push(error.response.data.message);
  if (error.code) parts.push(`code=${error.code}`);
  return parts.join(" | ") || String(error);
}

/**
 * Fetch all project assignments with pagination support.
 * Harvest API paginates results; we follow `next_page` links to get everything.
 */
async function getMyProjectAssignments(): Promise<any[]> {
  const allAssignments: any[] = [];
  let page = 1;
  const perPage = 100; // Harvest max per_page is 2000, but 100 is safer for memory

  while (true) {
    const response = await harvestClient.get("/users/me/project_assignments", {
      params: { per_page: perPage, page }
    });

    const data = response.data;
    const assignments = data.project_assignments || [];
    allAssignments.push(...assignments);

    // If there are more pages, continue; otherwise break
    if (data.next_page) {
      page = data.next_page;
    } else {
      break;
    }
  }

  return allAssignments;
}

// ---------------------------------------------------------------------------
// Reusable Zod Schemas (tightened for security)
// ---------------------------------------------------------------------------

const ProjectIdSchema = z.number().int().positive().describe("The ID of the project");
const TaskIdSchema = z.number().int().positive().describe("The ID of the task");
const TimeEntryIdSchema = z.number().int().positive().describe("The ID of the time entry");
const SpentDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .describe("Date in YYYY-MM-DD format");
const HoursSchema = z.number().min(0).max(24).describe("Number of hours (0-24)");
const NotesSchema = z.string().max(65535).optional().describe("Notes about the time entry");

// ---------------------------------------------------------------------------
// Tool 1: List active projects
// ---------------------------------------------------------------------------

server.registerTool(
  "list_projects",
  {
    description: "List all active projects in your Harvest account",
    inputSchema: {}
  },
  async () => {
    try {
      const projectAssignments = await getMyProjectAssignments();

      const projects = projectAssignments
        .filter((pa: any) => pa.is_active)
        .map((pa: any) => ({
          id: pa.project?.id,
          name: pa.project?.name,
          code: pa.project?.code,
          client: pa.client?.name || "No client",
          is_billable: null,
          budget: pa.budget ?? null
        }))
        .filter((p: any) => typeof p.id === "number" && typeof p.name === "string");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(projects, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching projects: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 2: List project tasks
// ---------------------------------------------------------------------------

server.registerTool(
  "list_project_tasks",
  {
    description: "List all tasks for a specific project",
    inputSchema: {
      project_id: ProjectIdSchema
    }
  },
  async ({ project_id }) => {
    try {
      const projectAssignments = await getMyProjectAssignments();
      const assignment = projectAssignments.find((pa: any) => pa.project?.id === project_id);

      if (!assignment) {
        return {
          content: [
            {
              type: "text",
              text: `No project assignment found for project_id ${project_id}. If this project exists but isn't listed, you may not be assigned to it in Harvest.`
            }
          ],
          isError: true
        };
      }

      const tasks = (assignment.task_assignments || [])
        .filter((ta: any) => ta.is_active)
        .map((ta: any) => ({
          id: ta.task?.id,
          name: ta.task?.name,
          is_active: ta.is_active,
          billable: ta.billable,
          hourly_rate: ta.hourly_rate
        }))
        .filter((t: any) => typeof t.id === "number" && typeof t.name === "string");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching tasks: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 3: Log time entry
// ---------------------------------------------------------------------------

server.registerTool(
  "log_time",
  {
    description: "Log a time entry to Harvest",
    inputSchema: {
      project_id: ProjectIdSchema,
      task_id: TaskIdSchema,
      spent_date: SpentDateSchema,
      hours: HoursSchema,
      notes: NotesSchema
    }
  },
  async ({ project_id, task_id, spent_date, hours, notes }) => {
    try {
      checkRateLimit();

      const dateToLog = spent_date || formatDate(new Date());
      
      const response = await harvestClient.post("/time_entries", {
        project_id,
        task_id,
        spent_date: dateToLog,
        hours,
        notes: notes || ""
      });

      const entry = response.data;
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully logged ${entry.hours} hours to ${entry.project.name} - ${entry.task.name}\n` +
                  `Date: ${entry.spent_date}\n` +
                  `Notes: ${entry.notes || "No notes"}\n` +
                  `Entry ID: ${entry.id}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error logging time: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 4: Get today's time entries
// ---------------------------------------------------------------------------

server.registerTool(
  "get_todays_time",
  {
    description: "Get all time entries for today",
    inputSchema: {}
  },
  async () => {
    try {
      const today = formatDate(new Date());
      const response = await harvestClient.get("/time_entries", {
        params: { from: today, to: today }
      });
      
      const entries = response.data.time_entries.map((e: any) => ({
        id: e.id,
        project: e.project.name,
        task: e.task.name,
        hours: e.hours,
        notes: e.notes,
        is_running: e.is_running
      }));

      const totalHours = entries.reduce((sum: number, e: any) => sum + e.hours, 0);

      return {
        content: [
          {
            type: "text",
            text: `Today's time entries (${entries.length} total, ${totalHours.toFixed(2)} hours):\n\n` +
                  JSON.stringify(entries, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching today's time: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 5: Start timer
// ---------------------------------------------------------------------------

server.registerTool(
  "start_timer",
  {
    description: "Start a running timer for a project and task",
    inputSchema: {
      project_id: ProjectIdSchema,
      task_id: TaskIdSchema,
      notes: NotesSchema
    }
  },
  async ({ project_id, task_id, notes }) => {
    try {
      checkRateLimit();

      const response = await harvestClient.post("/time_entries", {
        project_id,
        task_id,
        spent_date: formatDate(new Date()),
        notes: notes || ""
      });

      const entry = response.data;
      
      return {
        content: [
          {
            type: "text",
            text: `Timer started for ${entry.project.name} - ${entry.task.name}\n` +
                  `Entry ID: ${entry.id}\n` +
                  `Notes: ${entry.notes || "No notes"}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error starting timer: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 6: Stop timer
// ---------------------------------------------------------------------------

server.registerTool(
  "stop_timer",
  {
    description: "Stop a running timer",
    inputSchema: {
      time_entry_id: TimeEntryIdSchema
    }
  },
  async ({ time_entry_id }) => {
    try {
      checkRateLimit();

      const response = await harvestClient.patch(`/time_entries/${time_entry_id}/stop`);
      const entry = response.data;
      
      return {
        content: [
          {
            type: "text",
            text: `Timer stopped. Logged ${entry.hours} hours to ${entry.project.name} - ${entry.task.name}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error stopping timer: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 7: Update time entry
// ---------------------------------------------------------------------------

server.registerTool(
  "update_time_entry",
  {
    description: "Update an existing time entry (hours, notes, project, task, or date)",
    inputSchema: {
      time_entry_id: TimeEntryIdSchema,
      project_id: ProjectIdSchema.optional(),
      task_id: TaskIdSchema.optional(),
      spent_date: SpentDateSchema,
      hours: HoursSchema.optional(),
      notes: NotesSchema
    }
  },
  async ({ time_entry_id, project_id, task_id, spent_date, hours, notes }) => {
    try {
      checkRateLimit();

      // Build update payload with only provided fields
      const updateData: any = {};
      if (project_id !== undefined) updateData.project_id = project_id;
      if (task_id !== undefined) updateData.task_id = task_id;
      if (spent_date !== undefined) updateData.spent_date = spent_date;
      if (hours !== undefined) updateData.hours = hours;
      if (notes !== undefined) updateData.notes = notes;

      const response = await harvestClient.patch(`/time_entries/${time_entry_id}`, updateData);
      const entry = response.data;
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated time entry ${entry.id}\n` +
                  `Project: ${entry.project.name}\n` +
                  `Task: ${entry.task.name}\n` +
                  `Hours: ${entry.hours}\n` +
                  `Date: ${entry.spent_date}\n` +
                  `Notes: ${entry.notes || "No notes"}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating time entry: ${formatHarvestError(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start the server (stdio transport only)
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Harvest MCP Server running on stdio");
}

main().catch((error) => {
  // Sanitize the error to prevent credential leakage in logs/crash reports.
  // Axios errors can contain the full request config with Authorization headers.
  console.error("Fatal error in main():", sanitizeErrorForLogging(error));
  process.exit(1);
});
