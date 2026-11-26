import express from "express";
import { getFiltros, getResumoDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/filtros", getFiltros);
router.get("/resumo", getResumoDashboard);

export default router;

// a