import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({
    message: "SōF XD API is running",
    version: "0.0.0",
    status: "ok",
    endpoints: {
      health: "/healthz",
      chat: "/api/chat",
      external: "/api/external"
    }
  });
});

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
