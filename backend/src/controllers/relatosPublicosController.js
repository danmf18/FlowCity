
import { pool } from "../config/database.js";

/* =========================================================
   LISTAR RELATOS PÚBLICOS DOS CIDADÃOS
========================================================= */

export async function listarRelatosPublicos(request, response, next) {
    try {
        const pagina = Math.max(
            1,
            parseInt(request.query.pagina, 10) || 1
        );

        const limite = 12;
        const offset = (pagina - 1) * limite;

        const pesquisa = String(request.query.pesquisa || "")
            .trim()
            .slice(0, 100);

        const categoria = String(request.query.categoria || "")
            .trim()
            .slice(0, 100);

        const municipio = String(request.query.municipio || "")
            .trim()
            .slice(0, 100);

        const filtros = ["r.situacao = 'Aprovado'"];
        const parametros = [];

        if (pesquisa) {
            filtros.push("(c.nome LIKE ? OR m.nome LIKE ?)");
            parametros.push(`%${pesquisa}%`, `%${pesquisa}%`);
        }

        if (categoria) {
            filtros.push("c.nome = ?");
            parametros.push(categoria);
        }

        if (municipio) {
            filtros.push("m.nome = ?");
            parametros.push(municipio);
        }

        const where = filtros.join(" AND ");

        const [relatos] = await pool.query(
            `SELECT
                r.id_relato,
                r.descricao,
                r.data_fato,
                r.hora_fato,
                r.enviado_em,
                ROUND(r.latitude, 2) AS latitude,
                ROUND(r.longitude, 2) AS longitude,
                c.nome AS categoria,
                m.nome AS municipio
            FROM relatos r
            INNER JOIN categorias c
                ON c.id_categoria = r.fk_id_categoria
            INNER JOIN municipios m
                ON m.id_municipio = r.fk_id_municipio
            WHERE ${where}
            ORDER BY r.enviado_em DESC
            LIMIT ? OFFSET ?`,
            [...parametros, limite, offset]
        );

        const [[resultado]] = await pool.query(
            `SELECT COUNT(*) AS total
            FROM relatos r
            INNER JOIN categorias c
                ON c.id_categoria = r.fk_id_categoria
            INNER JOIN municipios m
                ON m.id_municipio = r.fk_id_municipio
            WHERE ${where}`,
            parametros
        );

        return response.status(200).json({
            relatos,
            total: Number(resultado.total),
            pagina,
            limite,
            totalPaginas: Math.ceil(
                Number(resultado.total) / limite
            )
        });

    } catch (erro) {
        next(erro);
    }
}

/* =========================================================
   LISTAR OCORRÊNCIAS OFICIAIS INDIVIDUAIS PARA O MAPA
========================================================= */

export async function listarDadosOficiaisMapa(request, response, next) {
    try {
        const limite = Math.min(
            50000,
            Math.max(
                1,
                Number.parseInt(request.query.limite, 10) || 50000
            )
        );

        const [registros] = await pool.query(
            `SELECT
                ro.id_ocorrencia,
                ro.nome_municipio AS municipio,
                ro.cod_ibge,
                ro.data_ocorrencia_bo AS data_ocorrencia,
                ro.bairro,
                ro.natureza_apurada AS natureza,
                ro.latitude,
                ro.longitude
            FROM registro_oficial ro
            INNER JOIN importacoes i
                ON i.id_importacao = ro.fk_id_importacao
            WHERE ro.ativo = 1
              AND i.excluida_em IS NULL
              AND i.situacao = 'CONCLUIDA'
              AND ro.latitude IS NOT NULL
              AND ro.longitude IS NOT NULL
              AND ro.latitude <> 0
              AND ro.longitude <> 0
              AND ro.latitude BETWEEN -90 AND 90
              AND ro.longitude BETWEEN -180 AND 180
              AND ro.cod_ibge IN (
                  3548708,
                  3547809,
                  3548807,
                  3513801,
                  3529401,
                  3543303,
                  3544103
              )
            ORDER BY
                ro.data_ocorrencia_bo DESC,
                ro.id_ocorrencia DESC
            LIMIT ?`,
            [limite]
        );

        const dados = registros.map((registro) => ({
            ...registro,
            id_ocorrencia: Number(registro.id_ocorrencia),
            latitude: Number(registro.latitude),
            longitude: Number(registro.longitude)
        }));

        return response.status(200).json({
            registros: dados,
            total: dados.length
        });

    } catch (erro) {
        console.error(
            "Erro ao consultar ocorrências oficiais do mapa:",
            erro
        );

        next(erro);
    }
}
