import { pool as alertabcPool } from "../config/database.js";
import ExcelJS from "exceljs";
import { extract } from "fuzzball";

export { alertabcPool };

const TAMANHO_LOTE = 500;

const SUBSTITUICOES_MUNICIPIO = {
  "s. andre": "santo andre",
  "s.andre": "santo andre",
  "s. bernardo do campo": "sao bernardo do campo",
  "s.bernardo do campo": "sao bernardo do campo",
  "s. bernardo": "sao bernardo do campo",
  "s. caetano do sul": "sao caetano do sul",
  "s.caetano do sul": "sao caetano do sul",
  "s. caetano": "sao caetano do sul",
  "rib. pires": "ribeirao pires",
  "r. pires": "ribeirao pires",
  "r. grande da serra": "rio grande da serra",
  "rio gde da serra": "rio grande da serra",
  "rio gde. da serra": "rio grande da serra",
};

const CORRECOES_MANUAIS_BAIRRO = {
  "dos alvarengas": "alvarenga",
  "dos casa": "casa",
  "parque novo oratorio i": "parque novo oratorio",
  "parque novo oratorio ii": "parque novo oratorio",
  "vila santa paula": "santa paula",
  "jardim teles de menezes": "teles de menezes",
};

const BAIRROS_DESCARTADOS = new Set([
  "ignorado",
  "sem bairro",
  "a esclarecer",
  "fr",
]);

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

let estruturaVerificada = false;

/* =========================================================
   FUNÇÕES DE NORMALIZAÇÃO
========================================================= */

function extrairValorCelula(valor) {
  if (valor === null || valor === undefined) return null;

  if (valor instanceof Date) return valor;

  if (typeof valor === "object") {
    if (Array.isArray(valor.richText)) {
      return valor.richText
        .map((parte) => parte.text || "")
        .join("");
    }

    if ("result" in valor) {
      return extrairValorCelula(valor.result);
    }

    if ("text" in valor) return valor.text;

    if ("error" in valor) return null;

    return String(valor);
  }

  return valor;
}

function corrigirEncoding(texto) {
  if (texto === null || texto === undefined) return "";

  let resultado = String(texto);

  let apenasLatin1 = true;

  for (let i = 0; i < resultado.length; i++) {
    if (resultado.charCodeAt(i) > 255) {
      apenasLatin1 = false;
      break;
    }
  }

  if (apenasLatin1) {
    try {
      resultado = utf8Decoder.decode(
        Buffer.from(resultado, "latin1")
      );
    } catch {
      // Mantém o texto original.
    }
  }

  return resultado
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTexto(texto) {
  if (texto === null || texto === undefined) return "";

  return corrigirEncoding(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limparBairro(texto) {
  let bairro = normalizarTexto(texto)
    .replace(/"/g, "")
    .trim();

  if (bairro.startsWith("bairro ")) {
    bairro = bairro.slice(7).trim();
  }

  if (bairro.length < 2 || !/[a-z]/.test(bairro)) {
    return "";
  }

  if (BAIRROS_DESCARTADOS.has(bairro)) {
    return "";
  }

  return bairro;
}

function normalizarMunicipio(texto) {
  const municipio = normalizarTexto(texto);

  return SUBSTITUICOES_MUNICIPIO[municipio] || municipio;
}

function parseNumero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const numero = Number(
    String(valor)
      .trim()
      .replace(",", ".")
  );

  return Number.isFinite(numero) ? numero : null;
}

function sanitizarCoordenadas(latitudeRaw, longitudeRaw) {
  const latitude = parseNumero(latitudeRaw);
  const longitude = parseNumero(longitudeRaw);

  if (latitude === null || longitude === null) {
    return [null, null];
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    latitude === 0 ||
    longitude < -180 ||
    longitude > 180 ||
    longitude === 0
  ) {
    return [null, null];
  }

  return [
    Number(latitude.toFixed(8)),
    Number(longitude.toFixed(8)),
  ];
}

function formatarDataUTC(data) {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");

  if (ano < 1900 || ano > 2100) return null;

  return `${ano}-${mes}-${dia}`;
}

function sanitizarData(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return formatarDataUTC(valor);
  }

  if (
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor > 1
  ) {
    const data = new Date(
      Math.round((valor - 25569) * 86400 * 1000)
    );

    return Number.isNaN(data.getTime())
      ? null
      : formatarDataUTC(data);
  }

  const texto = String(valor).trim();

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const brasileira = texto.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );

  if (brasileira) {
    const dia = brasileira[1].padStart(2, "0");
    const mes = brasileira[2].padStart(2, "0");

    return `${brasileira[3]}-${mes}-${dia}`;
  }

  const data = new Date(texto);

  return Number.isNaN(data.getTime())
    ? null
    : formatarDataUTC(data);
}

function sanitizarHora(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const hora = String(valor.getUTCHours()).padStart(2, "0");
    const minuto = String(valor.getUTCMinutes()).padStart(2, "0");
    const segundo = String(valor.getUTCSeconds()).padStart(2, "0");

    return `${hora}:${minuto}:${segundo}`;
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    const fracao = valor >= 1 ? valor % 1 : valor;

    const totalSegundos =
      Math.round(fracao * 86400) % 86400;

    const hora = String(
      Math.floor(totalSegundos / 3600)
    ).padStart(2, "0");

    const minuto = String(
      Math.floor((totalSegundos % 3600) / 60)
    ).padStart(2, "0");

    const segundo = String(
      totalSegundos % 60
    ).padStart(2, "0");

    return `${hora}:${minuto}:${segundo}`;
  }

  const texto = String(valor).trim();

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(texto)) {
    return texto.length === 8
      ? texto
      : `${texto}:00`;
  }

  return null;
}

