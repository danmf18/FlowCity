import express from "express";

import {
    realizarLogin,
    cadastrarUsuario
} from "../controllers/authController.js";

import {
    realizarLogin,
    registrarUsuario,
    listarMunicipios
} from "../controllers/authController.js";

const router = Router();

router.post("/login", realizarLogin);

router.post("/registrar", registrarUsuario);

router.get("/municipios", listarMunicipios);

export default router;