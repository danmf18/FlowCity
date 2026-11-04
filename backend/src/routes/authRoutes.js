
import { Router } from "express";

import { realizarLogin } from "../controllers/authController.js";

const router = Router();

router.post("/login", realizarLogin);

export default router;
