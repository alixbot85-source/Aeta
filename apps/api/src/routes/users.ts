import { Router } from "express";
import { ok } from "@aeta/shared";
import { requireAuth } from "../middleware/request.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get("/me", (req, res) => res.json(ok({ user: req.user })));
