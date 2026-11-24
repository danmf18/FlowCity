import {
  alertabcPool as pool,
  garantirEstruturaImportacoes,
} from "../services/importacaoEtlService.js";

export const getFiltros = async (req, res) => {
  try {
    await garantirEstruturaImportacoes();
    const { municipio } = req.query;

    const [municipios] = await pool.query(`
      SELECT DISTINCT nome_municipio
      FROM registro_oficial
      WHERE ativo = 1 AND nome_municipio IS NOT NULL AND nome_municipio <> ''
      ORDER BY nome_municipio ASC
    `);

    const [crimes] = await pool.query(`
      SELECT DISTINCT natureza_apurada
      FROM registro_oficial
      WHERE ativo = 1 AND natureza_apurada IS NOT NULL AND natureza_apurada <> ''
      ORDER BY natureza_apurada ASC
    `);

    let bairrosQuery = `
      SELECT DISTINCT bairro
      FROM registro_oficial
      WHERE ativo = 1 AND bairro IS NOT NULL AND bairro <> ''
    `;
    const bairrosParams = [];

    if (municipio) {
      bairrosQuery += ` AND nome_municipio = ?`;
      bairrosParams.push(municipio);
    }
    bairrosQuery += ` ORDER BY bairro ASC`;

    const [bairros] = await pool.query(bairrosQuery, bairrosParams);

    const [[datas]] = await pool.query(`
      SELECT
        DATE_FORMAT(MIN(data_ocorrencia_bo), '%Y-%m-%d') AS data_min,
        DATE_FORMAT(MAX(data_ocorrencia_bo), '%Y-%m-%d') AS data_max
      FROM registro_oficial
      WHERE ativo = 1 AND data_ocorrencia_bo IS NOT NULL
    `);

    res.json({
      municipios: municipios.map((r) => r.nome_municipio),
      bairros: bairros.map((r) => r.bairro),
      crimes: crimes.map((r) => r.natureza_apurada),
      intervaloDatas: datas,
    });
  } catch (error) {
    console.error("Erro ao buscar filtros do dashboard:", error);
    res.status(500).json({ error: "Erro ao carregar filtros." });
  }
};

export const getResumoDashboard = async (req, res) => {
  try {
    await garantirEstruturaImportacoes();
    const { municipio, bairro, crime, dataInicio, dataFim } = req.query;

    const condicoes = ["ativo = 1"];
    const params = [];

    if (municipio) {
      condicoes.push("nome_municipio = ?");
      params.push(municipio);
    }
    if (bairro) {
      condicoes.push("bairro = ?");
      params.push(bairro);
    }
    if (crime) {
      condicoes.push("natureza_apurada = ?");
      params.push(crime);
    }
    if (dataInicio) {
      condicoes.push("data_ocorrencia_bo >= ?");
      params.push(dataInicio);
    }
    if (dataFim) {
      condicoes.push("data_ocorrencia_bo <= ?");
      params.push(dataFim);
    }

    const whereSQL = `WHERE ${condicoes.join(" AND ")}`;

    const [
      [porMunicipio],
      [porBairro],
      [porCrime],
      [porData],
      [[totais]],
    ] = await Promise.all([
      pool.query(
        `
        SELECT
          nome_municipio,
          MAX(cod_ibge) AS cod_ibge,
          COUNT(*) AS total,
          MAX(populacao_municipio) AS populacao,
          CASE
            WHEN MAX(populacao_municipio) > 0
            THEN ROUND((COUNT(*) / MAX(populacao_municipio)) * 100000, 1)
            ELSE NULL
          END AS taxa_100k
        FROM registro_oficial
        ${whereSQL}
        GROUP BY nome_municipio
        ORDER BY total DESC
        `,
        params
      ),
      pool.query(
        `
        SELECT
          bairro,
          nome_municipio,
          COUNT(*) AS total,
          MAX(populacao_bairro) AS populacao_bairro,
          CASE
            WHEN MAX(populacao_bairro) > 0
            THEN ROUND((COUNT(*) / MAX(populacao_bairro)) * 100000, 1)
            ELSE NULL
          END AS taxa_100k
        FROM registro_oficial
        ${whereSQL} AND bairro IS NOT NULL AND bairro <> ''
        GROUP BY bairro, nome_municipio
        ORDER BY total DESC
        LIMIT 10
        `,
        params
      ),
      pool.query(
        `
        SELECT
          natureza_apurada AS tipo_crime,
          COUNT(*) AS total
        FROM registro_oficial
        ${whereSQL} AND natureza_apurada IS NOT NULL AND natureza_apurada <> ''
        GROUP BY natureza_apurada
        ORDER BY total DESC
        LIMIT 10
        `,
        params
      ),
      pool.query(
        `
        SELECT
          DATE_FORMAT(data_ocorrencia_bo, '%Y-%m') AS periodo,
          COUNT(*) AS total
        FROM registro_oficial
        ${whereSQL} AND data_ocorrencia_bo IS NOT NULL
        GROUP BY periodo
        ORDER BY periodo ASC
        `,
        params
      ),
      pool.query(
        `
        SELECT
          COUNT(*) AS total_ocorrencias,
          COUNT(DISTINCT nome_municipio) AS total_municipios,
          COUNT(DISTINCT bairro) AS total_bairros
        FROM registro_oficial
        ${whereSQL}
        `,
        params
      ),
    ]);

    const escopoPopulacao = bairro ? "bairro" : "municipio";

    const populacaoTotal = bairro
      ? porBairro.reduce((acc, item) => acc + (Number(item.populacao_bairro) || 0), 0)
      : porMunicipio.reduce((acc, item) => acc + (Number(item.populacao) || 0), 0);

    const populacaoReferencia = populacaoTotal > 0 ? populacaoTotal : null;

    const taxaGeral100k =
      populacaoReferencia
        ? Number(((totais.total_ocorrencias / populacaoReferencia) * 100000).toFixed(1))
        : null;

    res.json({
      kpis: {
        totalOcorrencias: totais.total_ocorrencias,
        totalMunicipios: totais.total_municipios,
        totalBairros: totais.total_bairros,
        populacaoReferencia,
        escopoPopulacao,
        taxaGeral100k,
      },
      porMunicipio,
      porBairro,
      porCrime,
      porData,
    });
  } catch (error) {
    console.error("Erro ao gerar resumo do dashboard:", error);
    res.status(500).json({ error: "Erro ao carregar dados do dashboard." });
  }
};