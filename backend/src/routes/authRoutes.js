import express from "express";

import {
    realizarLogin,
    cadastrarUsuario
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", realizarLogin);
router.post("/registrar", cadastrarUsuario);

export default router;