import crypto from "node:crypto";
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
  {
    id_municipio: 1,
    nome: "diadema",
    codigo_ibge: "3513801",
    bbox: { latMin: -23.75, latMax: -23.63, lonMin: -46.67, lonMax: -46.56 },
  },
  {
    id_municipio: 2,
    nome: "maua",
    codigo_ibge: "3529401",
    bbox: { latMin: -23.75, latMax: -23.61, lonMin: -46.52, lonMax: -46.37 },
  },
  {
    id_municipio: 3,
    nome: "ribeirao pires",
    codigo_ibge: "3543303",
    bbox: { latMin: -23.77, latMax: -23.64, lonMin: -46.46, lonMax: -46.32 },
  },
  {
    id_municipio: 4,
    nome: "rio grande da serra",
    codigo_ibge: "3544103",
    bbox: { latMin: -23.82, latMax: -23.70, lonMin: -46.45, lonMax: -46.33 },
  },
  {
    id_municipio: 5,
    nome: "santo andre",
    codigo_ibge: "3547809",
    bbox: { latMin: -23.86, latMax: -23.58, lonMin: -46.59, lonMax: -46.27 },
  },
  {
    id_municipio: 6,
    nome: "sao bernardo do campo",
    codigo_ibge: "3548708",
    bbox: { latMin: -23.96, latMax: -23.61, lonMin: -46.69, lonMax: -46.41 },
  },
  {
    id_municipio: 7,
    nome: "sao caetano do sul",
    codigo_ibge: "3548807",
    bbox: { latMin: -23.67, latMax: -23.58, lonMin: -46.61, lonMax: -46.52 },
  },
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

function criarErroHttp(mensagem, status = 400, codigo = "ERRO_IMPORTACAO") {
  const err = new Error(mensagem);
  err.status = status;
  err.codigo = codigo;
  return err;
}

function sha256(valor) {
  return crypto.createHash("sha256").update(String(valor)).digest("hex");
}

function obterHojeBrasil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

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
      // mantém texto original se não for UTF-8 mal decodificado
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

function celulaVazia(val) {
  if (val === null || val === undefined) return true;
  const s = normalizarTexto(val);
  return (
    s === "" ||
    s === "null" ||
    s === "nan" ||
    s === "nat" ||
    s === "-" ||
    s === "n/a" ||
    s === "na" ||
    s === "ni" ||
    s === "s/i" ||
    s === "nao informado" ||
    s === "sem informacao"
  );
}

/**
 * Converte formatos numéricos/textuais comuns da SSP-SP e do Excel PT-BR:
 * - vírgula decimal: "-23,691234" -> -23.691234
 * - múltiplos pontos/vírgulas de milhar: "-23.691.234" -> -23.691234
 * - notação científica com vírgula: "-2,3691234E+07" -> -23.691234
 * - inteiros escalados sem separador decimal: -23691234 -> -23.691234
 */
