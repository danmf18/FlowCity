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

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [usuarios] = await pool.execute(
            `SELECT
                id_conta,
                nome,
                email,
                perfil,
                fk_id_municipio
             FROM contas
             WHERE id_conta = ?`,
            [decoded.id]
        );

        if (usuarios.length === 0) {
            return response.status(401).json({
                mensagem: "Usuário não encontrado."
            });
        }

        request.usuario = {
            id: usuarios[0].id_conta,
            nome: usuarios[0].nome,
            email: usuarios[0].email,
            perfil: usuarios[0].perfil,
            fk_id_municipio: usuarios[0].fk_id_municipio
        };

        next();

    } catch (error) {
        if (error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError") {
            return response.status(401).json({
                mensagem: "Token inválido ou expirado."
            });
        }

        next(error);
    }
}