
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

export async function authMiddleware(request, response, next) {
    try {
        const autorizacao = request.headers.authorization;

        if (!autorizacao || !autorizacao.startsWith("Bearer ")) {
            return response.status(401).json({
                mensagem: "Token de autenticação não informado."
            });
        }

        const token = autorizacao.split(" ")[1];

        if (!token) {
            return response.status(401).json({
                mensagem: "Token de autenticação inválido."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET não configurado.");
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if (!Number.isInteger(Number(payload.id)) || Number(payload.id) <= 0) {
            return response.status(401).json({
                mensagem: "Token de autenticação inválido."
            });
        }

        const [contas] = await pool.execute(
            `SELECT
                id_conta,
                nome,
                email,
                perfil,
                fk_id_municipio
             FROM contas
             WHERE id_conta = ?
             LIMIT 1`,
            [Number(payload.id)]
        );

        if (contas.length === 0) {
            return response.status(401).json({
                mensagem: "Conta não encontrada."
            });
        }

        const conta = contas[0];

        request.usuario = {
            id: conta.id_conta,
            nome: conta.nome,
            email: conta.email,
            perfil: conta.perfil,
            fk_id_municipio: conta.fk_id_municipio
        };

        next();
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return response.status(401).json({
                mensagem: "Token inválido ou expirado."
            });
        }

        next(error);
    }
}
