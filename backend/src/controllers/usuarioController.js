
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";

// CONSULTAR PERFIL DO CIDADÃO
export async function obterMeuPerfil(request, response, next) {
    try {
        const [usuarios] = await pool.execute(
            `SELECT
                id_conta,
                nome,
                email,
                perfil
             FROM contas
             WHERE id_conta = ?
             LIMIT 1`,
            [request.usuario.id]
        );

        if (usuarios.length === 0) {
            return response.status(404).json({
                mensagem: "Usuário não encontrado."
            });
        }

        return response.status(200).json({
            usuario: usuarios[0]
        });

    } catch (error) {
        next(error);
    }
}

// ATUALIZAR PERFIL DO CIDADÃO
export async function atualizarMeuPerfil(request, response, next) {
    try {
        const { nome, email } = request.body;

        if (!nome || !email) {
            return response.status(400).json({
                mensagem: "Informe o nome e o e-mail."
            });
        }

        const nomeLimpo = nome.trim();
        const emailLimpo = email.trim().toLowerCase();

        if (nomeLimpo.length < 3) {
            return response.status(400).json({
                mensagem: "O nome deve possuir pelo menos 3 caracteres."
            });
        }

        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formatoEmail.test(emailLimpo)) {
            return response.status(400).json({
                mensagem: "Informe um e-mail válido."
            });
        }

        const [emailExistente] = await pool.execute(
            `SELECT id_conta
             FROM contas
             WHERE email = ?
               AND id_conta <> ?
             LIMIT 1`,
            [emailLimpo, request.usuario.id]
        );

        if (emailExistente.length > 0) {
            return response.status(409).json({
                mensagem: "Este e-mail já está sendo utilizado."
            });
        }

        await pool.execute(
            `UPDATE contas
             SET nome = ?, email = ?
             WHERE id_conta = ?`,
            [nomeLimpo, emailLimpo, request.usuario.id]
        );

        return response.status(200).json({
            mensagem: "Perfil atualizado com sucesso.",
            usuario: {
                id_conta: request.usuario.id,
                nome: nomeLimpo,
                email: emailLimpo,
                perfil: request.usuario.perfil
            }
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return response.status(409).json({
                mensagem: "Este e-mail já está sendo utilizado."
            });
        }

        next(error);
    }
}

// ALTERAR SENHA DO CIDADÃO
export async function alterarMinhaSenha(request, response, next) {
    try {
        const {
            senhaAtual,
            novaSenha,
            confirmarSenha
        } = request.body;

        if (!senhaAtual || !novaSenha || !confirmarSenha) {
            return response.status(400).json({
                mensagem: "Preencha todos os campos de senha."
            });
        }

        if (novaSenha.length < 8) {
            return response.status(400).json({
                mensagem: "A nova senha deve possuir pelo menos 8 caracteres."
            });
        }

        if (novaSenha !== confirmarSenha) {
            return response.status(400).json({
                mensagem: "A confirmação da nova senha não corresponde."
            });
        }

        const [usuarios] = await pool.execute(
            `SELECT senha_hash
             FROM contas
             WHERE id_conta = ?
             LIMIT 1`,
            [request.usuario.id]
        );

        if (usuarios.length === 0) {
            return response.status(404).json({
                mensagem: "Usuário não encontrado."
            });
        }

        const senhaValida = await bcrypt.compare(
            senhaAtual,
            usuarios[0].senha_hash
        );

        if (!senhaValida) {
            return response.status(401).json({
                mensagem: "A senha atual está incorreta."
            });
        }

        const novoHash = await bcrypt.hash(novaSenha, 12);

        await pool.execute(
            `UPDATE contas
             SET senha_hash = ?
             WHERE id_conta = ?`,
            [novoHash, request.usuario.id]
        );

        return response.status(200).json({
            mensagem: "Senha alterada com sucesso."
        });

    } catch (error) {
        next(error);
    }
}

