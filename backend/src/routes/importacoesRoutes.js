import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import {
  obterMetadados,
  listarImportacoes,
  obterImportacaoPorId,
  criarImportacao,
  atualizarImportacao,
  excluirImportacao,
  restaurarImportacao,
  excluirPermanentemente,
  baixarArquivoImportacao,
  obterItensImportacaoHandler,
  confirmarImportacaoHandler,
  cancelarImportacaoHandler,
} from "../controllers/importacoesController.js";

const router = express.Router();

const PASTA_UPLOADS = path.resolve(process.cwd(), "uploads", "importacoes");
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PASTA_UPLOADS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".xlsx";
    const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unico);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const valido = file.originalname.toLowerCase().endsWith(".xlsx");
    if (!valido) {
      return cb(new Error("Apenas planilhas .xlsx são permitidas."));
    }
    cb(null, true);
  },
});

const semTimeout = (req, res, next) => {
  req.setTimeout(0);
  res.setTimeout(0);
  next();
};

router.get("/:id/itens", obterItensImportacaoHandler);
router.post("/:id/confirmar", semTimeout, confirmarImportacaoHandler);
router.post("/:id/cancelar", cancelarImportacaoHandler);
router.get("/meta", obterMetadados);
router.get("/", listarImportacoes);
router.get("/:id/arquivo", baixarArquivoImportacao);
router.post("/:id/restaurar", semTimeout, restaurarImportacao);
router.delete("/:id/permanente", semTimeout, excluirPermanentemente);
router.get("/:id", obterImportacaoPorId);
router.post("/", semTimeout, upload.single("arquivo"), criarImportacao);
router.put("/:id", atualizarImportacao);
router.delete("/:id", semTimeout, excluirImportacao);


export default router;