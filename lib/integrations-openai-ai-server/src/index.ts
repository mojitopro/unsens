import { Ollama } from "ollama";
import OpenAI from "openai";

// ── Ollama client ─────────────────────────────────────────────────────────────
const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";

let _ollama: Ollama | null = null;

export function getOllama(): Ollama {
  if (!_ollama) {
    _ollama = new Ollama({ host: ollamaHost });
  }
  return _ollama;
}

export const ollama = new Proxy({} as Ollama, {
  get(_target, prop) {
    return (...args: any[]) => (getOllama() as any)[prop](...args);
  },
});

// ── OpenAI-compatible client ──────────────────────────────────────────────────
export function getOpenAI(apiKey?: string, baseURL?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY || "dummy",
    baseURL: baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
}

export const openai = getOpenAI();
