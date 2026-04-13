import { Router } from "express";

const router = Router();

// OpenAI-compatible /v1/chat/completions endpoint
router.post("/v1/chat/completions", async (req, res) => {
  const { messages, model, stream } = req.body as any;
  
  // Get Ollama configuration from environment
  const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "dolphin3:8b";
  
  try {
    // Call Ollama directly
    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages,
        stream: false
      })
    });
    
    if (!ollamaRes.ok) {
      // Fallback response when Ollama not available
      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: OLLAMA_MODEL,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "SōF XD está operativo. Configure OLLAMA_HOST y OLLAMA_MODEL en las variables de entorno del servicio para usar el LLM.\n\nEl modelo LLM requiere Ollama ejecutándose en el servidor o configurado vía variable de entorno OLLAMA_HOST apuntando a un servidor Ollama externo."
          },
          finish_reason: "stop"
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
      return;
    }
    
    const ollamaData = await ollamaRes.json();
    
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: OLLAMA_MODEL,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: ollamaData.message?.content || "Response from SōF XD"
        },
        finish_reason: "stop"
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  } catch (error: any) {
    // Return fallback on error
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model || "dolphin3:8b",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: `SōF XD operativo. Error de conexión: ${error.message}. Configure OLLAMA_HOST y OLLAMA_MODEL en las variables de entorno.`
        },
        finish_reason: "stop"
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
});

// Models list endpoint
router.get("/v1/models", async (_req, res) => {
  res.json({
    object: "list",
    data: [
      { id: "dolphin3:8b", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "local" },
      { id: "llama3.2", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "local" },
      { id: "llama3.1:8b", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "local" },
      { id: "mistral", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "local" },
      { id: "codellama", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "local" }
    ]
  });
});

// Simple external chat endpoint (alternative)
router.post("/external/chat", async (req, res) => {
  const { message, model } = req.body as any;
  
  res.json({
    id: `chat-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || "dolphin3:8b",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "SōF XD ready. Use /api/v1/chat/completions for OpenAI-compatible API."
      },
      finish_reason: "stop"
    }]
  });
});

export default router;