function normalizarCoordenadaNumerica(raw) {
  if (raw === null || raw === undefined) return null;

  let num = null;

  if (typeof raw === "number") {
    num = Number.isFinite(raw) ? raw : null;
  } else {
    // Remove espaços normais/invisíveis (NBSP), aspas e símbolo de grau
    const s = String(raw)
      .replace(/[\u00A0\s"'°º]/g, "")
      .trim();

    if (!s) return null;

    if (/^[+-]?\d+([.,]\d+)?e[+-]?\d+$/i.test(s)) {
      // Notação científica (com ponto ou vírgula)
      num = Number(s.replace(",", "."));
    } else {
      const qtdPontos = (s.match(/\./g) || []).length;
      const qtdVirgulas = (s.match(/,/g) || []).length;

      if (qtdPontos === 0 && qtdVirgulas === 0) {
        num = Number(s);
      } else if (qtdPontos === 1 && qtdVirgulas === 0) {
        num = Number(s);
      } else if (qtdVirgulas === 1 && qtdPontos === 0) {
        num = Number(s.replace(",", "."));
      } else if (qtdPontos >= 1 && qtdVirgulas === 1 && s.lastIndexOf(",") > s.lastIndexOf(".")) {
        // Ex.: "-23.691.234,56"
        num = Number(s.replace(/\./g, "").replace(",", "."));
      } else if (qtdPontos > 1 && qtdVirgulas === 0) {
        // Ex.: "-23.691.234"
        num = Number(s.replace(/\./g, ""));
      } else if (qtdVirgulas > 1 && qtdPontos === 0) {
        // Ex.: "-23,691,234"
        num = Number(s.replace(/,/g, ""));
      } else if (qtdVirgulas >= 1 && qtdPontos === 1 && s.lastIndexOf(".") > s.lastIndexOf(",")) {
        // Ex.: "-23,691,234.56"
        num = Number(s.replace(/,/g, ""));
      }
    }
  }

  if (num === null || !Number.isFinite(num)) return null;
  if (num === 0) return 0;

  // Se o Excel removeu o ponto decimal (ex.: -23691234 ou -465643218),
  // reposiciona para a faixa de graus (-99.999... a -10.000...).
  // Exige >= 5 dígitos (10000) e sinal negativo para não distorcer valores inválidos.
  if (num < 0 && Math.abs(num) >= 10000) {
    const expoente = Math.floor(Math.log10(Math.abs(num))) - 1;
    num = num / (10 ** expoente);
  }

  return num;
}

/**
 * RN31:
 * - Ausência de coordenadas (ou 0/0 ocultado na fonte): aceita sem ponto no mapa (null, null).
 * - Formatação numérica do Excel/SSP-SP é normalizada antes de validar o município.
 * - Coordenada inconsistente ou fora dos limites do município continua bloqueando a linha.
 */
function validarCoordenadasMunicipio(latRaw, lonRaw, munObj) {
  const latVazia = celulaVazia(latRaw);
  const lonVazia = celulaVazia(lonRaw);

  if (latVazia && lonVazia) {
    return { valida: true, lat: null, lon: null, motivo: null };
  }

  const lat = latVazia ? null : normalizarCoordenadaNumerica(latRaw);
  const lon = lonVazia ? null : normalizarCoordenadaNumerica(lonRaw);

  // Na SSP-SP, 0 (ou 0 combinado com vazio) indica dado ocultado na fonte (RN31)
  if ((latVazia || lat === 0) && (lonVazia || lon === 0)) {
    return { valida: true, lat: null, lon: null, motivo: null };
  }

  if (latVazia !== lonVazia) {
    return {
      valida: false,
      lat: null,
      lon: null,
      motivo: `Coordenadas incompletas (lat: "${latRaw ?? ""}", lon: "${lonRaw ?? ""}").`,
    };
  }

  if (lat === null || lon === null) {
    return {
      valida: false,
      lat: null,
      lon: null,
      motivo: `Coordenadas em formato numérico inválido (lat: "${latRaw}", lon: "${lonRaw}").`,
    };
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || lat === 0 || lon === 0) {
    return {
      valida: false,
      lat: null,
      lon: null,
      motivo: `Coordenadas inválidas (lat: "${latRaw}", lon: "${lonRaw}").`,
    };
  }

  const { bbox } = munObj;
  const dentroMunicipio =
    lat >= bbox.latMin &&
    lat <= bbox.latMax &&
    lon >= bbox.lonMin &&
    lon <= bbox.lonMax;

  if (!dentroMunicipio) {
    return {
      valida: false,
      lat: null,
      lon: null,
      motivo: `Coordenadas (${lat.toFixed(5)}, ${lon.toFixed(5)}) incompatíveis com o município ${munObj.nome}.`,
    };
  }

  return {
    valida: true,
    lat: Number(lat.toFixed(8)),
    lon: Number(lon.toFixed(8)),
    motivo: null,
  };
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

function validarPeriodoInformado(inicioPeriodo, fimPeriodo) {
  const inicio = inicioPeriodo ? sanitizarData(inicioPeriodo) : null;
  const fim = fimPeriodo ? sanitizarData(fimPeriodo) : null;

  if (inicioPeriodo && !inicio) {
    throw criarErroHttp("Data de início do período inválida.", 422, "PERIODO_INVALIDO");
  }
  if (fimPeriodo && !fim) {
    throw criarErroHttp("Data de fim do período inválida.", 422, "PERIODO_INVALIDO");
  }
  if (inicio && fim && inicio > fim) {
    throw criarErroHttp(
      "O início do período da importação não pode ser posterior ao fim.",
      422,
      "PERIODO_INVALIDO"
    );
  }
  return { inicio, fim };
}

/**
 * RN12, RN15 e RN17:
 * Identifica o registro sem mesclar classificações/datas distintas do mesmo boletim.
 */
function gerarIdentidadeCrime(reg) {
  const dataRef = reg.dataOcorrencia || reg.dataRegistro || "";
  const baseChave = reg.numBo
    ? [
        "ssp",
        reg.codIbge,
        normalizarTexto(reg.numBo),
        normalizarTexto(reg.rubrica),
        normalizarTexto(reg.naturezaApurada),
        dataRef,
      ].join("|")
    : [
        "ssp_sem_bo",
        reg.codIbge,
        dataRef,
        reg.horaOcorrencia || "",
        normalizarTexto(reg.bairro),
        normalizarTexto(reg.rubrica),
        normalizarTexto(reg.naturezaApurada),
      ].join("|");

  const baseConteudo = [
    normalizarTexto(reg.nomeDepartamento),
    reg.dataRegistro || "",
    reg.dataOcorrencia || "",
    reg.horaOcorrencia || "",
    normalizarTexto(reg.bairro),
    reg.latitude ?? "",
    reg.longitude ?? "",
    normalizarTexto(reg.descrConduta),
  ].join("|");

  return {
    chaveIdentificacao: sha256(baseChave),
    hashConteudo: sha256(baseConteudo),
  };
}

function gerarIdentidadeCenso(reg) {
  const baseChave = [
    "ibge",
    reg.anoCenso,
    reg.nivel,
    reg.codIbge,
    normalizarTexto(reg.bairro || ""),
  ].join("|");

  const baseConteudo = String(reg.populacao);

  return {
    chaveIdentificacao: sha256(baseChave),
    hashConteudo: sha256(baseConteudo),
  };
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
        INDEX idx_item_importacao_resultado (fk_id_importacao, resultado),
        UNIQUE KEY uq_item_importacao_linha (fk_id_importacao, nome_aba, numero_linha),
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
        chave_identificacao CHAR(64) NULL,
        hash_conteudo CHAR(64) NULL,
        fk_id_municipio INT NOT NULL,
        fk_id_importacao INT NOT NULL,
        fk_id_item_origem INT NOT NULL UNIQUE,
        INDEX idx_censo_municipio_bairro (nome_municipio, bairro),
        INDEX idx_censo_cod_ibge (cod_ibge),
        INDEX idx_censo_importacao (fk_id_importacao),
        INDEX idx_censo_ativo (ativo),
        INDEX idx_censo_chave (chave_identificacao),
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
        chave_identificacao CHAR(64) NULL,
        hash_conteudo CHAR(64) NULL,
        fk_id_municipio INT,
        fk_id_importacao INT,
        fk_id_item_origem INT UNIQUE,
        INDEX idx_ocorrencias_data (data_ocorrencia_bo),
        INDEX idx_ocorrencias_cod_ibge (cod_ibge),
        INDEX idx_ocorrencias_municipio_bairro (nome_municipio, bairro),
        INDEX idx_ocorrencias_natureza (natureza_apurada),
        INDEX idx_ocorrencias_lat_lng (latitude, longitude),
        INDEX idx_ocorrencias_importacao (fk_id_importacao),
        INDEX idx_ocorrencias_ativo (ativo),
        INDEX idx_ocorrencias_chave (chave_identificacao)
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
    if (!colsCenso.has("chave_identificacao")) {
      await conn.query("ALTER TABLE censo_demografico ADD COLUMN chave_identificacao CHAR(64) NULL, ADD INDEX idx_censo_chave (chave_identificacao)");
    }
    if (!colsCenso.has("hash_conteudo")) {
      await conn.query("ALTER TABLE censo_demografico ADD COLUMN hash_conteudo CHAR(64) NULL");
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
    if (!colsReg.has("chave_identificacao")) {
      await conn.query("ALTER TABLE registro_oficial ADD COLUMN chave_identificacao CHAR(64) NULL, ADD INDEX idx_ocorrencias_chave (chave_identificacao)");
    }
    if (!colsReg.has("hash_conteudo")) {
      await conn.query("ALTER TABLE registro_oficial ADD COLUMN hash_conteudo CHAR(64) NULL");
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

    // RN06: admin_geral não possui vínculo municipal (fk_id_municipio = NULL)
    await conn.query(
      `INSERT IGNORE INTO contas (id_conta, nome, email, senha_hash, perfil, fk_id_municipio)
       VALUES (1, 'Administrador AlertABC', 'admin@alertabc.local', 'IMPORTACAO_ETL_SISTEMA', 'admin_geral', NULL)`
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

async function inserirLoteItens(conn, idImportacao, nomeAba, itensLote) {
  if (itensLote.length === 0) return;

  const valores = itensLote.map((it) => [
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
    [valores]
  );
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

async function carregarChavesExistentesCenso(conn) {
  const [rows] = await conn.query(`
    SELECT ano_censo, nivel_territorial, cod_ibge, bairro, populacao, chave_identificacao, hash_conteudo
    FROM censo_demografico
    WHERE ativo = 1
  `);

  const mapa = new Map();
  for (const r of rows) {
    let chave = r.chave_identificacao;
    let hash = r.hash_conteudo;
    if (!chave || !hash) {
      const id = gerarIdentidadeCenso({
        anoCenso: r.ano_censo,
        nivel: r.nivel_territorial,
        codIbge: r.cod_ibge,
        bairro: r.bairro,
        populacao: Number(r.populacao),
      });
      chave = id.chaveIdentificacao;
      hash = id.hashConteudo;
    }
    mapa.set(chave, hash);
  }
  return mapa;
}

async function carregarChavesExistentesCrimes(conn) {
  const [rows] = await conn.query(`
    SELECT
      nome_departamento, cod_ibge, num_bo, rubrica, descr_conduta, natureza_apurada,
      DATE_FORMAT(data_ocorrencia_bo, '%Y-%m-%d') AS data_ocorrencia_bo,
      DATE_FORMAT(data_registro, '%Y-%m-%d') AS data_registro,
      TIME_FORMAT(hora_ocorrencia_bo, '%H:%i:%s') AS hora_ocorrencia_bo,
      bairro, latitude, longitude, chave_identificacao, hash_conteudo
    FROM registro_oficial
    WHERE ativo = 1
  `);

  const mapa = new Map();
  for (const r of rows) {
    let chave = r.chave_identificacao;
    let hash = r.hash_conteudo;
    if (!chave || !hash) {
      const id = gerarIdentidadeCrime({
        codIbge: r.cod_ibge,
        numBo: r.num_bo,
        rubrica: r.rubrica,
        naturezaApurada: r.natureza_apurada,
        dataOcorrencia: r.data_ocorrencia_bo,
        dataRegistro: r.data_registro,
        horaOcorrencia: r.hora_ocorrencia_bo,
        nomeDepartamento: r.nome_departamento,
        bairro: r.bairro,
        latitude: r.latitude !== null ? Number(r.latitude) : null,
        longitude: r.longitude !== null ? Number(r.longitude) : null,
        descrConduta: r.descr_conduta,
      });
      chave = id.chaveIdentificacao;
      hash = id.hashConteudo;
    }
    mapa.set(chave, hash);
  }
  return mapa;
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

async function registrarErroImportacao(idImportacao, mensagemErro) {
  if (!idImportacao) return;
  try {
    await alertabcPool.query(
      `UPDATE importacoes SET situacao = 'ERRO', resumo_resultado = ? WHERE id_importacao = ?`,
      [`Falha na conferência: ${String(mensagemErro).slice(0, 1000)}`, idImportacao]
    );
  } catch {
    // evita mascarar o erro principal
  }
}

/**
 * ETAPA 1 (RF04, RF05, RN10, RN12, RN13, RN15):
 * Confere a planilha do Censo IBGE e gera prévia (AGUARDANDO_CONFIRMACAO) sem publicar.
 */
export async function importarPlanilhaCenso({
  caminhoArquivo,
  nomeArquivo,
  paginaOrigem,
  anoCenso,
  inicioPeriodo,
  fimPeriodo,
  contaId,
}) {
  await garantirEstruturaImportacoes();
  const ano = Number(anoCenso) || 2022;
  const periodo = validarPeriodoInformado(inicioPeriodo, fimPeriodo);
  const ini = periodo.inicio || `${ano}-01-01`;
  const fim = periodo.fim || `${ano}-12-31`;

  // Cabeçalho criado fora da transação de itens para preservar histórico de ERRO (RN13)
  const [resImp] = await alertabcPool.query(
    `INSERT INTO importacoes
      (nome_arquivo, caminho_arquivo, pagina_origem, inicio_periodo, fim_periodo, situacao, resumo_resultado, fk_id_conta_responsavel, fk_id_fonte)
     VALUES (?, ?, ?, ?, ?, 'EM_PROCESSO', NULL, ?, 1)`,
    [
      nomeArquivo,
      caminhoArquivo,
      paginaOrigem || "https://sidra.ibge.gov.br/tabela/9922",
      ini,
      fim,
      contaId,
    ]
  );
  const idImportacao = resImp.insertId;

  const conn = await alertabcPool.getConnection();
  try {
    await conn.beginTransaction();

    const chavesBanco = await carregarChavesExistentesCenso(conn);
    const chavesArquivo = new Map();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(caminhoArquivo);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw criarErroHttp("A planilha do Censo IBGE não possui abas válidas.", 422, "ESTRUTURA_INVALIDA");
    }

    const nomeAba = worksheet.name;
    let totalLidas = 0;
    let totalAceitos = 0;
    let totalDuplicados = 0;
    let totalConflitantes = 0;
    let totalProblemas = 0;
    let totalForaRegiao = 0;
    let lote = [];

    const descarregar = async () => {
      if (lote.length === 0) return;
      const bloco = lote;
      lote = [];
      await inserirLoteItens(conn, idImportacao, nomeAba, bloco);
    };

    for (let rowNumber = 6; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const localidadeRaw = extrairValorCelula(row.getCell(1).value);
      const populacaoRaw = extrairValorCelula(row.getCell(2).value);
      if (celulaVazia(localidadeRaw)) continue;

      totalLidas++;
      const localLimpo = normalizarTexto(localidadeRaw);
      if (localLimpo.includes("bairro") && String(populacaoRaw || "").toLowerCase().includes("total")) {
        continue;
      }

      const popValor = parseNumero(populacaoRaw);
      let nivel = null;
      let mun = null;
      let bairro = null;
      let municipioInformado = null;

      if (localLimpo.includes(" - ")) {
        const idxSep = localLimpo.lastIndexOf(" - ");
        const bairroParte = localLimpo.slice(0, idxSep);
        const cidadeParte = localLimpo.slice(idxSep + 3).replace("(sp)", "").trim();
        municipioInformado = cidadeParte;
        mun = MUNICIPIO_POR_NOME.get(cidadeParte);
        bairro = limparBairro(bairroParte);
        nivel = "bairro";
      } else {
        const cidadeLimpa = localLimpo.replace("(sp)", "").trim();
        municipioInformado = cidadeLimpa;
        mun = MUNICIPIO_POR_NOME.get(cidadeLimpa);
        nivel = "municipio";
      }

      if (!mun) {
        totalForaRegiao++;
        continue;
      }

      if (popValor === null || popValor < 0) {
        totalProblemas++;
        lote.push({
          numeroLinha: rowNumber,
          dadosRecebidos: JSON.stringify({
            localidade: corrigirEncoding(localidadeRaw),
            populacao: populacaoRaw,
          }),
          resultado: "PROBLEMA",
          motivo: "População ausente ou em formato numérico inválido.",
          municipioInformado: mun.nome,
        });
      } else if (nivel === "bairro" && !bairro) {
        totalProblemas++;
        lote.push({
          numeroLinha: rowNumber,
          dadosRecebidos: JSON.stringify({
            localidade: corrigirEncoding(localidadeRaw),
            populacao: Math.trunc(popValor),
          }),
          resultado: "PROBLEMA",
          motivo: "Nome do bairro inválido ou descartado pela padronização.",
          municipioInformado: mun.nome,
        });
      } else {
        const registro = {
          anoCenso: ano,
          nivel,
          codIbge: mun.codigo_ibge,
          nomeMunicipio: mun.nome,
          bairro: nivel === "bairro" ? bairro : null,
          populacao: Math.trunc(popValor),
          fkIdMunicipio: mun.id_municipio,
        };
        const { chaveIdentificacao, hashConteudo } = gerarIdentidadeCenso(registro);
        registro.chaveIdentificacao = chaveIdentificacao;
        registro.hashConteudo = hashConteudo;

        let resultado = "ACEITO";
        let motivo = null;

        if (chavesBanco.has(chaveIdentificacao)) {
          if (chavesBanco.get(chaveIdentificacao) === hashConteudo) {
            resultado = "DUPLICADO";
            motivo = "Registro já publicado anteriormente com a mesma população.";
            totalDuplicados++;
          } else {
            resultado = "CONFLITANTE";
            motivo = "Registro já existente na base com valor de população diferente (dado atual preservado).";
            totalConflitantes++;
          }
        } else if (chavesArquivo.has(chaveIdentificacao)) {
          if (chavesArquivo.get(chaveIdentificacao) === hashConteudo) {
            resultado = "DUPLICADO";
            motivo = "Linha repetida dentro da própria planilha.";
            totalDuplicados++;
          } else {
            resultado = "CONFLITANTE";
            motivo = "Mesma localidade repetida no arquivo com população divergente.";
            totalConflitantes++;
          }
        } else {
          chavesArquivo.set(chaveIdentificacao, hashConteudo);
          totalAceitos++;
        }

        lote.push({
          numeroLinha: rowNumber,
          dadosRecebidos: JSON.stringify(registro),
          resultado,
          motivo,
          municipioInformado: mun.nome,
        });
      }

      if (lote.length >= TAMANHO_LOTE) {
        await descarregar();
      }
    }

    await descarregar();

    if (totalAceitos + totalDuplicados + totalConflitantes + totalProblemas === 0) {
      throw criarErroHttp(
        "Nenhum município ou bairro do Grande ABC foi encontrado na planilha do Censo IBGE.",
        422,
        "ESTRUTURA_INVALIDA"
      );
    }

    const resumo =
      `Conferência IBGE — Lidas: ${totalLidas} | Aceitos: ${totalAceitos} | Duplicados: ${totalDuplicados} | Conflitantes: ${totalConflitantes} | Problemas: ${totalProblemas} | Fora do ABC: ${totalForaRegiao}`;

    await conn.query(
      `UPDATE importacoes SET situacao = 'AGUARDANDO_CONFIRMACAO', resumo_resultado = ? WHERE id_importacao = ?`,
      [resumo, idImportacao]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('CONFERENCIA_CENSO_IBGE', ?, ?, NULL, ?)`,
      [`Prévia gerada (${nomeArquivo}): ${resumo}`, contaId, idImportacao]
    );

    await conn.commit();

    return {
      id_importacao: idImportacao,
      tipo: "censo",
      situacao: "AGUARDANDO_CONFIRMACAO",
      podeConfirmar: totalAceitos > 0,
      resumo,
      totais: {
        lidas: totalLidas,
        aceitos: totalAceitos,
        duplicados: totalDuplicados,
        conflitantes: totalConflitantes,
        problemas: totalProblemas,
        foraRegiao: totalForaRegiao,
      },
    };
  } catch (error) {
    await conn.rollback();
    await registrarErroImportacao(idImportacao, error.message);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * ETAPA 1 (RF04, RF05, RN10, RN11, RN12, RN13, RN15, RN16, RN17, RN29, RN31):
 * Confere a planilha da SSP-SP em stream e gera prévia (AGUARDANDO_CONFIRMACAO) sem publicar.
 */
export async function importarPlanilhaCrimes({
  caminhoArquivo,
  nomeArquivo,
  paginaOrigem,
  inicioPeriodo,
  fimPeriodo,
  contaId,
}) {
  await garantirEstruturaImportacoes();
  const periodo = validarPeriodoInformado(inicioPeriodo, fimPeriodo);
  const hojeIso = obterHojeBrasil();

  const [resImp] = await alertabcPool.query(
    `INSERT INTO importacoes
      (nome_arquivo, caminho_arquivo, pagina_origem, inicio_periodo, fim_periodo, situacao, resumo_resultado, fk_id_conta_responsavel, fk_id_fonte)
     VALUES (?, ?, ?, ?, ?, 'EM_PROCESSO', NULL, ?, 2)`,
    [
      nomeArquivo,
      caminhoArquivo,
      paginaOrigem || "https://www.ssp.sp.gov.br/estatistica/consultas",
      periodo.inicio,
      periodo.fim,
      contaId,
    ]
  );
  const idImportacao = resImp.insertId;

  const conn = await alertabcPool.getConnection();
  try {
    await conn.beginTransaction();

    const censo = await carregarCensoDoBanco(conn);
    const resolverBairro = criarResolvedorBairro(censo.bairrosPorMunicipio);
    const chavesBanco = await carregarChavesExistentesCrimes(conn);
    const chavesArquivo = new Map();

    let totalLidas = 0;
    let totalAceitos = 0;
    let totalDuplicados = 0;
    let totalConflitantes = 0;
    let totalProblemas = 0;
    let totalForaRegiao = 0;
    let cabecalhoEncontrado = false;
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
        await inserirLoteItens(conn, idImportacao, nomeAba, bloco);
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
            cabecalhoEncontrado = true;
          }
          continue;
        }

        const pegar = (nome) => {
          const idx = mapaColunas.get(nome);
          return idx ? extrairValorCelula(row.values[idx]) : null;
        };

        const munRaw = pegar("nome_municipio");
        if (celulaVazia(munRaw) && celulaVazia(pegar("num_bo")) && celulaVazia(pegar("natureza_apurada"))) {
          continue;
        }

        totalLidas++;
        const munNormalizado = normalizarMunicipio(munRaw);
        const munObj = MUNICIPIO_POR_NOME.get(munNormalizado);

        // RN29: municípios fora do Grande ABC não entram na base da região
        if (!munObj) {
          totalForaRegiao++;
          continue;
        }

        const nomeDepartamento = limparStrOuNull(pegar("nome_departamento"));
        const dataOcorrenciaRaw = pegar("data_ocorrencia_bo");
        const dataRegistroRaw = pegar("data_registro");
        const dataOcorrencia = sanitizarData(dataOcorrenciaRaw);
        const dataRegistro = sanitizarData(dataRegistroRaw);
        const horaOcorrencia = sanitizarHora(pegar("hora_ocorrencia_bo"));
        const numBo = limparStrOuNull(pegar("num_bo"));
        const bairroRaw = pegar("bairro");
        const bairroMatch = resolverBairro(munObj.nome, bairroRaw) || null;
        const rubrica = limparStrOuNull(pegar("rubrica"));
        const descrConduta = limparStrOuNull(pegar("descr_conduta"));
        const naturezaApurada = limparStrOuNull(pegar("natureza_apurada"));

        // Validações de linha (RN11, RN16, RN31, RNF10)
        const motivosProblema = [];

        if (!naturezaApurada && !rubrica) {
          motivosProblema.push("Classificação ausente (NATUREZA_APURADA e RUBRICA vazias).");
        }

        if (!dataOcorrencia && !dataRegistro) {
          motivosProblema.push("Referência de data ausente ou inválida (DATA_OCORRENCIA_BO e DATA_REGISTRO).");
        } else {
          if (dataOcorrencia && dataOcorrencia > hojeIso) {
            motivosProblema.push(`Data da ocorrência no futuro (${dataOcorrencia}).`);
          }
          if (dataRegistro && dataRegistro > hojeIso) {
            motivosProblema.push(`Data de registro no futuro (${dataRegistro}).`);
          }
        }

        const coord = validarCoordenadasMunicipio(pegar("latitude"), pegar("longitude"), munObj);
        if (!coord.valida) {
          motivosProblema.push(coord.motivo);
        }

        const codIbgeInt = Number(munObj.codigo_ibge);
        const popBairro = bairroMatch
          ? (censo.populacaoPorBairro.get(`${munObj.codigo_ibge}|${munObj.nome}|${bairroMatch}`) ?? null)
          : null;
        const popMunicipio = censo.populacaoPorMunicipio.get(munObj.nome) ?? null;

        const registro = {
          nomeDepartamento,
          nomeMunicipio: munObj.nome,
          dataOcorrencia,
          dataRegistro,
          horaOcorrencia,
          numBo,
          bairro: bairroMatch,
          latitude: coord.lat,
          longitude: coord.lon,
          rubrica,
          descrConduta,
          naturezaApurada,
          codIbge: codIbgeInt,
          populacaoBairro: popBairro,
          populacaoMunicipio: popMunicipio,
          fkIdMunicipio: munObj.id_municipio,
        };

        let resultado = "ACEITO";
        let motivo = null;

        if (motivosProblema.length > 0) {
          resultado = "PROBLEMA";
          motivo = motivosProblema.join(" ").slice(0, 255);
          totalProblemas++;
        } else {
          const { chaveIdentificacao, hashConteudo } = gerarIdentidadeCrime(registro);
          registro.chaveIdentificacao = chaveIdentificacao;
          registro.hashConteudo = hashConteudo;

          if (chavesBanco.has(chaveIdentificacao)) {
            if (chavesBanco.get(chaveIdentificacao) === hashConteudo) {
              resultado = "DUPLICADO";
              motivo = "Registro já publicado anteriormente com os mesmos dados.";
              totalDuplicados++;
            } else {
              resultado = "CONFLITANTE";
              motivo = "Mesma identificação de boletim/classificação já existe com dados divergentes (registro atual preservado).";
              totalConflitantes++;
            }
          } else if (chavesArquivo.has(chaveIdentificacao)) {
            if (chavesArquivo.get(chaveIdentificacao) === hashConteudo) {
              resultado = "DUPLICADO";
              motivo = "Linha duplicada dentro da própria planilha.";
              totalDuplicados++;
            } else {
              resultado = "CONFLITANTE";
              motivo = "Mesma identificação repetida na planilha com dados divergentes.";
              totalConflitantes++;
            }
          } else {
            chavesArquivo.set(chaveIdentificacao, hashConteudo);
            totalAceitos++;
            const dataRef = dataOcorrencia || dataRegistro;
            if (dataRef) {
              if (!dataMin || dataRef < dataMin) dataMin = dataRef;
              if (!dataMax || dataRef > dataMax) dataMax = dataRef;
            }
          }
        }

        lote.push({
          numeroLinha: row.number,
          dadosRecebidos: JSON.stringify(registro),
          resultado,
          motivo,
          municipioInformado: limparStrOuNull(munRaw),
        });

        if (lote.length >= TAMANHO_LOTE) {
          await descarregar();
        }
      }

      await descarregar();
    }

    if (!cabecalhoEncontrado || totalLidas === 0) {
      throw criarErroHttp(
        "Estrutura incompatível com SSP-SP (coluna obrigatória NOME_MUNICIPIO ausente ou planilha vazia).",
        422,
        "ESTRUTURA_INVALIDA"
      );
    }

    const inicioFinal = periodo.inicio || dataMin;
    const fimFinal = periodo.fim || dataMax;

    const resumo =
      `Conferência SSP-SP — Lidas: ${totalLidas} | Aceitos: ${totalAceitos} | Duplicados: ${totalDuplicados} | Conflitantes: ${totalConflitantes} | Problemas: ${totalProblemas} | Fora do ABC: ${totalForaRegiao}`;

    await conn.query(
      `UPDATE importacoes
       SET inicio_periodo = ?, fim_periodo = ?, situacao = 'AGUARDANDO_CONFIRMACAO', resumo_resultado = ?
       WHERE id_importacao = ?`,
      [inicioFinal, fimFinal, resumo, idImportacao]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('CONFERENCIA_DADOS_OFICIAIS', ?, ?, NULL, ?)`,
      [`Prévia SSP-SP (${nomeArquivo}): ${resumo}`, contaId, idImportacao]
    );

    await conn.commit();

    return {
      id_importacao: idImportacao,
      tipo: "ssp",
      situacao: "AGUARDANDO_CONFIRMACAO",
      podeConfirmar: totalAceitos > 0,
      resumo,
      inicio_periodo: inicioFinal,
      fim_periodo: fimFinal,
      totais: {
        lidas: totalLidas,
        aceitos: totalAceitos,
        duplicados: totalDuplicados,
        conflitantes: totalConflitantes,
        problemas: totalProblemas,
        foraRegiao: totalForaRegiao,
      },
    };
  } catch (error) {
    await conn.rollback();
    await registrarErroImportacao(idImportacao, error.message);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * ETAPA 2A (RF06, RN13, RN14, RN15, RN27):
 * Publica apenas os itens ACEITO de uma importação em AGUARDANDO_CONFIRMACAO.
 */
export async function confirmarImportacao({ idImportacao, contaId }) {
  await garantirEstruturaImportacoes();
  const conn = await alertabcPool.getConnection();

  try {
    await conn.beginTransaction();

    const [[imp]] = await conn.query(
      `SELECT id_importacao, nome_arquivo, situacao, fk_id_fonte
       FROM importacoes
       WHERE id_importacao = ?
       FOR UPDATE`,
      [idImportacao]
    );

    if (!imp) {
      throw criarErroHttp("Importação não encontrada.", 404, "NAO_ENCONTRADA");
    }

    if (imp.situacao !== "AGUARDANDO_CONFIRMACAO") {
      throw criarErroHttp(
        `A importação #${idImportacao} está com situação '${imp.situacao}' e não pode ser confirmada novamente.`,
        409,
        "SITUACAO_INVALIDA"
      );
    }

    const [[contagem]] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM item_importacao
       WHERE fk_id_importacao = ? AND resultado = 'ACEITO'`,
      [idImportacao]
    );

    if (Number(contagem.total) === 0) {
      throw criarErroHttp(
        "Não é possível publicar: a conferência não possui nenhum registro aceito.",
        422,
        "NENHUM_REGISTRO_ACEITO"
      );
    }

    const ehCenso = Number(imp.fk_id_fonte) === 1;
    const chavesAtuais = ehCenso
      ? await carregarChavesExistentesCenso(conn)
      : await carregarChavesExistentesCrimes(conn);

    let ultimoId = 0;
    let totalPublicados = 0;

    while (true) {
      const [itens] = await conn.query(
        `SELECT id_item_importacao, dados_recebidos
         FROM item_importacao
         WHERE fk_id_importacao = ? AND resultado = 'ACEITO' AND id_item_importacao > ?
         ORDER BY id_item_importacao ASC
         LIMIT ?`,
        [idImportacao, ultimoId, TAMANHO_LOTE]
      );

      if (itens.length === 0) break;
      ultimoId = itens[itens.length - 1].id_item_importacao;

      const parsed = itens.map((row) => ({
        idItem: row.id_item_importacao,
        reg: JSON.parse(row.dados_recebidos),
      }));

      // RN15: se os dados da base mudaram após a prévia, exige nova conferência
      for (const { reg } of parsed) {
        if (reg.chaveIdentificacao && chavesAtuais.has(reg.chaveIdentificacao)) {
          throw criarErroHttp(
            "Os dados publicados foram alterados após a prévia desta importação. Execute uma nova conferência antes de publicar.",
            409,
            "BASE_ALTERADA_APOS_PREVIA"
          );
        }
      }

      if (ehCenso) {
        const valores = parsed.map(({ idItem, reg }) => [
          reg.anoCenso,
          reg.nivel,
          reg.codIbge,
          reg.nomeMunicipio,
          reg.bairro,
          reg.populacao,
          1,
          reg.chaveIdentificacao,
          reg.hashConteudo,
          reg.fkIdMunicipio,
          idImportacao,
          idItem,
        ]);

        await conn.query(
          `INSERT INTO censo_demografico
            (ano_censo, nivel_territorial, cod_ibge, nome_municipio, bairro, populacao, ativo, chave_identificacao, hash_conteudo, fk_id_municipio, fk_id_importacao, fk_id_item_origem)
           VALUES ?`,
          [valores]
        );
      } else {
        const valores = parsed.map(({ idItem, reg }) => [
          reg.nomeDepartamento,
          reg.nomeMunicipio,
          reg.dataOcorrencia,
          reg.dataRegistro,
          reg.horaOcorrencia,
          reg.numBo,
          reg.bairro,
          reg.latitude,
          reg.longitude,
          reg.rubrica,
          reg.descrConduta,
          reg.naturezaApurada,
          reg.codIbge,
          reg.populacaoBairro,
          reg.populacaoMunicipio,
          1,
          reg.chaveIdentificacao,
          reg.hashConteudo,
          reg.fkIdMunicipio,
          idImportacao,
          idItem,
        ]);

        await conn.query(
          `INSERT INTO registro_oficial
            (nome_departamento, nome_municipio, data_ocorrencia_bo, data_registro, hora_ocorrencia_bo, num_bo, bairro, latitude, longitude, rubrica, descr_conduta, natureza_apurada, cod_ibge, populacao_bairro, populacao_municipio, ativo, chave_identificacao, hash_conteudo, fk_id_municipio, fk_id_importacao, fk_id_item_origem)
           VALUES ?`,
          [valores]
        );
      }

      totalPublicados += parsed.length;
    }

    if (ehCenso) {
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
            `UPDATE registro_oficial SET bairro = ? WHERE nome_municipio = ? AND bairro = ?`,
            [bairroMatch, item.nome_municipio, item.bairro]
          );
        }
      }
      await recalcularPopulacaoRegistros(conn);
    } else {
      await conn.query(
        `UPDATE registro_oficial
         SET geom = ST_GeomFromText(CONCAT('POINT(', longitude, ' ', latitude, ')'))
         WHERE fk_id_importacao = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
        [idImportacao]
      );
    }

    await conn.query(
      `UPDATE importacoes
       SET situacao = 'PUBLICADA',
           resumo_resultado = CONCAT(COALESCE(resumo_resultado, ''), ' | Publicados: ', ?)
       WHERE id_importacao = ?`,
      [totalPublicados, idImportacao]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES (?, ?, ?, NULL, ?)`,
      [
        ehCenso ? "IMPORTACAO_CENSO_IBGE" : "IMPORTACAO_DADOS_OFICIAIS",
        `Publicação confirmada (${imp.nome_arquivo}): ${totalPublicados} registros publicados.`,
        contaId,
        idImportacao,
      ]
    );

    await conn.commit();

    return {
      id_importacao: idImportacao,
      situacao: "PUBLICADA",
      totalPublicados,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * ETAPA 2B (RF06, RN13, RN14, RN27):
 * Cancela uma importação que aguarda confirmação sem publicar nenhum registro.
 */
export async function cancelarImportacao({ idImportacao, contaId }) {
  await garantirEstruturaImportacoes();
  const conn = await alertabcPool.getConnection();

  try {
    await conn.beginTransaction();

    const [[imp]] = await conn.query(
      `SELECT id_importacao, nome_arquivo, situacao
       FROM importacoes
       WHERE id_importacao = ?
       FOR UPDATE`,
      [idImportacao]
    );

    if (!imp) {
      throw criarErroHttp("Importação não encontrada.", 404, "NAO_ENCONTRADA");
    }

    if (imp.situacao !== "AGUARDANDO_CONFIRMACAO") {
      throw criarErroHttp(
        `Somente importações aguardando confirmação podem ser canceladas (situação atual: '${imp.situacao}').`,
        409,
        "SITUACAO_INVALIDA"
      );
    }

    await conn.query(
      `UPDATE importacoes SET situacao = 'CANCELADA' WHERE id_importacao = ?`,
      [idImportacao]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('CANCELAMENTO_IMPORTACAO', ?, ?, NULL, ?)`,
      [`Importação cancelada antes da publicação (${imp.nome_arquivo}).`, contaId, idImportacao]
    );

    await conn.commit();

    return {
      id_importacao: idImportacao,
      situacao: "CANCELADA",
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Consulta paginada dos itens da conferência (RF05 / RF07 / RNF10).
 */
export async function listarItensImportacao(idImportacao, { resultado, limite = 50, offset = 0 } = {}) {
  await garantirEstruturaImportacoes();

  const [resumoLinhas] = await alertabcPool.query(
    `SELECT resultado, COUNT(*) AS total
     FROM item_importacao
     WHERE fk_id_importacao = ?
     GROUP BY resultado`,
    [idImportacao]
  );

  const filtros = ["fk_id_importacao = ?"];
  const params = [idImportacao];

  if (resultado && ["ACEITO", "DUPLICADO", "CONFLITANTE", "PROBLEMA"].includes(String(resultado).toUpperCase())) {
    filtros.push("resultado = ?");
    params.push(String(resultado).toUpperCase());
  }

  const lim = Math.min(Math.max(Number(limite) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const [itens] = await alertabcPool.query(
    `SELECT id_item_importacao, nome_aba, numero_linha, resultado, motivo, municipio_informado, dados_recebidos
     FROM item_importacao
     WHERE ${filtros.join(" AND ")}
     ORDER BY numero_linha ASC
     LIMIT ? OFFSET ?`,
    [...params, lim, off]
  );

  return {
    contagemPorResultado: Object.fromEntries(resumoLinhas.map((r) => [r.resultado, Number(r.total)])),
    itens: itens.map((it) => ({
      ...it,
      dados_recebidos: it.dados_recebidos ? JSON.parse(it.dados_recebidos) : null,
    })),
  };
}