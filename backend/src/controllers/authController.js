
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

// ==========================================
// LOGIN DE USUÁRIO
// ==========================================

export async function realizarLogin(request, response, next) {
    try {
        const { email, senha } = request.body;

        if (!email || !senha) {
            return response.status(400).json({
                mensagem: "Informe o e-mail e a senha."
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const [contas] = await pool.execute(
            `SELECT id_conta, nome, email, senha_hash, perfil, fk_id_municipio
             FROM contas
             WHERE email = ?
             LIMIT 1`,
            [emailNormalizado]
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


// ==========================================
// CADASTRO DE USUÁRIO
// ==========================================

export async function cadastrarUsuario(request, response) {
    try {
        const { nome, email, senha, confirmarSenha } = request.body;

        // Validar preenchimento
        if (
            typeof nome !== "string" ||
            typeof email !== "string" ||
            typeof senha !== "string" ||
            typeof confirmarSenha !== "string" ||
            !nome.trim() ||
            !email.trim() ||
            !senha ||
            !confirmarSenha
        ) {
            return response.status(400).json({
                mensagem: "Preencha todos os campos."
            });
        }

        // Validar nome
        if (nome.trim().length < 3) {
            return response.status(400).json({
                mensagem: "Informe seu nome completo."
            });
        }

        // Normalizar e validar e-mail
        const emailNormalizado = email.trim().toLowerCase();

        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formatoEmail.test(emailNormalizado)) {
            return response.status(400).json({
                mensagem: "Informe um e-mail válido."
            });
        }

        // Validar senha
        if (senha.length < 8) {
            return response.status(400).json({
                mensagem: "A senha deve ter pelo menos 8 caracteres."
            });
        }

        // Confirmar senha
        if (senha !== confirmarSenha) {
            return response.status(400).json({
                mensagem: "As senhas não coincidem."
            });
        }

        // Verificar se o e-mail já existe
        const [contaExistente] = await pool.execute(
            `SELECT id_conta
             FROM contas
             WHERE email = ?
             LIMIT 1`,
            [emailNormalizado]
        );

        if (contaExistente.length > 0) {
            return response.status(409).json({
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        // Criptografar senha
        const senhaHash = await bcrypt.hash(senha, 10);

        // Inserir usuário no banco
        const [resultado] = await pool.execute(
            `INSERT INTO contas
             (nome, email, senha_hash, perfil, fk_id_municipio)
             VALUES (?, ?, ?, ?, ?)`,
            [
                nome.trim(),
                emailNormalizado,
                senhaHash,
                "cidadao",
                null
            ]
        );

        return response.status(201).json({
            sucesso: true,
            mensagem: "Conta criada com sucesso!",

            usuario: {
                id_conta: resultado.insertId,
                nome: nome.trim(),
                email: emailNormalizado,
                perfil: "cidadao"
            }
        });

    } catch (error) {
        console.error("Erro ao cadastrar usuário:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return response.status(409).json({
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        return response.status(500).json({
            mensagem: "Erro interno ao realizar cadastro."
        });
    }
}
