import express from "express";
import cors from "cors";
import { healthRouter } from "../api/routes/health.routes.js";
import { authRouter } from "../api/routes/auth.routes.js";
import { tokenRouter } from "../api/routes/token.routes.js";

export function createExpressApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use('/', healthRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/token', tokenRouter);

    return app;
}