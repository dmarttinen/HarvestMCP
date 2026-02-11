#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root (one level up from build/)
dotenv.config({ path: join(__dirname, "..", ".env") });

const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID;
const HARVEST_ACCESS_TOKEN = process.env.HARVEST_ACCESS_TOKEN;
const HARVEST_API_BASE = "https://api.harvestapp.com/v2";
const USER_AGENT = "Harvest MCP Server (dale@example.com)";

// Validate environment variables
if (!HARVEST_ACCOUNT_ID || !HARVEST_ACCESS_TOKEN) {
  console.error("Error: HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN must be set in environment or .env file");
  process.exit(1);
}

// Create Harvest API client
const harvestClient: AxiosInstance = axios.create({
  baseURL: HARVEST_API_BASE,
  headers: {
    "User-Agent": USER_AGENT,
    "Authorization": `Bearer ${HARVEST_ACCESS_TOKEN}`,
    "Harvest-Account-ID": HARVEST_ACCOUNT_ID,
    "Content-Type": "application/json"
  }
});

// Create MCP server instance
const server = new McpServer({
  name: "harvest-mcp-server",
  version: "1.0.0",
});

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Tool 1: List active projects
server.registerTool(
  "list_projects",
  {
    description: "List all active projects in your Harvest account",
    inputSchema: {}
  },
  async () => {
    try {
      const response = await harvestClient.get("/projects", {
        params: { is_active: true }
      });
      
      const projects = response.data.projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        client: p.client?.name || "No client",
        is_billable: p.is_billable,
        budget: p.budget
      }));

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
            text: `Error fetching projects: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 2: List project tasks
server.registerTool(
  "list_project_tasks",
  {
    description: "List all tasks for a specific project",
    inputSchema: {
      project_id: z.number().describe("The ID of the project")
    }
  },
  async ({ project_id }) => {
    try {
      const response = await harvestClient.get(`/projects/${project_id}/task_assignments`, {
        params: { is_active: true }
      });
      
      const tasks = response.data.task_assignments.map((ta: any) => ({
        id: ta.task.id,
        name: ta.task.name,
        is_active: ta.is_active,
        billable: ta.billable,
        hourly_rate: ta.hourly_rate
      }));

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
            text: `Error fetching tasks: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 3: Log time entry
server.registerTool(
  "log_time",
  {
    description: "Log a time entry to Harvest",
    inputSchema: {
      project_id: z.number().describe("The ID of the project"),
      task_id: z.number().describe("The ID of the task"),
      spent_date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      hours: z.number().describe("Number of hours to log"),
      notes: z.string().optional().describe("Notes about the time entry")
    }
  },
  async ({ project_id, task_id, spent_date, hours, notes }) => {
    try {
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
            text: `Error logging time: ${error.response?.data?.message || error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 4: Get today's time entries
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
            text: `Error fetching today's time: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 5: Start timer
server.registerTool(
  "start_timer",
  {
    description: "Start a running timer for a project and task",
    inputSchema: {
      project_id: z.number().describe("The ID of the project"),
      task_id: z.number().describe("The ID of the task"),
      notes: z.string().optional().describe("Notes about what you're working on")
    }
  },
  async ({ project_id, task_id, notes }) => {
    try {
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
            text: `Error starting timer: ${error.response?.data?.message || error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 6: Stop timer
server.registerTool(
  "stop_timer",
  {
    description: "Stop a running timer",
    inputSchema: {
      time_entry_id: z.number().describe("The ID of the time entry to stop")
    }
  },
  async ({ time_entry_id }) => {
    try {
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
            text: `Error stopping timer: ${error.response?.data?.message || error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 7: Update time entry
server.registerTool(
  "update_time_entry",
  {
    description: "Update an existing time entry (hours, notes, project, task, or date)",
    inputSchema: {
      time_entry_id: z.number().describe("The ID of the time entry to update"),
      project_id: z.number().optional().describe("The ID of the project"),
      task_id: z.number().optional().describe("The ID of the task"),
      spent_date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      hours: z.number().optional().describe("Number of hours"),
      notes: z.string().optional().describe("Notes about the time entry")
    }
  },
  async ({ time_entry_id, project_id, task_id, spent_date, hours, notes }) => {
    try {
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
            text: `Error updating time entry: ${error.response?.data?.message || error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Harvest MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
