import mysql from "mysql2/promise";
import ExcelJS from "exceljs";
import { extract } from "fuzzball";

export const alertabcPool = mysql.createPool({
  host: process.env.DB_HOST === "localhost" ? "database" : (process.env.DB_HOST || "database"),
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "app_user",
  password: process.env.DB_PASSWORD || "app_password",
  database: "alertabc",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const TAMANHO_LOTE = 500;

const MUNICIPIOS_ABC = [
  { id_municipio: 1, nome: "diadema", codigo_ibge: "3513801" },
  { id_municipio: 2, nome: "maua", codigo_ibge: "3529401" },
  { id_municipio: 3, nome: "ribeirao pires", codigo_ibge: "3543303" },
  { id_municipio: 4, nome: "rio grande da serra", codigo_ibge: "3544103" },
  { id_municipio: 5, nome: "santo andre", codigo_ibge: "3547809" },
  { id_municipio: 6, nome: "sao bernardo do campo", codigo_ibge: "3548708" },
  { id_municipio: 7, nome: "sao caetano do sul", codigo_ibge: "3548807" },
];

const MUNICIPIO_POR_NOME = new Map(MUNICIPIOS_ABC.map((m) => [m.nome, m]));

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

const BAIRROS_DESCARTADOS = new Set(["ignorado", "sem bairro", "a esclarecer", "fr"]);

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function extrairValorCelula(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val;
  if (typeof val === "object") {
    if (Array.isArray(val.richText)) {
      return val.richText.map((part) => part.text || "").join("");
    }
    if ("result" in val) return extrairValorCelula(val.result);
    if ("text" in val) return val.text;
    if ("error" in val) return null;
    return String(val);
  }
  return val;
}

function corrigirEncoding(texto) {
  if (texto === null || texto === undefined) return "";
  let s = String(texto);
  let apenasLatin1 = true;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) {
      apenasLatin1 = false;
      break;
    }
  }
  if (apenasLatin1) {
    try {
      const bytes = Buffer.from(s, "latin1");
      s = utf8Decoder.decode(bytes);
    } catch {
    }
  }
  return s.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizarTexto(texto) {
  if (texto === null || texto === undefined) return "";
  return corrigirEncoding(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function limparBairro(texto) {
  let t = normalizarTexto(texto).replace(/"/g, "").trim();
  if (t.startsWith("bairro ")) {
    t = t.slice(7).trim();
  }
  if (t.length < 2 || !/[a-z]/.test(t)) return "";
  if (BAIRROS_DESCARTADOS.has(t)) return "";
  return t;
}

function normalizarMunicipio(texto) {
  const m = normalizarTexto(texto);
  return SUBSTITUICOES_MUNICIPIO[m] || m;
}

function parseNumero(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const limpo = String(val).trim().replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function sanitizarCoordenadas(latRaw, lonRaw) {
  const lat = parseNumero(latRaw);
  const lon = parseNumero(lonRaw);
  if (lat === null || lon === null) return [null, null];
  const latInvalida = lat < -90 || lat > 90 || lat === 0;
  const lonInvalida = lon < -180 || lon > 180 || lon === 0;
  if (latInvalida || lonInvalida) return [null, null];
  return [Number(lat.toFixed(8)), Number(lon.toFixed(8))];
}

function formatarDataUTC(date) {
  const ano = date.getUTCFullYear();
  const mes = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(date.getUTCDate()).padStart(2, "0");
  if (ano < 1900 || ano > 2100) return null;
  return `${ano}-${mes}-${dia}`;
}

function sanitizarData(val) {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatarDataUTC(val);
  }
  if (typeof val === "number" && Number.isFinite(val) && val > 1) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : formatarDataUTC(d);
  }
  const texto = String(val).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const dia = br[1].padStart(2, "0");
    const mes = br[2].padStart(2, "0");
    return `${br[3]}-${mes}-${dia}`;
  }
  const parsed = new Date(texto);
  return Number.isNaN(parsed.getTime()) ? null : formatarDataUTC(parsed);
}

function sanitizarHora(val) {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const hh = String(val.getUTCHours()).padStart(2, "0");
    const mm = String(val.getUTCMinutes()).padStart(2, "0");
    const ss = String(val.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  if (typeof val === "number" && Number.isFinite(val)) {
    const fracao = val >= 1 ? val % 1 : val;
    const totalSeg = Math.round(fracao * 86400) % 86400;
    const hh = String(Math.floor(totalSeg / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSeg % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeg % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  const texto = String(val).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(texto)) {
    return texto.length === 8 ? texto : `${texto}:00`;
  }
  return null;
}

function limparStrOuNull(texto) {
  const s = corrigirEncoding(texto);
  if (!s || ["null", "nan", "nat"].includes(s.toLowerCase())) return null;
  return s;
}

let estruturaVerificada = false;

async function listarColunasTabela(conn, tabela) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'alertabc' AND TABLE_NAME = ?`,
    [tabela]
  );
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

export async function garantirEstruturaImportacoes() {
  if (estruturaVerificada) return;

  const conn = await alertabcPool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS municipios (
        id_municipio INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE,
        codigo_ibge CHAR(7) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contas (
        id_conta INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        perfil VARCHAR(30) NOT NULL,
        fk_id_municipio INT,
        CONSTRAINT fk_contas_municipio FOREIGN KEY (fk_id_municipio) REFERENCES municipios(id_municipio)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS fontes (
        id_fonte INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS importacoes (
        id_importacao INT AUTO_INCREMENT PRIMARY KEY,
        nome_arquivo VARCHAR(255) NOT NULL,
        caminho_arquivo VARCHAR(500),
        pagina_origem VARCHAR(500),
        inicio_periodo DATE,
        fim_periodo DATE,
        enviada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        excluida_em TIMESTAMP NULL DEFAULT NULL,
        situacao VARCHAR(30) NOT NULL,
        resumo_resultado TEXT,
        fk_id_conta_responsavel INT NOT NULL,
        fk_id_fonte INT NOT NULL,
        INDEX idx_importacoes_conta (fk_id_conta_responsavel),
        INDEX idx_importacoes_fonte (fk_id_fonte),
        INDEX idx_importacoes_excluida (excluida_em),
        CONSTRAINT fk_importacoes_conta FOREIGN KEY (fk_id_conta_responsavel) REFERENCES contas(id_conta),
        CONSTRAINT fk_importacoes_fonte FOREIGN KEY (fk_id_fonte) REFERENCES fontes(id_fonte)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS acoes_administrativas (
        id_acao INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        realizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        detalhes TEXT,
        fk_id_conta_responsavel INT NOT NULL,
        fk_id_conta_afetada INT,
        fk_id_importacao INT,
        CONSTRAINT fk_acoes_conta_resp FOREIGN KEY (fk_id_conta_responsavel) REFERENCES contas(id_conta),
        CONSTRAINT fk_acoes_conta_afet FOREIGN KEY (fk_id_conta_afetada) REFERENCES contas(id_conta),
        CONSTRAINT fk_acoes_importacao FOREIGN KEY (fk_id_importacao) REFERENCES importacoes(id_importacao)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS item_importacao (
        id_item_importacao INT AUTO_INCREMENT PRIMARY KEY,
        numero_linha INT NOT NULL,
        dados_recebidos TEXT,
        resultado VARCHAR(30) NOT NULL,
        motivo VARCHAR(255),
        municipio_informado VARCHAR(100),
        nome_aba VARCHAR(100),
        fk_id_importacao INT NOT NULL,
        INDEX idx_item_importacao_imp (fk_id_importacao),
        INDEX idx_item_importacao_linha (fk_id_importacao, nome_aba, numero_linha),
        CONSTRAINT fk_item_importacao FOREIGN KEY (fk_id_importacao) REFERENCES importacoes(id_importacao)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS censo_demografico (
        id_censo INT AUTO_INCREMENT PRIMARY KEY,
        ano_censo SMALLINT UNSIGNED NOT NULL,
        nivel_territorial VARCHAR(20) NOT NULL,
        cod_ibge CHAR(7) NOT NULL,
        nome_municipio VARCHAR(150) NOT NULL,
        bairro VARCHAR(150),
        populacao INT UNSIGNED NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        fk_id_municipio INT NOT NULL,
        fk_id_importacao INT NOT NULL,
        fk_id_item_origem INT NOT NULL UNIQUE,
        INDEX idx_censo_municipio_bairro (nome_municipio, bairro),
        INDEX idx_censo_cod_ibge (cod_ibge),
        INDEX idx_censo_importacao (fk_id_importacao),
        INDEX idx_censo_ativo (ativo),
        CONSTRAINT fk_censo_municipio FOREIGN KEY (fk_id_municipio) REFERENCES municipios(id_municipio),
        CONSTRAINT fk_censo_importacao FOREIGN KEY (fk_id_importacao) REFERENCES importacoes(id_importacao),
        CONSTRAINT fk_censo_item FOREIGN KEY (fk_id_item_origem) REFERENCES item_importacao(id_item_importacao)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

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
        latitude DECIMAL(11, 8),
        longitude DECIMAL(11, 8),
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
        INDEX idx_ocorrencias_municipio_bairro (nome_municipio, bairro),
        INDEX idx_ocorrencias_natureza (natureza_apurada),
        INDEX idx_ocorrencias_lat_lng (latitude, longitude),
        INDEX idx_ocorrencias_importacao (fk_id_importacao),
        INDEX idx_ocorrencias_ativo (ativo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const colsImp = await listarColunasTabela(conn, "importacoes");
    if (!colsImp.has("caminho_arquivo")) {
      await conn.query("ALTER TABLE importacoes ADD COLUMN caminho_arquivo VARCHAR(500) NULL AFTER nome_arquivo");
    }
    if (!colsImp.has("excluida_em")) {
      await conn.query("ALTER TABLE importacoes ADD COLUMN excluida_em TIMESTAMP NULL DEFAULT NULL AFTER enviada_em, ADD INDEX idx_importacoes_excluida (excluida_em)");
    }

    const colsCenso = await listarColunasTabela(conn, "censo_demografico");
    if (!colsCenso.has("ativo")) {
      await conn.query("ALTER TABLE censo_demografico ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1, ADD INDEX idx_censo_ativo (ativo)");
    }

    const colsReg = await listarColunasTabela(conn, "registro_oficial");
    if (!colsReg.has("fk_id_municipio")) {
      await conn.query("ALTER TABLE registro_oficial ADD COLUMN fk_id_municipio INT NULL");
    }
    if (!colsReg.has("fk_id_importacao")) {
      await conn.query("ALTER TABLE registro_oficial ADD COLUMN fk_id_importacao INT NULL, ADD INDEX idx_ocorrencias_importacao (fk_id_importacao)");
    }
    if (!colsReg.has("fk_id_item_origem")) {
      await conn.query("ALTER TABLE registro_oficial ADD COLUMN fk_id_item_origem INT NULL UNIQUE");
    }
    if (!colsReg.has("ativo")) {
      await conn.query("ALTER TABLE registro_oficial ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1, ADD INDEX idx_ocorrencias_ativo (ativo)");
    }

    await conn.query(
      "INSERT IGNORE INTO municipios (id_municipio, nome, codigo_ibge) VALUES ?",
      [MUNICIPIOS_ABC.map((m) => [m.id_municipio, m.nome, m.codigo_ibge])]
    );

    await conn.query(
      "INSERT IGNORE INTO fontes (id_fonte, nome) VALUES ?",
      [[
        [1, "IBGE - Censo Demográfico"],
        [2, "SSP-SP - Dados Criminais"],
      ]]
    );

    await conn.query(
      `INSERT IGNORE INTO contas (id_conta, nome, email, senha_hash, perfil, fk_id_municipio)
       VALUES (1, 'Administrador AlertABC', 'admin@alertabc.local', 'IMPORTACAO_ETL_SISTEMA', 'admin_geral', 6)`
    );

    estruturaVerificada = true;
  } finally {
    conn.release();
  }
}

export async function recalcularPopulacaoRegistros(conn) {
  await conn.query(
    "UPDATE registro_oficial SET populacao_municipio = NULL, populacao_bairro = NULL"
  );

  await conn.query(`
    UPDATE registro_oficial r
    JOIN (
      SELECT nome_municipio, MAX(populacao) AS populacao
      FROM censo_demografico
      WHERE ativo = 1 AND nivel_territorial = 'municipio'
      GROUP BY nome_municipio
    ) c ON c.nome_municipio = r.nome_municipio
    SET r.populacao_municipio = c.populacao
  `);

  await conn.query(`
    UPDATE registro_oficial r
    JOIN (
      SELECT nome_municipio, bairro, MAX(populacao) AS populacao
      FROM censo_demografico
      WHERE ativo = 1 AND nivel_territorial = 'bairro' AND bairro IS NOT NULL
      GROUP BY nome_municipio, bairro
    ) c ON c.nome_municipio = r.nome_municipio AND c.bairro = r.bairro
    SET r.populacao_bairro = c.populacao
  `);
}

async function inserirLoteComItens(conn, idImportacao, nomeAba, itensLote, destinoCallback) {
  if (itensLote.length === 0) return;

  const valoresItens = itensLote.map((it) => [
    it.numeroLinha,
    it.dadosRecebidos,
    it.resultado,
    it.motivo,
    it.municipioInformado,
    nomeAba,
    idImportacao,
  ]);

  await conn.query(
    `INSERT INTO item_importacao
      (numero_linha, dados_recebidos, resultado, motivo, municipio_informado, nome_aba, fk_id_importacao)
     VALUES ?`,
    [valoresItens]
  );

  const linhas = itensLote.map((it) => it.numeroLinha);
  const [idsInseridos] = await conn.query(
    `SELECT id_item_importacao, numero_linha
     FROM item_importacao
     WHERE fk_id_importacao = ? AND nome_aba = ? AND numero_linha IN (?)`,
    [idImportacao, nomeAba, linhas]
  );

  const mapaIdPorLinha = new Map(idsInseridos.map((r) => [r.numero_linha, r.id_item_importacao]));
  await destinoCallback(mapaIdPorLinha);
}

async function carregarCensoDoBanco(conn) {
  const [linhas] = await conn.query(`
    SELECT nivel_territorial, cod_ibge, nome_municipio, bairro, populacao
    FROM censo_demografico
    WHERE ativo = 1
    ORDER BY ano_censo ASC, id_censo ASC
  `);

  const populacaoPorMunicipio = new Map();
  const populacaoPorBairro = new Map();
  const bairrosSet = new Map();

  for (const row of linhas) {
    if (row.nivel_territorial === "municipio") {
      populacaoPorMunicipio.set(row.nome_municipio, Number(row.populacao));
    } else if (row.nivel_territorial === "bairro" && row.bairro) {
      populacaoPorBairro.set(`${row.cod_ibge}|${row.nome_municipio}|${row.bairro}`, Number(row.populacao));
      if (!bairrosSet.has(row.nome_municipio)) {
        bairrosSet.set(row.nome_municipio, new Set());
      }
      bairrosSet.get(row.nome_municipio).add(row.bairro);
    }
  }

  const bairrosPorMunicipio = new Map();
  for (const [mun, setB] of bairrosSet.entries()) {
    bairrosPorMunicipio.set(mun, Array.from(setB));
  }

  return { populacaoPorMunicipio, populacaoPorBairro, bairrosPorMunicipio };
}

function criarResolvedorBairro(bairrosPorMunicipio) {
  const cache = new Map();

  return function encontrarMelhorBairro(municipio, bairroRaw) {
    let bairroLimpo = limparBairro(bairroRaw);
    if (bairroLimpo && CORRECOES_MANUAIS_BAIRRO[bairroLimpo]) {
      bairroLimpo = CORRECOES_MANUAIS_BAIRRO[bairroLimpo];
    }

    const chave = `${municipio}|${bairroLimpo}`;
    if (cache.has(chave)) return cache.get(chave);

    let resultado = bairroLimpo;
    const opcoes = bairrosPorMunicipio.get(municipio);
    if (opcoes && opcoes.length > 0 && bairroLimpo !== "") {
      if (opcoes.includes(bairroLimpo)) {
        resultado = bairroLimpo;
      } else {
        const [match] = extract(bairroLimpo, opcoes, { limit: 1, cutoff: 85 });
        if (match) {
          resultado = match[0];
        }
      }
    }

    cache.set(chave, resultado);
    return resultado;
  };
}

export async function importarPlanilhaCenso({
  caminhoArquivo,
  nomeArquivo,
  paginaOrigem,
  anoCenso,
  contaId,
}) {
  await garantirEstruturaImportacoes();
  const ano = Number(anoCenso) || 2022;
  const conn = await alertabcPool.getConnection();
  let idImportacao = null;

  try {
    await conn.beginTransaction();

    const [resImp] = await conn.query(
      `INSERT INTO importacoes
        (nome_arquivo, caminho_arquivo, pagina_origem, inicio_periodo, fim_periodo, situacao, resumo_resultado, fk_id_conta_responsavel, fk_id_fonte)
       VALUES (?, ?, ?, ?, ?, 'PROCESSANDO', NULL, ?, 1)`,
      [
        nomeArquivo,
        caminhoArquivo,
        paginaOrigem || "https://sidra.ibge.gov.br/tabela/9922",
        `${ano}-01-01`,
        `${ano}-12-31`,
        contaId,
      ]
    );
    idImportacao = resImp.insertId;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(caminhoArquivo);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error("A planilha do Censo IBGE não possui abas válidas.");
    }

    const nomeAba = worksheet.name;
    const chavesVistas = new Set();
    let totalLidas = 0;
    let totalMunicipios = 0;
    let totalBairros = 0;
    let totalIgnoradas = 0;
    let lote = [];

    const descarregar = async () => {
      if (lote.length === 0) return;
      const bloco = lote;
      lote = [];
      await inserirLoteComItens(conn, idImportacao, nomeAba, bloco, async (mapaId) => {
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
            (ano_censo, nivel_territorial, cod_ibge, nome_municipio, bairro, populacao, ativo, fk_id_municipio, fk_id_importacao, fk_id_item_origem)
           VALUES ?`,
          [valoresCenso]
        );
      });
    };

    for (let rowNumber = 6; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const localidadeRaw = extrairValorCelula(row.getCell(1).value);
      const populacaoRaw = extrairValorCelula(row.getCell(2).value);
      if (localidadeRaw === null || String(localidadeRaw).trim() === "") continue;

      totalLidas++;
      const popValor = parseNumero(populacaoRaw);
      if (popValor === null) {
        totalIgnoradas++;
        continue;
      }

      const localLimpo = normalizarTexto(localidadeRaw);
      if (localLimpo.includes("bairro") && String(populacaoRaw).toLowerCase().includes("total")) {
        totalIgnoradas++;
        continue;
      }

      const popInt = Math.trunc(popValor);

      if (localLimpo.includes(" - ")) {
        const idxSep = localLimpo.lastIndexOf(" - ");
        const bairroParte = localLimpo.slice(0, idxSep);
        const cidadeParte = localLimpo.slice(idxSep + 3).replace("(sp)", "").trim();
        const bairro = limparBairro(bairroParte);
        const mun = MUNICIPIO_POR_NOME.get(cidadeParte);

        if (mun && bairro) {
          const chaveUnica = `bairro|${mun.nome}|${bairro}`;
          if (!chavesVistas.has(chaveUnica)) {
            chavesVistas.add(chaveUnica);
            lote.push({
              numeroLinha: rowNumber,
              dadosRecebidos: JSON.stringify({
                localidade: corrigirEncoding(localidadeRaw),
                populacao: popInt,
              }),
              resultado: "IMPORTADO",
              motivo: null,
              municipioInformado: mun.nome,
              nivel: "bairro",
              codIbge: mun.codigo_ibge,
              nomeMunicipio: mun.nome,
              bairro,
              populacao: popInt,
              fkIdMunicipio: mun.id_municipio,
            });
            totalBairros++;
          }
        } else {
          totalIgnoradas++;
        }
      } else {
        const cidadeLimpa = localLimpo.replace("(sp)", "").trim();
        const mun = MUNICIPIO_POR_NOME.get(cidadeLimpa);

        if (mun) {
          const chaveUnica = `municipio|${mun.nome}`;
          if (!chavesVistas.has(chaveUnica)) {
            chavesVistas.add(chaveUnica);
            lote.push({
              numeroLinha: rowNumber,
              dadosRecebidos: JSON.stringify({
                localidade: corrigirEncoding(localidadeRaw),
                populacao: popInt,
              }),
              resultado: "IMPORTADO",
              motivo: null,
              municipioInformado: mun.nome,
              nivel: "municipio",
              codIbge: mun.codigo_ibge,
              nomeMunicipio: mun.nome,
              bairro: null,
              populacao: popInt,
              fkIdMunicipio: mun.id_municipio,
            });
            totalMunicipios++;
          }
        } else {
          totalIgnoradas++;
        }
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

    const censoAtual = await carregarCensoDoBanco(conn);
    const resolverBairro = criarResolvedorBairro(censoAtual.bairrosPorMunicipio);

    const [bairrosExistentes] = await conn.query(
      `SELECT DISTINCT nome_municipio, bairro
       FROM registro_oficial
       WHERE bairro IS NOT NULL AND bairro <> ''`
    );

    for (const item of bairrosExistentes) {
      const munObj = MUNICIPIO_POR_NOME.get(item.nome_municipio);
      if (!munObj) continue;

      const bairroMatch = resolverBairro(munObj.nome, item.bairro);
      if (bairroMatch && bairroMatch !== item.bairro) {
        await conn.query(
          `UPDATE registro_oficial
           SET bairro = ?
           WHERE nome_municipio = ? AND bairro = ?`,
          [bairroMatch, item.nome_municipio, item.bairro]
        );
      }
    }

    await recalcularPopulacaoRegistros(conn);

    const resumo = `Linhas lidas: ${totalLidas} | Municípios ABC: ${totalMunicipios}/7 | Bairros mapeados: ${totalBairros} | Ignoradas: ${totalIgnoradas}`;

    await conn.query(
      `UPDATE importacoes SET situacao = 'CONCLUIDA', resumo_resultado = ? WHERE id_importacao = ?`,
      [resumo, idImportacao]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('IMPORTACAO_CENSO_IBGE', ?, ?, NULL, ?)`,
      [`Importação de censo demográfico (${nomeArquivo}): ${resumo}`, contaId, idImportacao]
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

export async function importarPlanilhaCrimes({
  caminhoArquivo,
  nomeArquivo,
  paginaOrigem,
  contaId,
}) {
  await garantirEstruturaImportacoes();
  const conn = await alertabcPool.getConnection();
  let idImportacao = null;

  try {
    await conn.beginTransaction();

    const censo = await carregarCensoDoBanco(conn);
    const resolverBairro = criarResolvedorBairro(censo.bairrosPorMunicipio);

    const [resImp] = await conn.query(
      `INSERT INTO importacoes
        (nome_arquivo, caminho_arquivo, pagina_origem, inicio_periodo, fim_periodo, situacao, resumo_resultado, fk_id_conta_responsavel, fk_id_fonte)
       VALUES (?, ?, ?, NULL, NULL, 'PROCESSANDO', NULL, ?, 2)`,
      [
        nomeArquivo,
        caminhoArquivo,
        paginaOrigem || "https://www.ssp.sp.gov.br/estatistica/consultas",
        contaId,
      ]
    );
    idImportacao = resImp.insertId;

    let totalLidas = 0;
    let totalImportadas = 0;
    let totalIgnoradas = 0;
    let dataMin = null;
    let dataMax = null;

    const reader = new ExcelJS.stream.xlsx.WorkbookReader(caminhoArquivo, {
      sharedStrings: "cache",
      hyperlinks: "ignore",
      worksheets: "emit",
      styles: "cache",
    });

    for await (const worksheetReader of reader) {
      const nomeAba = worksheetReader.name;
      let mapaColunas = null;
      let lote = [];

      const descarregar = async () => {
        if (lote.length === 0) return;
        const bloco = lote;
        lote = [];
        await inserirLoteComItens(conn, idImportacao, nomeAba, bloco, async (mapaId) => {
          const valoresReg = bloco.map((item) => [
            item.nomeDepartamento,
            item.nomeMunicipio,
            item.dataOcorrencia,
            item.dataRegistro,
            item.horaOcorrencia,
            item.numBo,
            item.bairro,
            item.latitude,
            item.longitude,
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
              (nome_departamento, nome_municipio, data_ocorrencia_bo, data_registro, hora_ocorrencia_bo, num_bo, bairro, latitude, longitude, rubrica, descr_conduta, natureza_apurada, cod_ibge, populacao_bairro, populacao_municipio, ativo, fk_id_municipio, fk_id_importacao, fk_id_item_origem)
             VALUES ?`,
            [valoresReg]
          );
        });
      };

      for await (const row of worksheetReader) {
        if (!mapaColunas) {
          const candidato = new Map();
          for (let i = 1; i < row.values.length; i++) {
            const nomeCol = extrairValorCelula(row.values[i]);
            if (nomeCol !== null && String(nomeCol).trim() !== "") {
              const normalizada = normalizarTexto(nomeCol).replace(/\s+/g, "_");
              candidato.set(normalizada, i);
            }
          }
          if (candidato.has("nome_municipio")) {
            mapaColunas = candidato;
          }
          continue;
        }

        const pegar = (nome) => {
          const idx = mapaColunas.get(nome);
          return idx ? extrairValorCelula(row.values[idx]) : null;
        };

        const munRaw = pegar("nome_municipio");
        if (munRaw === null && pegar("num_bo") === null && pegar("natureza_apurada") === null) {
          continue;
        }

        totalLidas++;
        const munNormalizado = normalizarMunicipio(munRaw);
        const munObj = MUNICIPIO_POR_NOME.get(munNormalizado);

        if (!munObj) {
          totalIgnoradas++;
          continue;
        }

        const nomeDepartamento = limparStrOuNull(pegar("nome_departamento"));
        const dataOcorrencia = sanitizarData(pegar("data_ocorrencia_bo"));
        const dataRegistro = sanitizarData(pegar("data_registro"));
        const horaOcorrencia = sanitizarHora(pegar("hora_ocorrencia_bo"));
        const numBo = limparStrOuNull(pegar("num_bo"));
        const bairroRaw = pegar("bairro");
        const bairroMatch = resolverBairro(munObj.nome, bairroRaw) || null;
        const [latitude, longitude] = sanitizarCoordenadas(pegar("latitude"), pegar("longitude"));
        const rubrica = limparStrOuNull(pegar("rubrica"));
        const descrConduta = limparStrOuNull(pegar("descr_conduta"));
        const naturezaApurada = limparStrOuNull(pegar("natureza_apurada"));

        const codIbgeInt = Number(munObj.codigo_ibge);
        const popBairro = bairroMatch
          ? (censo.populacaoPorBairro.get(`${munObj.codigo_ibge}|${munObj.nome}|${bairroMatch}`) ?? null)
          : null;
        const popMunicipio = censo.populacaoPorMunicipio.get(munObj.nome) ?? null;

        if (dataOcorrencia) {
          if (!dataMin || dataOcorrencia < dataMin) dataMin = dataOcorrencia;
          if (!dataMax || dataOcorrencia > dataMax) dataMax = dataOcorrencia;
        }

        lote.push({
          numeroLinha: row.number,
          dadosRecebidos: JSON.stringify({
            num_bo: numBo,
            municipio: limparStrOuNull(munRaw),
            bairro: limparStrOuNull(bairroRaw),
            natureza_apurada: naturezaApurada,
            data_ocorrencia_bo: dataOcorrencia,
          }),
          resultado: "IMPORTADO",
          motivo: null,
          municipioInformado: limparStrOuNull(munRaw),
          nomeDepartamento,
          nomeMunicipio: munObj.nome,
          dataOcorrencia,
          dataRegistro,
          horaOcorrencia,
          numBo,
          bairro: bairroMatch,
          latitude,
          longitude,
          rubrica,
          descrConduta,
          naturezaApurada,
          codIbge: codIbgeInt,
          populacaoBairro: popBairro,
          populacaoMunicipio: popMunicipio,
          fkIdMunicipio: munObj.id_municipio,
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
        "Nenhuma linha válida da SSP-SP foi encontrada (coluna NOME_MUNICIPIO ausente). Se estiver enviando o Censo, selecione 'IBGE — Censo Demográfico'."
      );
    }

    await conn.query(
      `UPDATE registro_oficial
       SET geom = ST_GeomFromText(CONCAT('POINT(', longitude, ' ', latitude, ')'))
       WHERE fk_id_importacao = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [idImportacao]
    );

    const resumo = `Linhas lidas: ${totalLidas} | Importadas ABC: ${totalImportadas} | Ignoradas: ${totalIgnoradas}`;

    await conn.query(
      `UPDATE importacoes
       SET inicio_periodo = ?, fim_periodo = ?, situacao = 'CONCLUIDA', resumo_resultado = ?
       WHERE id_importacao = ?`,
      [dataMin, dataMax, resumo, idImportacao]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('IMPORTACAO_DADOS_OFICIAIS', ?, ?, NULL, ?)`,
      [`Importação SSP-SP (${nomeArquivo}): ${resumo}`, contaId, idImportacao]
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