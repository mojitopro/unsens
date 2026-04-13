# UNSENS — OpenCode Local Agent

## Overview

Agente de IA autónomo para programación. Lee/escribe archivos, ejecuta bash, busca en internet sin APIs de pago, crea proyectos completos. 100% libre y sin límites con Ollama.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **API**: Express 5 + tsx
- **DB**: SQLite + libsql (sin PostgreSQL, sin configuración)
- **Frontend**: React + Vite + TailwindCSS
- **LLM**: Ollama (local, gratis, sin límites) / OpenAI-compatible / Anthropic

## Servicios

- `api-server` — Backend Express en puerto 8080
- `ai-chat` — Frontend React en puerto 25374

## Rutas API

| Ruta | Descripción |
|------|-------------|
| `POST /api/chat` | Agente con SSE streaming y tool calling |
| `GET /api/models` | Listar proveedores y modelos disponibles |
| `GET /api/search?q=` | Búsqueda web (SearXNG + DuckDuckGo, sin API key) |
| `GET /api/fetch-url?url=` | Leer URL directo (sin servicio externo) |
| `POST /api/exec` | Ejecutar comandos bash |
| `GET/POST/DELETE /api/history/:id` | Historial de sesiones |
| `GET /api/project/tree` | Árbol de archivos del workspace |
| `GET /api/healthz` | Health check |

## Herramientas del Agente

Todas libres y sin límites:
- `read_file` / `write_file` — Leer/escribir archivos en el workspace
- `list_dir` — Explorar directorios
- `bash` — Cualquier comando shell (git, npm, pip, curl...)
- `search_files` — Buscar en código con grep/find
- `web_search` — **SearXNG + DuckDuckGo** (sin API key, sin límites, sin costos)
- `fetch_url` — **Fetch directo** a cualquier URL (sin servicio externo)

## Búsqueda Web — Implementación Libre

`web_search` usa en orden de preferencia:
1. **SearXNG** — motor de búsqueda open source, instancias públicas gratuitas, API JSON, sin clave
2. **DuckDuckGo Lite HTML** — scraper del HTML de DDG, sin clave, sin límites
3. Sin fallback externo — completamente autónomo

`fetch_url` hace fetch directo HTTP con User-Agent de Firefox — sin Jina, sin ningún proxy externo.

## Proveedores LLM

### Recomendado: Ollama (100% libre, sin límites)
```bash
ollama pull dolphin3:8b   # sin censura, para dev
ollama pull llama3.2      # general purpose
ollama pull deepseek-r1   # razonamiento
ollama pull mistral       # rápido y eficiente
ollama pull codestral     # especializado en código
```

### Alternativas OpenAI-compatible (auto-hosted = sin límites)
```bash
# LocalAI (auto-hosted, sin límites)
OPENAI_BASE_URL=http://tu-servidor:8080
OPENAI_API_KEY=none

# LM Studio (escritorio, sin límites)
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio

# vLLM (servidor GPU, sin límites)
OPENAI_BASE_URL=http://tu-gpu-server:8000/v1
OPENAI_API_KEY=none
```

### APIs con capa gratuita (tienen límites mensuales)
```bash
# Groq (rápido, ~14,400 req/día gratis)
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_...

# Together.ai ($1 crédito gratis)
OPENAI_BASE_URL=https://api.together.xyz/v1
OPENAI_API_KEY=...
```

## Despliegue en Render

Ver `render.yaml` en la raíz. Solo necesitas:
1. Subir el código a GitHub
2. Crear un nuevo Blueprint en render.com desde el `render.yaml`
3. Configurar `OLLAMA_HOST` (o una API compatible)
4. Deploy — el frontend se construye automáticamente como static site

No necesita PostgreSQL, no necesita Redis, no necesita ningún servicio externo de pago.

## Comandos útiles

```bash
pnpm --filter @workspace/api-server run dev  # API server
pnpm --filter @workspace/ai-chat run dev     # Frontend
pnpm install --no-frozen-lockfile             # Instalar deps
```
