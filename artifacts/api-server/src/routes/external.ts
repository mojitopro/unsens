import { Router } from "express";

const router = Router();

// OpenAI-compatible /v1/chat/completions endpoint
router.post("/v1/chat/completions", async (req, res) => {
  const { messages, model, stream } = req.body as any;
  
  try {
    // Forward to internal chat with appropriate format
    const chatRes = await fetch("http://localhost:10000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model })
    });
    
    const chatData = await chatRes.json();
    
    // Return OpenAI-compatible response
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model || "dolphin3:8b",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: chatData.content || chatData.message?.content || "SōF XD response"
        },
        finish_reason: "stop"
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: {
        message: error.message,
        type: "internal_error",
        code: 500
      }
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