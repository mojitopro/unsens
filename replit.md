# UNSENS — OpenCode Local Agent

## Overview

UNSENS es un agente de IA autónomo con herramientas de programación completas. Puede leer/escribir archivos, ejecutar código, buscar en internet y crear infraestructura compleja. Compatible con múltiples proveedores de LLM (Ollama, OpenAI, Anthropic).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: SQLite + libsql + Drizzle ORM
- **Frontend**: React + Vite + TailwindCSS
- **AI**: Ollama (local, uncensored) / OpenAI-compatible / Anthropic

## Services

- **api-server** (`/api`): Backend con todas las rutas del agente
- **ai-chat** (`/`): Interfaz de chat estilo terminal oscuro

## API Routes

- `POST /api/chat` — Chat con el agente (SSE streaming, tool calling)
- `GET /api/models` — Listar modelos disponibles en Ollama
- `POST /api/exec` — Ejecutar código/comandos bash
- `GET /api/search?q=` — Búsqueda web via Jina AI (gratis)
- `GET /api/fetch-url?url=` — Leer URLs como texto/markdown
- `GET/POST/DELETE /api/history/:id` — Historial de sesiones (JSON files)
- `GET /api/project/tree` — Árbol de archivos del workspace
- `GET /api/files` — Listar archivos del workspace
- `POST /api/files` — Escribir archivos al workspace
- `GET /api/healthz` — Health check

## Agent Tools

- `read_file` — Leer archivos del workspace
- `write_file` — Crear/modificar archivos
- `list_dir` — Explorar directorios
- `bash` — Ejecutar cualquier comando shell
- `search_files` — Buscar en código/archivos
- `web_search` — Buscar en internet (Jina AI, gratis)
- `fetch_url` — Leer documentación y URLs

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — Iniciar API server
- `pnpm --filter @workspace/ai-chat run dev` — Iniciar frontend
- `pnpm install --no-frozen-lockfile` — Instalar dependencias

## Deployment (Render)

Ver `render.yaml` en la raíz. Configura dos servicios:
1. `unsens-api` — Web service Node.js
2. `unsens-chat` — Static site React

Variables de entorno requeridas en Render:
- `OLLAMA_HOST` — URL del servidor Ollama (ej: `https://your-ollama.com`)
- O `OPENAI_API_KEY` + `OPENAI_BASE_URL` para API compatible
- O `ANTHROPIC_API_KEY` para Claude

## LLM Providers (gratis, sin censura)

```bash
# Option A: Ollama local (recomendado)
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_MODEL=dolphin3:8b  # uncensored

# Option B: API compatible (e.g., together.ai gratis, groq gratis)
export OPENAI_API_KEY=your-key
export OPENAI_BASE_URL=https://api.together.xyz/v1

# Option C: ofox.ai proxy
export OPENAI_API_KEY=your-ofoxai-key
export OPENAI_BASE_URL=https://api.ofox.ai/v1
```
