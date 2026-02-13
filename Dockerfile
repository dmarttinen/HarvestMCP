FROM node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8

WORKDIR /app

# Create a non-root user for runtime security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (--ignore-scripts prevents post-install script attacks)
RUN npm ci --ignore-scripts

# Copy source code
COPY src ./src

# Build the TypeScript code
RUN npm run build

# Change ownership of app files to the non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Secrets are passed at runtime via docker-compose or -e flags.
# Do NOT bake them into the image with ENV declarations.

# Run the MCP server
CMD ["node", "build/index.js"]
