import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

export async function authMiddleware(request, response, next) {
    try {
        const authorization = request.headers.authorization;

        if (!authorization || !authorization.startsWith("Bearer ")) {
            return response.status(401).json({
                mensagem: "Token de autenticação não informado."
            });
        }

        const token = authorization.split(" ")[1];

        if (!token) {
            return response.status(401).json({
                mensagem: "Token de autenticação não informado."
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const contaId = Number(
            decoded.id_conta ?? decoded.id
        );

        if (!Number.isInteger(contaId) || contaId <= 0) {
            return response.status(401).json({
                mensagem: "Token inválido."
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
            [contaId]
        );

        if (contas.length === 0) {
            return response.status(401).json({
                mensagem: "Conta não encontrada."
            });
        }

        const conta = contas[0];

        request.usuario = {
            id: conta.id_conta,
            id_conta: conta.id_conta,
            nome: conta.nome,
            email: conta.email,
            perfil: conta.perfil,
            fk_id_municipio: conta.fk_id_municipio
        };

        // Compatibilidade com controllers que utilizam request.user.
        request.user = {
            ...request.usuario
        };

        next();

    } catch (erro) {
        if (
            erro.name === "JsonWebTokenError" ||
            erro.name === "TokenExpiredError"
        ) {
            return response.status(401).json({
                mensagem: "Token inválido ou expirado."
            });
        }

        next(erro);
    }
}