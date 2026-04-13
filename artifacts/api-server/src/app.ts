import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SōF XD - UNSENS</title>
      <style>
        body { font-family: system-ui; background: #0a0a0a; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { text-align: center; }
        h1 { font-size: 3rem; margin-bottom: 0.5rem; }
        p { color: #888; }
        .status { color: #0f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>SōF XD</h1>
        <p>UNSENS Engine Running</p>
        <p class="status">● Online</p>
        <p><a href="/api/healthz" style="color: #444;">API</a></p>
      </div>
    </body>
    </html>
  `);
});

app.use("/api", router);

export default app;
