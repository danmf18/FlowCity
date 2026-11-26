
import { Router } from "express";

import {
    listarRelatosPublicos,
    listarDadosOficiaisMapa
} from "../controllers/relatosPublicosController.js";

const router = Router();

router.get("/", listarRelatosPublicos);

router.get("/oficiais/mapa", listarDadosOficiaisMapa);

export default router;
