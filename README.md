# Harvest MCP Server

A Model Context Protocol (MCP) server that integrates with Harvest time tracking. This server allows AI assistants to interact with your Harvest account to log time, view projects, manage tasks, and track your work hours.

When combined with an Azure DevOps (ADO) MCP server and the included example skill, your AI assistant can automatically review ADO work items for effort-hours changes and log the corresponding time to Harvest.

## Features

- List active projects and their details
- View tasks for specific projects
- Log time entries with notes
- View today's time entries and total hours
- Start and stop timers
- Update existing time entries
- Docker support for easy deployment

## Prerequisites

- **Node.js 20** or higher (for local development)
- **Docker and Docker Compose** (for containerized deployment, optional)
- **Harvest account** with API access
- **Harvest Personal Access Token (PAT)** — [Get one here](https://id.getharvest.com/developers)
- **Azure DevOps (ADO) MCP server** — required if you want to use the time-logging skill that reads work items from ADO (see [ADO MCP Server](#ado-mcp-server) below)

## Quick Start — Setting Up in Cursor

### 1. Get Your Harvest Credentials

1. Go to https://id.getharvest.com/developers
2. Create a new Personal Access Token
3. Note your **Account ID** and **Access Token**

### 2. Set Environment Variables

The server expects your Harvest credentials to be available as OS-level environment variables. Set these in your system:

**Windows (PowerShell — persistent for your user):**

```powershell
[System.Environment]::SetEnvironmentVariable("Harvest_ID", "your_account_id", "User")
[System.Environment]::SetEnvironmentVariable("Harvest_Token", "your_access_token", "User")
```

**macOS / Linux (add to `~/.bashrc`, `~/.zshrc`, or equivalent):**

```bash
export Harvest_ID="your_account_id"
export Harvest_Token="your_access_token"
```

After setting them, restart your terminal (and Cursor) so the new variables are picked up.

### 3. Build the Server

Clone this repo and build:

```bash
git clone <repo-url>
cd HarvestMCP
npm install
npm run build
```

### 4. Add the MCP Server to Cursor

In your Cursor settings, open (or create) your MCP configuration file. On Windows this is typically at:

```
%USERPROFILE%\.cursor\mcp.json
```

Add the Harvest server entry. A sample is provided in [`examplemcp.json.md`](examplemcp.json.md):

```jsonc
{
  "mcpServers": {
    "harvest": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:\\path\\to\\HarvestMCP\\build\\index.js"
      ],
      "env": {
        "HARVEST_ACCOUNT_ID": "${env:Harvest_ID}",
        "HARVEST_ACCESS_TOKEN": "${env:Harvest_Token}"
      }
    }
  }
}
```

> **Important:** Update the path in `args` to the absolute path of `build/index.js` on your machine.

The `${env:...}` syntax tells Cursor to read the values from your OS environment variables at runtime. This avoids committing secrets to your config files.

### 5. (Optional) Install the Example Skill

An example Cursor agent skill is provided in [`example-skill.md`](example-skill.md). This skill teaches the AI assistant how to review ADO work items for effort-hours changes and log the corresponding time to Harvest.

To use it:

1. Copy `example-skill.md` to your Cursor skills directory (e.g. `~/.cursor/skills/log-harvest-time/SKILL.md`)
2. Adjust the skill metadata (name, description) if needed
3. The skill will then be available to your Cursor agent when you ask it to "log time", "log hours", or "submit timesheet"

> **Note:** This skill requires both the Harvest MCP server (this project) **and** an ADO MCP server to be configured in Cursor. Without the ADO MCP server, the skill cannot read work item effort-hours.

## ADO MCP Server

The example time-logging skill relies on an Azure DevOps MCP server to query work items and detect effort-hours changes. You need to have a separate ADO MCP server configured in your Cursor MCP settings alongside this Harvest server.

Your Cursor `mcp.json` should contain entries for **both** servers, for example:

```jsonc
{
  "mcpServers": {
    "harvest": {
      // ... Harvest config as shown above ...
    },
    "ado": {
      // ... your ADO MCP server config ...
    }
  }
}
```

Refer to your ADO MCP server's documentation for its specific setup instructions and required environment variables (e.g. ADO PAT, organization URL, etc.).

## Included Examples

| File | Description |
|------|-------------|
| [`examplemcp.json.md`](examplemcp.json.md) | Sample Cursor MCP JSON configuration snippet for this server |
| [`example-skill.md`](example-skill.md) | Example Cursor agent skill for logging time from ADO work items |

## Alternative Setup — VS Code

This repo also includes a `.vscode/mcp.json` for running the server as a VS Code MCP server. The same environment variable approach applies — set `Harvest_ID` and `Harvest_Token` as OS environment variables, and VS Code will inject them at runtime via the `${env:...}` syntax.

## Installation Options

### Option A: Local Development

Install dependencies and build:

```bash
npm install
npm run build
```

Run the server directly (outside of an MCP client):

```bash
npm start
```

If you run it directly, you must provide `HARVEST_ACCOUNT_ID` and `HARVEST_ACCESS_TOKEN` in your shell environment.

### Option B: Docker Container

Build and run with Docker Compose:

```bash
docker-compose up -d
```

Docker Compose reads `HARVEST_ACCOUNT_ID` / `HARVEST_ACCESS_TOKEN` from your shell environment. It will also read a `.env` file next to `docker-compose.yml` if you choose to use one.

Or build manually:

```bash
docker build -t harvest-mcp-server .
docker run -e HARVEST_ACCOUNT_ID=your_id -e HARVEST_ACCESS_TOKEN=your_token harvest-mcp-server
```

## Available Tools

The server exposes the following tools to MCP clients:

### `list_projects`
Lists all active projects in your Harvest account.

**Example:** "Show me my active projects"

### `list_project_tasks`
Lists all tasks for a specific project.

**Parameters:**
- `project_id` (number): The ID of the project

**Example:** "What tasks are available for project 12345?"

### `log_time`
Logs a time entry to Harvest.

**Parameters:**
- `project_id` (number): The ID of the project
- `task_id` (number): The ID of the task
- `hours` (number): Number of hours to log
- `spent_date` (string, optional): Date in YYYY-MM-DD format (defaults to today)
- `notes` (string, optional): Notes about the work

**Example:** "Log 2.5 hours to project 12345, task 67890 with notes 'Developed new feature'"

### `get_todays_time`
Retrieves all time entries for today with total hours.

**Example:** "How much time have I logged today?"

### `start_timer`
Starts a running timer for a project and task.

**Parameters:**
- `project_id` (number): The ID of the project
- `task_id` (number): The ID of the task
- `notes` (string, optional): Notes about what you're working on

**Example:** "Start a timer for project 12345, task 67890"

### `stop_timer`
Stops a running timer.

**Parameters:**
- `time_entry_id` (number): The ID of the time entry to stop

**Example:** "Stop timer 98765"

### `update_time_entry`
Updates an existing time entry (hours, notes, project, task, or date).

**Parameters:**
- `time_entry_id` (number): The ID of the time entry to update
- `hours` (number, optional): New number of hours
- `notes` (string, optional): Updated notes
- `project_id` (number, optional): New project ID
- `task_id` (number, optional): New task ID
- `spent_date` (string, optional): New date in YYYY-MM-DD format

**Example:** "Update time entry 98765 to 3 hours"

## Using with Claude Desktop

To use this MCP server with Claude Desktop, add it to your configuration file:

**macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "harvest": {
      "command": "node",
      "args": ["/absolute/path/to/HarvestMCP/build/index.js"],
      "env": {
        "HARVEST_ACCOUNT_ID": "your_account_id",
        "HARVEST_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

## Development

### Build

```bash
npm run build
```

### Watch mode (auto-rebuild on changes)

```bash
npm run watch
```

## Troubleshooting

### "HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN must be set"

Make sure the environment variables `Harvest_ID` and `Harvest_Token` are set at the OS level and that you have restarted Cursor / your terminal after setting them. The MCP config uses `${env:Harvest_ID}` and `${env:Harvest_Token}` to inject these at runtime.

### "Error fetching projects: 401"

Your access token may be invalid or expired. Generate a new one from the [Harvest developers page](https://id.getharvest.com/developers).

### "Error fetching projects: 403"

Harvest returns `403 Forbidden` when your token doesn't have permission for an endpoint. This server uses `/v2/users/me/project_assignments` to list projects and tasks you're assigned to, which works for normal member accounts. If you still get 403:

- Double-check `HARVEST_ACCOUNT_ID` matches the account for your token.
- Confirm the token hasn't been revoked.
- Verify you're assigned to at least one project in Harvest.

### Docker container not starting

Check the logs:

```bash
docker-compose logs harvest-mcp
```

Ensure `HARVEST_ACCOUNT_ID` / `HARVEST_ACCESS_TOKEN` are available to Docker Compose (either in your shell environment or via a `.env` file next to `docker-compose.yml`).

## Security Notes

- Never commit secrets (tokens, PATs) to git
- The Harvest access token provides full access to your Harvest account
- Consider using environment-specific tokens for different deployments
- Regularly rotate your access tokens
- The `${env:...}` syntax in MCP configs keeps secrets out of config files

## API Rate Limits

Harvest API has rate limits:
- 100 requests per 15 seconds per access token
- This server includes no built-in rate limiting

## License

MIT

## Resources

- [Harvest API Documentation](https://help.getharvest.com/api-v2/)
- [Harvest Developers — Personal Access Tokens](https://id.getharvest.com/developers)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
