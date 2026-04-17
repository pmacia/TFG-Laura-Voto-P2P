import express from "express";
import cors from "cors";
import { healthRouter } from "../api/routes/health.routes.js";

export function createExpressApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use('/', healthRouter);

    return app;
}