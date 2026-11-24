import { Router } from "express";

import {
    obterDashboard,
    listarUsuarios,
    criarUsuario,
    listarMunicipios,
    listarRelatos,
    listarRelatosMapa,
    obterConfiguracoesConta,
    atualizarDadosConta,
    alterarSenhaConta,
    aprovarRelato,
    rejeitarRelato
} from "../controllers/adminGeralController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/checkRole.js";

const router = Router();

router.use(authMiddleware, checkRole("admin_geral"));

router.get("/dashboard", obterDashboard);

router.get("/usuarios", listarUsuarios);
router.post("/usuarios", criarUsuario);
router.get("/municipios", listarMunicipios);

router.get("/relatos", listarRelatos);
router.get("/relatos/mapa", listarRelatosMapa);

router.get("/configuracoes", obterConfiguracoesConta);

router.put("/configuracoes/dados", atualizarDadosConta);

router.put("/configuracoes/senha", alterarSenhaConta);
router.put("/relatos/:id/aprovar", aprovarRelato);
router.put("/relatos/:id/rejeitar", rejeitarRelato);

export default router;