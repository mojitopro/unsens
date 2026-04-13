# SōF XD - Uncensored AI API
# Dockerfile para desplegar en Render con Ollama integrado

FROM node:20-alpine AS base

# Install Ollama
RUN apk add --no-cache curl ca-certificates

# Download and install Ollama
RUN curl -fsSL https://ollama.ai/install.sh | sh

ENV PATH=$PATH:/root/.local/bin
ENV OLLAMA_HOST=0.0.0.0:11434

FROM base AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Build only api-server
WORKDIR /app/artifacts/api-server
RUN pnpm install --frozen-lockfile

# Build TypeScript
RUN pnpm run build

# Final stage
FROM base

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/package.json ./package.json
COPY --from=builder /app/artifacts/api-server/node_modules ./node_modules

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV OLLAMA_MODEL=dolphin3:8b

EXPOSE 3000 11434

# Start Ollama server in background and then the API
CMD sh -c "ollama serve & \
    ollama pull dolphin3:8b || true && \
    node dist/index.js"
