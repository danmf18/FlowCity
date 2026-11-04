import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

export async function realizarLogin(request, response, next) {
    try {
        const { email, senha } = request.body;

        if (!email || !senha) {
            return response.status(400).json({
                mensagem: "Informe o e-mail e a senha."
            });
        }

        const [contas] = await pool.execute(
            `SELECT id_conta, nome, email, senha_hash, perfil, fk_id_municipio
             FROM contas
             WHERE email = ?
             LIMIT 1`,
            [email.trim()]
        );

        if (contas.length === 0) {
            return response.status(401).json({
                mensagem: "E-mail ou senha inválidos."
            });
        }

        const usuario = contas[0];

        const senhaValida = await bcrypt.compare(
            senha,
            usuario.senha_hash
        );

        if (!senhaValida) {
            return response.status(401).json({
                mensagem: "E-mail ou senha inválidos."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET não configurado.");
        }

        const token = jwt.sign(
            {
                id: usuario.id_conta,
                perfil: usuario.perfil
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        return response.status(200).json({
            mensagem: "Login realizado com sucesso!",
            token,
            usuario: {
                id: usuario.id_conta,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
                fk_id_municipio: usuario.fk_id_municipio
            }
        });

    } catch (error) {
        next(error);
    }
}