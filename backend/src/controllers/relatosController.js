import { pool } from "../config/database.js";
import crypto from "node:crypto";

export async function   criarRelato(req, res, next) {
    try {
        const {
            descricao,
            data_fato,
            hora_fato,
            latitude,
            longitude,
            referencia_local,
            municipio,
            categoria,
            confirmacao,
        } = req.body;

        // Trocar pelo ID vindo do middleware de autenticação
        const id_conta_autor = 1;

        // -------------------- DESCRIÇÃO --------------------
        if (!descricao || descricao.trim() === "") {
            const erro = new Error("A descrição do relato é obrigatória.");
            erro.status = 400;
            throw erro;
        }

        // -------------------- DATA DO FATO --------------------
        if (!data_fato) {
            const erro = new Error("A data do ocorrido é obrigatória.");
            erro.status = 400;
            throw erro;
        }

        if (isNaN(Date.parse(data_fato))) {
            const erro = new Error("Data inválida.");
            erro.status = 400;
            throw erro;
        }

        if (new Date(data_fato) > new Date()) {
            const erro = new Error("A data do ocorrido não pode ser no futuro.");
            erro.status = 400;
            throw erro;
        }

        // -------------------- HORA DO FATO (OPCIONAL) --------------------
        let horaFinal = null;

        if (hora_fato && hora_fato.trim() !== "") {
            if (isNaN(Date.parse(`1970-01-01T${hora_fato}`))) {
                const erro = new Error("Hora inválida.");
                erro.status = 400;
                throw erro;
            }

            horaFinal = hora_fato;
        }

        // -------------------- LATITUDE E LONGITUDE --------------------
        if (latitude === undefined || latitude === null || latitude === "" || Number.isNaN(Number(latitude))) {
            const erro = new Error("A latitude é obrigatória e deve ser um número válido.");
            erro.status = 400;
            throw erro;
        }

        if (longitude === undefined || longitude === null || longitude === "" || Number.isNaN(Number(longitude))) {
            const erro = new Error("A longitude é obrigatória e deve ser um número válido.");
            erro.status = 400;
            throw erro;
        }

        // -------------------- REFERÊNCIA LOCAL (OPCIONAL) --------------------
        const referenciaFinal = referencia_local && referencia_local.trim() !== ""
            ? referencia_local.trim()
            : null;

        // -------------------- MUNICÍPIO --------------------
        if (!municipio) {
            const erro = new Error("O município é obrigatório.");
            erro.status = 400;
            throw erro;
        }

        const tabelaMunicipios = {
            'São Bernardo do Campo': 1,
            'Santo André': 2,
            'São Caetano do Sul': 3,
            'Diadema': 4,
            'Mauá': 5,
            'Ribeirão Pires': 6,
            'Rio Grande da Serra': 7,
        };

        const id_municipio = tabelaMunicipios[municipio];

        if (!id_municipio) {
            const erro = new Error("Município inválido.");
            erro.status = 400;
            throw erro;
        }

        // -------------------- CATEGORIA --------------------
        if (!categoria) {
            const erro = new Error("A categoria é obrigatória.");
            erro.status = 400;
            throw erro;
        }

        const tabelaCategorias = {
            'Apreensão_de_Entorpecentes': 1,
            'Estupro': 2,
            'Estupro_de_Vulnerável': 3,
            'Extorsão_Mediante_Sequestro': 4,
            'Furto_Outros': 5,
            'Furto_de_Carga': 6,
            'Furto_de_Veículo': 7,
            'Homicídio_Culposo_Outros': 8,
            'Homicídio_Culposo_por_Acidente_de_Trânsito': 9,
            'Homicídio_Doloso': 10,
            'Homicídio_Doloso_por_Acidente_de_Trânsito': 11,
            'Latrocínio': 12,
            'Lesão_Corporal_Culposa_Outras': 13,
            'Lesão_Corporal_Culposa_por_Acidente_de_Trânsito': 14,
            'Lesão_Corporal_Dolosa': 15,
            'Lesão_Corporal_Seguida_de_Morte': 16,
            'Porte_de_Arma': 17,
            'Porte_de_Entorpecentes': 18,
            'Roubo_Outros': 19,
            'Roubo_de_Carga': 20,
            'Roubo_de_Veículo': 21,
            'Tentativa_de_Homicídio': 22,
            'Tráfico_de_Entorpecentes': 23,
        };

        const id_categoria = tabelaCategorias[categoria];

        if (!id_categoria) {
            const erro = new Error("Categoria inválida.");
            erro.status = 400;
            throw erro;
        }

        // -------------------- CONFIRMAÇÃO --------------------
        if (!confirmacao) {
            const erro = new Error("Marque a caixa de confirmação.");
            erro.status = 400;
            throw erro;
        }

        // -------------------- CHAVE DE ENVIO E AUTOR --------------------
        const chave_envio = crypto.randomUUID();

        // -------------------- SALVAR NO BANCO --------------------
        const sql = `
            INSERT INTO relatos (
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const valores = [
            descricao.trim(),
            data_fato,
            horaFinal,
            Number(latitude),
            Number(longitude),
            referenciaFinal,
            chave_envio,
            id_conta_autor,
            id_municipio,
            id_categoria
        ];

        await pool.query(sql, valores);

        return res.status(201).json({ mensagem: "Relato salvo com sucesso!" });

    } catch (error) {
        next(error);
    }
}