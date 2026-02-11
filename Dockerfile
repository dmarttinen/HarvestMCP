FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the TypeScript code
RUN npm run build

# Set environment variables (will be overridden by docker-compose or runtime)
ENV HARVEST_ACCOUNT_ID=""
ENV HARVEST_ACCESS_TOKEN=""

# Run the MCP server
CMD ["node", "build/index.js"]