// LISTAR RELATOS DO CIDADÃO
export async function listarMeusRelatos(request, response, next) {
    try {
        const idConta = request.usuario.id;

        const [relatos] = await pool.query(
            `SELECT
                r.id_relato,
                r.descricao,
                r.data_fato,
                r.enviado_em,
                r.referencia_local,
                r.situacao,
                c.nome AS categoria
            FROM relatos r
            INNER JOIN categorias c
                ON c.id_categoria = r.fk_id_categoria
            WHERE r.fk_id_conta_autor = ?
            ORDER BY r.enviado_em DESC`,
            [idConta]
        );

        return response.status(200).json({
            mensagem: "Relatos consultados com sucesso.",
            relatos
        });

    } catch (erro) {
        next(erro);
    }
}

// CRIAR RELATO DO CIDADÃO
export async function criarMeuRelato(request, response, next) {
    try {
        const {
            categoria,
            municipio,
            data,
            hora,
            latitude,
            longitude,
            referencia,
            descricao
        } = request.body;

        const descricaoLimpa =
            typeof descricao === "string" ? descricao.trim() : "";

        const referenciaLimpa =
            typeof referencia === "string" ? referencia.trim() : "";

        const latitudeNumero = Number(latitude);
        const longitudeNumero = Number(longitude);

        if (
            typeof categoria !== "string" ||
            typeof municipio !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data || "") ||
            !descricaoLimpa ||
            descricaoLimpa.length > 2000 ||
            referenciaLimpa.length > 255 ||
            !Number.isFinite(latitudeNumero) ||
            latitudeNumero < -90 || latitudeNumero > 90 ||
            !Number.isFinite(longitudeNumero) ||
            longitudeNumero < -180 || longitudeNumero > 180 ||
            (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
        ) {
            return response.status(400).json({
                mensagem: "Confira os campos obrigatórios e as coordenadas do relato."
            });
        }

        const dataValida = new Date(`${data}T00:00:00.000Z`);

        if (
            Number.isNaN(dataValida.getTime()) ||
            dataValida.toISOString().slice(0, 10) !== data
        ) {
            return response.status(400).json({
                mensagem: "Informe uma data válida para a ocorrência."
            });
        }

        // DIAGNÓSTICO DA CATEGORIA
        console.log(
            "CATEGORIA RECEBIDA:",
            JSON.stringify(categoria)
        );

        const [categoriasBanco] = await pool.execute(
            `SELECT
                id_categoria,
                nome,
                ativa,
                HEX(nome) AS hexadecimal
             FROM categorias
             WHERE nome = ?
             LIMIT 1`,
            [categoria.trim()]
        );

        console.log(
            "CATEGORIA ENCONTRADA:",
            categoriasBanco
        );

        const categoriaEncontrada = categoriasBanco[0];

        if (
            !categoriaEncontrada ||
            Number(categoriaEncontrada.ativa) !== 1
        ) {
            return response.status(400).json({
                mensagem: "Selecione uma categoria ativa válida."
            });
        }

        // VALIDAR MUNICÍPIO
        const [[municipioEncontrado]] = await pool.execute(
            `SELECT id_municipio
             FROM municipios
             WHERE nome = ?
             LIMIT 1`,
            [municipio.trim()]
        );

        if (!municipioEncontrado) {
            return response.status(400).json({
                mensagem: "Selecione um município válido."
            });
        }

        // INSERIR RELATO
        const [resultado] = await pool.execute(
            `INSERT INTO relatos (
                descricao,
                data_fato,
                hora_fato,
                latitude,
                longitude,
                referencia_local,
                chave_envio,
                fk_id_conta_autor,
                fk_id_municipio,
                fk_id_categoria
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                descricaoLimpa,
                data,
                hora ? `${hora}:00` : null,
                latitudeNumero,
                longitudeNumero,
                referenciaLimpa || null,
                randomUUID(),
                request.usuario.id,
                municipioEncontrado.id_municipio,
                categoriaEncontrada.id_categoria
            ]
        );

        return response.status(201).json({
            mensagem: "Relato enviado com sucesso.",
            id_relato: resultado.insertId,
            situacao: "Pendente"
        });

    } catch (erro) {
        next(erro);
    }
}
