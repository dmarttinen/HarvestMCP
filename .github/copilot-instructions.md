# Harvest MCP Server Project

## Project Overview
MCP (Model Context Protocol) server for Harvest time tracking integration with Docker support.

This server allows AI assistants to interact with Harvest time tracking API to:
- List active projects and tasks
- Log time entries  
- Start/stop timers
- View daily time logs

## Project Structure
```
harvest-mcp/
├── src/
│   └── index.ts        # Main MCP server implementation
├── build/              # Compiled JavaScript output
├── .github/
│   └── copilot-instructions.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Completed Steps
- [x] Create copilot-instructions.md file
- [x] Scaffold MCP server project structure
- [x] Customize for Harvest API integration (6 tools implemented)
- [x] Add Docker support
- [x] Install dependencies and compile
- [x] Update documentation

## Tools Implemented
1. `list_projects` - List all active projects
2. `list_project_tasks` - List tasks for a project
3. `log_time` - Log time entries
4. `get_todays_time` - View today's time entries
5. `start_timer` - Start a running timer
6. `stop_timer` - Stop a running timer

## Setup Instructions
1. Copy `.env.example` to `.env` and add your Harvest credentials
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile TypeScript
4. Run `npm start` to start the server locally
5. Or use `docker-compose up` to run in a container

## Configuration
See README.md for detailed setup and usage instructions.
