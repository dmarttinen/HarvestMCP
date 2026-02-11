# Harvest MCP Server

A Model Context Protocol (MCP) server that integrates with Harvest time tracking. This server allows AI assistants to interact with your Harvest account to log time, view projects, manage tasks, and track your work hours.

## Features

- 📋 List active projects and their details
- ✅ View tasks for specific projects
- ⏱️ Log time entries with notes
- 📅 View today's time entries and total hours
- ▶️ Start and stop timers
- 🐳 Docker support for easy deployment

## Prerequisites

- Node.js 20 or higher (for local development)
- Docker and Docker Compose (for containerized deployment)
- Harvest account with API access
- Harvest Personal Access Token ([Get one here](https://id.getharvest.com/developers))

## Setup

### 1. Get Your Harvest Credentials

1. Go to https://id.getharvest.com/developers
2. Create a new Personal Access Token
3. Note your Account ID and Access Token

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```
HARVEST_ACCOUNT_ID=your_account_id_here
HARVEST_ACCESS_TOKEN=your_personal_access_token_here
```

### 3. Installation Options

#### Option A: Local Development

Install dependencies and build:

```bash
npm install
npm run build
```

Run the server:

```bash
npm start
```

#### Option B: Docker Container

Build and run with Docker Compose:

```bash
docker-compose up -d
```

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

## Using with Claude Desktop

To use this MCP server with Claude Desktop, add it to your configuration file:

**macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "harvest": {
      "command": "node",
      "args": ["/absolute/path/to/harvest-mcp-server/build/index.js"],
      "env": {
        "HARVEST_ACCOUNT_ID": "your_account_id",
        "HARVEST_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

For Docker deployment:

```json
{
  "mcpServers": {
    "harvest": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "HARVEST_ACCOUNT_ID=your_account_id",
        "-e", "HARVEST_ACCESS_TOKEN=your_access_token",
        "harvest-mcp-server"
      ]
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

Make sure you've created a `.env` file with your credentials or passed them as environment variables.

### "Error fetching projects: 401"

Your access token may be invalid or expired. Generate a new one from the Harvest developers page.

### Docker container not starting

Check the logs:

```bash
docker-compose logs harvest-mcp
```

Ensure your `.env` file is in the same directory as `docker-compose.yml`.

## Security Notes

- Never commit your `.env` file or share your access token
- The access token provides full access to your Harvest account
- Consider using environment-specific tokens for different deployments
- Regularly rotate your access tokens

## API Rate Limits

Harvest API has rate limits:
- 100 requests per 15 seconds per access token
- This server includes no built-in rate limiting

## License

MIT

## Resources

- [Harvest API Documentation](https://help.getharvest.com/api-v2/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
