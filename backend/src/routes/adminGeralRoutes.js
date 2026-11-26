import { Router } from "express";

import {
    obterDashboard,
    listarUsuarios,
    criarUsuario,
    atualizarUsuario,
    listarMunicipios,
    listarRelatos,
    listarRelatosMapa,
    obterConfiguracoesConta,
    atualizarDadosConta,
    alterarSenhaConta,
    aprovarRelato,
    rejeitarRelato
} from "../controllers/adminGeralController.js";

import importacoesRoutes from "./importacoesRoutes.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/checkRole.js";

const router = Router();

router.use(authMiddleware, checkRole("admin_geral"));

router.get("/dashboard", obterDashboard);
router.get("/usuarios", listarUsuarios);
router.post("/usuarios", criarUsuario);
router.put("/usuarios/:id", atualizarUsuario);
router.get("/municipios", listarMunicipios);

router.get("/relatos", listarRelatos);
router.get("/relatos/mapa", listarRelatosMapa);

router.get("/configuracoes", obterConfiguracoesConta);
router.put("/configuracoes/dados", atualizarDadosConta);
router.put("/configuracoes/senha", alterarSenhaConta);

router.put("/relatos/:id/aprovar", aprovarRelato);
router.put("/relatos/:id/rejeitar", rejeitarRelato);

// Importações oficiais — protegidas pelo middleware acima
router.use("/importacoes", importacoesRoutes);

export default router;