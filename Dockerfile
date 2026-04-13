# SōF XD - Uncensored AI API
# Dockerfile para desplegar en Render con Ollama integrado

FROM node:20-alpine

RUN apk add --no-cache curl ca-certificates

RUN curl -fsSL https://ollama.ai/install.sh | sh

ENV PATH=$PATH:/root/.local/bin
ENV OLLAMA_HOST=http://localhost:11434

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

COPY artifacts ./artifacts

WORKDIR /app/artifacts/api-server
RUN pnpm run build || true

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD sh -c "ollama serve & \
    sleep 5 && \
    ollama pull dolphin3:8b 2>/dev/null || true && \
    node dist/index.js"
