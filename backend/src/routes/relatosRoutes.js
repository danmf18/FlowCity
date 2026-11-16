import { Router } from "express";
import { criarRelato } from "../controllers/relatosController.js";

const router = Router();

router.post("/", criarRelato);

export default router;