function limparStrOuNull(texto) {
  const resultado = corrigirEncoding(texto);

  if (
    !resultado ||
    ["null", "nan", "nat"].includes(resultado.toLowerCase())
  ) {
    return null;
  }

  return resultado;
}

function validarId(valor, nome = "ID") {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    const erro = new Error(`${nome} inválido.`);
    erro.status = 400;
    throw erro;
  }

  return id;
}

/* =========================================================
   ESTRUTURA DO BANCO
========================================================= */

async function listarColunasTabela(conn, tabela) {
  const [linhas] = await conn.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tabela]
  );

  return new Set(
    linhas.map((linha) => linha.COLUMN_NAME)
  );
}

async function verificarTabela(conn, tabela) {
  const [linhas] = await conn.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tabela]
  );

  if (!linhas.length) {
    throw new Error(
      `A tabela ${tabela} não existe no banco de dados.`
    );
  }
}

export async function garantirEstruturaImportacoes() {
  if (estruturaVerificada) return;

  const conn = await alertabcPool.getConnection();

  try {
    await verificarTabela(conn, "contas");
    await verificarTabela(conn, "municipios");
    await verificarTabela(conn, "fontes");
    await verificarTabela(conn, "importacoes");
    await verificarTabela(conn, "item_importacao");
    await verificarTabela(conn, "censo_demografico");
    await verificarTabela(conn, "acoes_administrativas");

    // Cria somente a tabela de registros oficiais, caso não exista.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS registro_oficial (
        id_ocorrencia INT AUTO_INCREMENT PRIMARY KEY,
        nome_departamento VARCHAR(150),
        nome_municipio VARCHAR(150),
        data_registro DATE,
        num_bo VARCHAR(150),
        data_ocorrencia_bo DATE,
        hora_ocorrencia_bo TIME,
        bairro VARCHAR(150),
        latitude DECIMAL(11,8),
        longitude DECIMAL(11,8),
        geom POINT,
        rubrica VARCHAR(255),
        descr_conduta TEXT,
        natureza_apurada VARCHAR(255),
        cod_ibge INT,
        populacao_bairro INT,
        populacao_municipio INT,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        fk_id_municipio INT,
        fk_id_importacao INT,
        fk_id_item_origem INT UNIQUE,
        INDEX idx_ocorrencias_data (data_ocorrencia_bo),
        INDEX idx_ocorrencias_cod_ibge (cod_ibge),
        INDEX idx_ocorrencias_municipio_bairro
          (nome_municipio, bairro),
        INDEX idx_ocorrencias_natureza (natureza_apurada),
        INDEX idx_ocorrencias_lat_lng (latitude, longitude),
        INDEX idx_ocorrencias_importacao (fk_id_importacao),
        INDEX idx_ocorrencias_ativo (ativo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await verificarTabela(conn, "registro_oficial");

    const colunasImportacoes = await listarColunasTabela(
      conn,
      "importacoes"
    );

    if (!colunasImportacoes.has("caminho_arquivo")) {
      await conn.query(
        `ALTER TABLE importacoes
         ADD COLUMN caminho_arquivo VARCHAR(500) NULL`
      );
    }

    if (!colunasImportacoes.has("excluida_em")) {
      await conn.query(
        `ALTER TABLE importacoes
         ADD COLUMN excluida_em TIMESTAMP NULL DEFAULT NULL`
      );
    }

    estruturaVerificada = true;
  } finally {
    conn.release();
  }
}

/* =========================================================
   MUNICÍPIOS E FONTES
========================================================= */

async function carregarMunicipios(conn) {
  const [linhas] = await conn.query(
    `SELECT
      id_municipio,
      nome,
      codigo_ibge
     FROM municipios
     ORDER BY id_municipio`
  );

  const municipioPorNome = new Map();
  const municipioPorCodigo = new Map();

  for (const linha of linhas) {
    const municipio = {
      id_municipio: Number(linha.id_municipio),
      nome: normalizarMunicipio(linha.nome),
      codigo_ibge: String(linha.codigo_ibge),
    };

    municipioPorNome.set(
      municipio.nome,
      municipio
    );

    municipioPorCodigo.set(
      municipio.codigo_ibge,
      municipio
    );
  }

  return {
    municipioPorNome,
    municipioPorCodigo,
  };
}

async function obterIdFonte(conn, nomeFonte) {
  const [fontes] = await conn.query(
    `SELECT id_fonte
     FROM fontes
     WHERE nome = ?
     LIMIT 1`,
    [nomeFonte]
  );

  if (!fontes.length) {
    throw new Error(
      `Fonte de dados não encontrada: ${nomeFonte}. Verifique a tabela fontes.`
    );
  }

  return Number(fontes[0].id_fonte);
}

/* =========================================================
   AÇÕES ADMINISTRATIVAS
========================================================= */

async function registrarAcao(
  conn,
  tipo,
  detalhes,
  contaId,
  importacaoId = null
) {
  await conn.query(
    `INSERT INTO acoes_administrativas
      (
        tipo,
        detalhes,
        fk_id_conta_responsavel,
        fk_id_conta_afetada,
        fk_id_importacao
      )
     VALUES (?, ?, ?, NULL, ?)`,
    [
      tipo,
      detalhes,
      validarId(contaId, "Conta responsável"),
      importacaoId,
    ]
  );
}

/* =========================================================
   POPULAÇÃO
========================================================= */

export async function recalcularPopulacaoRegistros(conn) {
  if (!conn) {
    throw new Error(
      "A conexão com o banco é obrigatória para recalcular as populações."
    );
  }

  await conn.query(`
    UPDATE registro_oficial
    SET
      populacao_municipio = NULL,
      populacao_bairro = NULL
  `);

  await conn.query(`
    UPDATE registro_oficial r

    JOIN (
      SELECT
        cod_ibge,
        MAX(populacao) AS populacao

      FROM censo_demografico

      WHERE ativo = 1
        AND nivel_territorial = 'municipio'

      GROUP BY cod_ibge
    ) c ON c.cod_ibge = r.cod_ibge

    SET r.populacao_municipio = c.populacao
  `);

  await conn.query(`
    UPDATE registro_oficial r

    JOIN (
      SELECT
        cod_ibge,
        bairro,
        MAX(populacao) AS populacao

      FROM censo_demografico

      WHERE ativo = 1
        AND nivel_territorial = 'bairro'
        AND bairro IS NOT NULL

      GROUP BY cod_ibge, bairro
    ) c
      ON c.cod_ibge = r.cod_ibge
     AND c.bairro = r.bairro

    SET r.populacao_bairro = c.populacao
  `);
}

/* =========================================================
   INSERÇÃO DOS ITENS E DOS REGISTROS
========================================================= */

async function inserirLoteComItens(
  conn,
  idImportacao,
  nomeAba,
  itensLote,
  destinoCallback
) {
  if (!itensLote.length) return;

  const valoresItens = itensLote.map((item) => [
    item.numeroLinha,
    item.dadosRecebidos,
    item.resultado,
    item.motivo,
    item.municipioInformado,
    nomeAba,
    idImportacao,
  ]);

  const [resultado] = await conn.query(
    `INSERT INTO item_importacao
      (
        numero_linha,
        dados_recebidos,
        resultado,
        motivo,
        municipio_informado,
        nome_aba,
        fk_id_importacao
      )
     VALUES ?`,
    [valoresItens]
  );

  const mapaIdPorLinha = new Map();

  // O INSERT múltiplo retorna o primeiro ID gerado.
  // Os IDs deste lote são sequenciais na mesma instrução.
  for (let i = 0; i < itensLote.length; i++) {
    mapaIdPorLinha.set(
      itensLote[i].numeroLinha,
      Number(resultado.insertId) + i
    );
  }

  await destinoCallback(mapaIdPorLinha);
}

/* =========================================================
   CARREGAR DADOS DO CENSO
========================================================= */

async function carregarCensoDoBanco(conn) {
  const [linhas] = await conn.query(`
    SELECT
      nivel_territorial,
      cod_ibge,
      nome_municipio,
      bairro,
      populacao

    FROM censo_demografico

    WHERE ativo = 1

    ORDER BY ano_censo ASC, id_censo ASC
  `);

  const populacaoPorMunicipio = new Map();
  const populacaoPorBairro = new Map();
  const bairrosSet = new Map();

  for (const linha of linhas) {
    const codigo = String(linha.cod_ibge);

    if (linha.nivel_territorial === "municipio") {
      populacaoPorMunicipio.set(
        codigo,
        Number(linha.populacao)
      );
    }

    if (
      linha.nivel_territorial === "bairro" &&
      linha.bairro
    ) {
      populacaoPorBairro.set(
        `${codigo}|${normalizarTexto(linha.bairro)}`,
        Number(linha.populacao)
      );

      if (!bairrosSet.has(codigo)) {
        bairrosSet.set(codigo, new Set());
      }

      bairrosSet.get(codigo).add(
        normalizarTexto(linha.bairro)
      );
    }
  }

  const bairrosPorMunicipio = new Map();

  for (const [codigo, bairros] of bairrosSet.entries()) {
    bairrosPorMunicipio.set(
      codigo,
      Array.from(bairros)
    );
  }

  return {
    populacaoPorMunicipio,
    populacaoPorBairro,
    bairrosPorMunicipio,
  };
}

function criarResolvedorBairro(bairrosPorMunicipio) {
  const cache = new Map();

  return function encontrarMelhorBairro(
    codigoIbge,
    bairroRaw
  ) {
    let bairro = limparBairro(bairroRaw);

    if (CORRECOES_MANUAIS_BAIRRO[bairro]) {
      bairro = CORRECOES_MANUAIS_BAIRRO[bairro];
    }

    if (!bairro) return null;

    const chave = `${codigoIbge}|${bairro}`;

    if (cache.has(chave)) {
      return cache.get(chave);
    }

    const opcoes = bairrosPorMunicipio.get(
      String(codigoIbge)
    );

    let resultado = bairro;

    if (opcoes && opcoes.length > 0) {
      if (opcoes.includes(bairro)) {
        resultado = bairro;
      } else {
        const [match] = extract(bairro, opcoes, {
          limit: 1,
          cutoff: 85,
        });

        resultado = match ? match[0] : bairro;
      }
    }

    cache.set(chave, resultado);

    return resultado;
  };
}

/* =========================================================
   IMPORTAR CENSO IBGE
========================================================= */

export async function importarPlanilhaCenso({
  caminhoArquivo,
  nomeArquivo,
  paginaOrigem,
  anoCenso,
  contaId,
}) {
  await garantirEstruturaImportacoes();

  const contaResponsavel = validarId(
    contaId,
    "Conta responsável"
  );

  const ano = Number(anoCenso) || 2022;

  if (
    !Number.isInteger(ano) ||
    ano < 1900 ||
    ano > 2100
  ) {
    throw new Error("Ano do Censo inválido.");
  }

  const conn = await alertabcPool.getConnection();

  let idImportacao = null;

  try {
    const { municipioPorNome } = await carregarMunicipios(conn);

    const idFonte = await obterIdFonte(
      conn,
      "IBGE - Censo Demográfico"
    );

    await conn.beginTransaction();

    const [resultadoImportacao] = await conn.query(
      `INSERT INTO importacoes
        (
          nome_arquivo,
          caminho_arquivo,
          pagina_origem,
          inicio_periodo,
          fim_periodo,
          situacao,
          resumo_resultado,
          fk_id_conta_responsavel,
          fk_id_fonte
        )
       VALUES (?, ?, ?, ?, ?, 'PROCESSANDO', NULL, ?, ?)`,
      [
        nomeArquivo,
        caminhoArquivo,
        paginaOrigem || "https://sidra.ibge.gov.br/tabela/9922",
        `${ano}-01-01`,
        `${ano}-12-31`,
        contaResponsavel,
        idFonte,
      ]
    );

    idImportacao = resultadoImportacao.insertId;

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(caminhoArquivo);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error(
        "A planilha do Censo IBGE não possui abas válidas."
      );
    }

    const nomeAba = worksheet.name;
    const chavesVistas = new Set();

    let totalLidas = 0;
    let totalMunicipios = 0;
    let totalBairros = 0;
    let totalIgnoradas = 0;

    let lote = [];

    const descarregar = async () => {
      if (!lote.length) return;

      const bloco = lote;
      lote = [];

      await inserirLoteComItens(
        conn,
        idImportacao,
        nomeAba,
        bloco,
        async (mapaId) => {
          const valoresCenso = bloco.map((item) => [
            ano,
            item.nivel,
            item.codIbge,
            item.nomeMunicipio,
            item.bairro,
            item.populacao,
            1,
            item.fkIdMunicipio,
            idImportacao,
            mapaId.get(item.numeroLinha),
          ]);

          await conn.query(
            `INSERT INTO censo_demografico
              (
                ano_censo,
                nivel_territorial,
                cod_ibge,
                nome_municipio,
                bairro,
                populacao,
                ativo,
                fk_id_municipio,
                fk_id_importacao,
                fk_id_item_origem
              )
             VALUES ?`,
            [valoresCenso]
          );
        }
      );
    };

    for (
      let numeroLinha = 6;
      numeroLinha <= worksheet.rowCount;
      numeroLinha++
    ) {
      const row = worksheet.getRow(numeroLinha);

      const localidadeRaw = extrairValorCelula(
        row.getCell(1).value
      );

      const populacaoRaw = extrairValorCelula(
        row.getCell(2).value
      );

      if (
        localidadeRaw === null ||
        String(localidadeRaw).trim() === ""
      ) {
        continue;
      }

      totalLidas++;

      const populacaoValor = parseNumero(populacaoRaw);

      if (
        populacaoValor === null ||
        populacaoValor < 0
      ) {
        totalIgnoradas++;
        continue;
      }

      const localidadeLimpa = normalizarTexto(
        localidadeRaw
      );

      const indiceSeparador = localidadeLimpa.lastIndexOf(" - ");

      if (indiceSeparador >= 0) {
        const bairroParte = localidadeLimpa.slice(
          0,
          indiceSeparador
        );

        const cidadeParte = localidadeLimpa
          .slice(indiceSeparador + 3)
          .replace("(sp)", "")
          .trim();

        const bairro = limparBairro(bairroParte);

        const municipio = municipioPorNome.get(
          normalizarMunicipio(cidadeParte)
        );

        if (!municipio || !bairro) {
          totalIgnoradas++;
          continue;
        }

        const chave = `bairro|${municipio.id_municipio}|${bairro}`;

        if (chavesVistas.has(chave)) {
          totalIgnoradas++;
          continue;
        }

        chavesVistas.add(chave);

        const populacao = Math.trunc(populacaoValor);

        lote.push({
          numeroLinha,
          dadosRecebidos: JSON.stringify({
            localidade: corrigirEncoding(localidadeRaw),
            populacao,
          }),
          resultado: "IMPORTADO",
          motivo: null,
          municipioInformado: municipio.nome,
          nivel: "bairro",
          codIbge: municipio.codigo_ibge,
          nomeMunicipio: municipio.nome,
          bairro,
          populacao,
          fkIdMunicipio: municipio.id_municipio,
        });

        totalBairros++;
      } else {
        const cidadeLimpa = localidadeLimpa
          .replace("(sp)", "")
          .trim();

        const municipio = municipioPorNome.get(
          normalizarMunicipio(cidadeLimpa)
        );

        if (!municipio) {
          totalIgnoradas++;
          continue;
        }

        const chave = `municipio|${municipio.id_municipio}`;

        if (chavesVistas.has(chave)) {
          totalIgnoradas++;
          continue;
        }

        chavesVistas.add(chave);

        const populacao = Math.trunc(populacaoValor);

        lote.push({
          numeroLinha,
          dadosRecebidos: JSON.stringify({
            localidade: corrigirEncoding(localidadeRaw),
            populacao,
          }),
          resultado: "IMPORTADO",
          motivo: null,
          municipioInformado: municipio.nome,
          nivel: "municipio",
          codIbge: municipio.codigo_ibge,
          nomeMunicipio: municipio.nome,
          bairro: null,
          populacao,
          fkIdMunicipio: municipio.id_municipio,
        });

        totalMunicipios++;
      }

      if (lote.length >= TAMANHO_LOTE) {
        await descarregar();
      }
    }

    await descarregar();

    if (totalMunicipios === 0 && totalBairros === 0) {
      throw new Error(
        "Nenhum município ou bairro do Grande ABC foi encontrado na planilha do Censo IBGE."
      );
    }

    await recalcularPopulacaoRegistros(conn);

    const resumo =
      `Linhas lidas: ${totalLidas} | ` +
      `Municípios ABC: ${totalMunicipios}/7 | ` +
      `Bairros mapeados: ${totalBairros} | ` +
      `Ignoradas: ${totalIgnoradas}`;

    await conn.query(
      `UPDATE importacoes
       SET
         situacao = 'CONCLUIDA',
         resumo_resultado = ?
       WHERE id_importacao = ?`,
      [resumo, idImportacao]
    );

    await registrarAcao(
      conn,
      "IMPORTACAO_CENSO_IBGE",
      `Importação de censo demográfico (${nomeArquivo}): ${resumo}`,
      contaResponsavel,
      idImportacao
    );

    await conn.commit();

    return {
      id_importacao: idImportacao,
      tipo: "censo",
      resumo,
      totalMunicipios,
      totalBairros,
      totalIgnoradas,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/* =========================================================
   IMPORTAR DADOS CRIMINAIS SSP-SP
========================================================= */

export async function importarPlanilhaCrimes({
  caminhoArquivo,
  nomeArquivo,
  paginaOrigem,
  contaId,
}) {
  await garantirEstruturaImportacoes();

  const contaResponsavel = validarId(
    contaId,
    "Conta responsável"
  );

  const conn = await alertabcPool.getConnection();

  let idImportacao = null;

  try {
    const { municipioPorNome } = await carregarMunicipios(conn);

    const idFonte = await obterIdFonte(
      conn,
      "SSP-SP - Dados Criminais"
    );

    await conn.beginTransaction();

    const censo = await carregarCensoDoBanco(conn);

    const resolverBairro = criarResolvedorBairro(
      censo.bairrosPorMunicipio
    );

    const [resultadoImportacao] = await conn.query(
      `INSERT INTO importacoes
        (
          nome_arquivo,
          caminho_arquivo,
          pagina_origem,
          inicio_periodo,
          fim_periodo,
          situacao,
          resumo_resultado,
          fk_id_conta_responsavel,
          fk_id_fonte
        )
       VALUES (?, ?, ?, NULL, NULL, 'PROCESSANDO', NULL, ?, ?)`,
      [
        nomeArquivo,
        caminhoArquivo,
        paginaOrigem || "https://www.ssp.sp.gov.br/estatistica/consultas",
        contaResponsavel,
        idFonte,
      ]
    );

    idImportacao = resultadoImportacao.insertId;

    let totalLidas = 0;
    let totalImportadas = 0;
    let totalIgnoradas = 0;

    let dataMin = null;
    let dataMax = null;

    const reader = new ExcelJS.stream.xlsx.WorkbookReader(
      caminhoArquivo,
      {
        sharedStrings: "cache",
        hyperlinks: "ignore",
        worksheets: "emit",
        styles: "cache",
      }
    );

    for await (const worksheetReader of reader) {
      const nomeAba = worksheetReader.name;

      let mapaColunas = null;
      let lote = [];

      const descarregar = async () => {
        if (!lote.length) return;

        const bloco = lote;
        lote = [];

        await inserirLoteComItens(
          conn,
          idImportacao,
          nomeAba,
          bloco,
          async (mapaId) => {
            const valoresRegistros = bloco.map((item) => [
              item.nomeDepartamento,
              item.nomeMunicipio,
              item.dataRegistro,
              item.numBo,
              item.dataOcorrencia,
              item.horaOcorrencia,
              item.bairro,
              item.latitude,
              item.longitude,
              null,
              item.rubrica,
              item.descrConduta,
              item.naturezaApurada,
              item.codIbge,
              item.populacaoBairro,
              item.populacaoMunicipio,
              1,
              item.fkIdMunicipio,
              idImportacao,
              mapaId.get(item.numeroLinha),
            ]);

            await conn.query(
              `INSERT INTO registro_oficial
                (
                  nome_departamento,
                  nome_municipio,
                  data_registro,
                  num_bo,
                  data_ocorrencia_bo,
                  hora_ocorrencia_bo,
                  bairro,
                  latitude,
                  longitude,
                  geom,
                  rubrica,
                  descr_conduta,
                  natureza_apurada,
                  cod_ibge,
                  populacao_bairro,
                  populacao_municipio,
                  ativo,
                  fk_id_municipio,
                  fk_id_importacao,
                  fk_id_item_origem
                )
               VALUES ?`,
              [valoresRegistros]
            );
          }
        );
      };

      for await (const row of worksheetReader) {
        if (!mapaColunas) {
          const candidato = new Map();

          for (let i = 1; i < row.values.length; i++) {
            const nomeColuna = extrairValorCelula(
              row.values[i]
            );

            if (
              nomeColuna !== null &&
              String(nomeColuna).trim() !== ""
            ) {
              const normalizada = normalizarTexto(nomeColuna)
                .replace(/[^\w]+/g, "_")
                .replace(/^_+|_+$/g, "");

              candidato.set(normalizada, i);
            }
          }

          if (
            candidato.has("nome_municipio") ||
            candidato.has("municipio")
          ) {
            mapaColunas = candidato;
          }

          continue;
        }

        const pegar = (...nomes) => {
          for (const nome of nomes) {
            const indice = mapaColunas.get(nome);

            if (indice !== undefined) {
              return extrairValorCelula(
                row.values[indice]
              );
            }
          }

          return null;
        };

        const municipioRaw = pegar(
          "nome_municipio",
          "municipio"
        );

        const numeroBo = pegar("num_bo", "numero_bo");

        const naturezaRaw = pegar("natureza_apurada");

        if (
          municipioRaw === null &&
          numeroBo === null &&
          naturezaRaw === null
        ) {
          continue;
        }

        totalLidas++;

        const municipio = municipioPorNome.get(
          normalizarMunicipio(municipioRaw)
        );

        if (!municipio) {
          totalIgnoradas++;
          continue;
        }

        const nomeDepartamento = limparStrOuNull(
          pegar("nome_departamento")
        );

        const dataOcorrencia = sanitizarData(
          pegar("data_ocorrencia_bo")
        );

        const dataRegistro = sanitizarData(
          pegar("data_registro")
        );

        const horaOcorrencia = sanitizarHora(
          pegar("hora_ocorrencia_bo")
        );

        const numBo = limparStrOuNull(numeroBo);

        const bairroRaw = pegar("bairro");

        const bairroMatch = resolverBairro(
          municipio.codigo_ibge,
          bairroRaw
        );

        const [latitude, longitude] = sanitizarCoordenadas(
          pegar("latitude"),
          pegar("longitude")
        );

        const rubrica = limparStrOuNull(
          pegar("rubrica")
        );

        const descrConduta = limparStrOuNull(
          pegar("descr_conduta")
        );

        const naturezaApurada = limparStrOuNull(
          naturezaRaw
        );

        const codigoIbge = Number(
          municipio.codigo_ibge
        );

        const populacaoBairro = bairroMatch
          ? censo.populacaoPorBairro.get(
              `${municipio.codigo_ibge}|${bairroMatch}`
            ) ?? null
          : null;

        const populacaoMunicipio =
          censo.populacaoPorMunicipio.get(
            municipio.codigo_ibge
          ) ?? null;

        if (dataOcorrencia) {
          if (!dataMin || dataOcorrencia < dataMin) {
            dataMin = dataOcorrencia;
          }

          if (!dataMax || dataOcorrencia > dataMax) {
            dataMax = dataOcorrencia;
          }
        }

        lote.push({
          numeroLinha: row.number,

          dadosRecebidos: JSON.stringify({
            num_bo: numBo,
            municipio: limparStrOuNull(municipioRaw),
            bairro: limparStrOuNull(bairroRaw),
            natureza_apurada: naturezaApurada,
            data_ocorrencia_bo: dataOcorrencia,
          }),

          resultado: "IMPORTADO",
          motivo: null,
          municipioInformado: limparStrOuNull(municipioRaw),

          nomeDepartamento,
          nomeMunicipio: municipio.nome,
          dataRegistro,
          numBo,
          dataOcorrencia,
          horaOcorrencia,
          bairro: bairroMatch,
          latitude,
          longitude,
          rubrica,
          descrConduta,
          naturezaApurada,
          codIbge: codigoIbge,
          populacaoBairro,
          populacaoMunicipio,
          fkIdMunicipio: municipio.id_municipio,
        });

        totalImportadas++;

        if (lote.length >= TAMANHO_LOTE) {
          await descarregar();
        }
      }

      await descarregar();
    }

    if (totalLidas === 0) {
      throw new Error(
        "Nenhuma linha válida da SSP-SP foi encontrada. Verifique se a planilha possui a coluna NOME_MUNICIPIO."
      );
    }

    await conn.query(
      `UPDATE registro_oficial
       SET geom = ST_GeomFromText(
         CONCAT('POINT(', longitude, ' ', latitude, ')')
       )
       WHERE fk_id_importacao = ?
         AND latitude IS NOT NULL
         AND longitude IS NOT NULL`,
      [idImportacao]
    );

    const resumo =
      `Linhas lidas: ${totalLidas} | ` +
      `Importadas ABC: ${totalImportadas} | ` +
      `Ignoradas: ${totalIgnoradas}`;

    await conn.query(
      `UPDATE importacoes
       SET
         inicio_periodo = ?,
         fim_periodo = ?,
         situacao = 'CONCLUIDA',
         resumo_resultado = ?
       WHERE id_importacao = ?`,
      [
        dataMin,
        dataMax,
        resumo,
        idImportacao,
      ]
    );

    await registrarAcao(
      conn,
      "IMPORTACAO_DADOS_OFICIAIS",
      `Importação SSP-SP (${nomeArquivo}): ${resumo}`,
      contaResponsavel,
      idImportacao
    );

    await conn.commit();

    return {
      id_importacao: idImportacao,
      tipo: "ssp",
      resumo,
      totalImportadas,
      totalIgnoradas,
      inicio_periodo: dataMin,
      fim_periodo: dataMax,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/* =========================================================
   CONFIRMAR IMPORTAÇÃO
========================================================= */

export async function confirmarImportacao({
  idImportacao,
  contaId,
}) {
  const id = validarId(idImportacao, "ID da importação");
  const responsavel = validarId(contaId, "Conta responsável");

  await garantirEstruturaImportacoes();

  const conn = await alertabcPool.getConnection();

  try {
    await conn.beginTransaction();

    const [[importacao]] = await conn.query(
      `SELECT
        id_importacao,
        nome_arquivo,
        situacao,
        excluida_em

       FROM importacoes

       WHERE id_importacao = ?

       FOR UPDATE`,
      [id]
    );

    if (!importacao) {
      const erro = new Error("Importação não encontrada.");
      erro.status = 404;
      throw erro;
    }

    if (importacao.excluida_em) {
      const erro = new Error(
        "Não é possível confirmar uma importação que está na lixeira."
      );
      erro.status = 400;
      throw erro;
    }

    await conn.query(
      `UPDATE importacoes
       SET situacao = 'CONCLUIDA'
       WHERE id_importacao = ?`,
      [id]
    );

    await registrarAcao(
      conn,
      "CONFIRMACAO_IMPORTACAO",
      `Importação #${id} (${importacao.nome_arquivo}) confirmada.`,
      responsavel,
      id
    );

    await conn.commit();

    return {
      message: "Importação confirmada com sucesso.",
      id_importacao: id,
      situacao: "CONCLUIDA",
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/* =========================================================
   CANCELAR IMPORTAÇÃO
========================================================= */

export async function cancelarImportacao({
  idImportacao,
  contaId,
}) {
  const id = validarId(idImportacao, "ID da importação");
  const responsavel = validarId(contaId, "Conta responsável");

  await garantirEstruturaImportacoes();

  const conn = await alertabcPool.getConnection();

  try {
    await conn.beginTransaction();

    const [[importacao]] = await conn.query(
      `SELECT
        id_importacao,
        nome_arquivo,
        fk_id_fonte,
        situacao,
        excluida_em

       FROM importacoes

       WHERE id_importacao = ?

       FOR UPDATE`,
      [id]
    );

    if (!importacao) {
      const erro = new Error("Importação não encontrada.");
      erro.status = 404;
      throw erro;
    }

    if (importacao.excluida_em) {
      const erro = new Error(
        "Esta importação já está na lixeira."
      );
      erro.status = 400;
      throw erro;
    }

    await conn.query(
      `UPDATE registro_oficial
       SET ativo = 0
       WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE censo_demografico
       SET ativo = 0
       WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE importacoes
       SET situacao = 'CANCELADA'
       WHERE id_importacao = ?`,
      [id]
    );

    const ehCenso = await verificarFonteCenso(
      conn,
      importacao.fk_id_fonte
    );

    if (ehCenso) {
      await recalcularPopulacaoRegistros(conn);
    }

    await registrarAcao(
      conn,
      "CANCELAMENTO_IMPORTACAO",
      `Importação #${id} (${importacao.nome_arquivo}) cancelada e seus registros desativados.`,
      responsavel,
      id
    );

    await conn.commit();

    return {
      message: "Importação cancelada com sucesso.",
      id_importacao: id,
      situacao: "CANCELADA",
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/* =========================================================
   VERIFICAR FONTE DO CENSO
========================================================= */

async function verificarFonteCenso(conn, idFonte) {
  const [[fonte]] = await conn.query(
    `SELECT nome
     FROM fontes
     WHERE id_fonte = ?`,
    [idFonte]
  );

  if (!fonte) return false;

  return normalizarTexto(fonte.nome).includes("censo");
}

/* =========================================================
   LISTAR ITENS DA IMPORTAÇÃO
========================================================= */

export async function listarItensImportacao(
  idImportacao,
  {
    resultado = null,
    limite = 50,
    offset = 0,
  } = {}
) {
  const id = validarId(
    idImportacao,
    "ID da importação"
  );

  const limiteFinal = Math.min(
    200,
    Math.max(1, Number.parseInt(limite, 10) || 50)
  );

  const offsetFinal = Math.max(
    0,
    Number.parseInt(offset, 10) || 0
  );

  await garantirEstruturaImportacoes();

  const condicoes = [
    "fk_id_importacao = ?",
  ];

  const params = [id];

  if (resultado) {
    condicoes.push("resultado = ?");
    params.push(String(resultado));
  }

  const where = condicoes.join(" AND ");

  const [[contagem]] = await alertabcPool.query(
    `SELECT COUNT(*) AS total
     FROM item_importacao
     WHERE ${where}`,
    params
  );

  const [itens] = await alertabcPool.query(
    `SELECT
      id_item_importacao,
      numero_linha,
      dados_recebidos,
      resultado,
      motivo,
      municipio_informado,
      nome_aba,
      fk_id_importacao

     FROM item_importacao

     WHERE ${where}

     ORDER BY id_item_importacao DESC

     LIMIT ? OFFSET ?`,
    [
      ...params,
      limiteFinal,
      offsetFinal,
    ]
  );

  return {
    id_importacao: id,
    total: Number(contagem.total),
    limite: limiteFinal,
    offset: offsetFinal,
    itens,
  };
}