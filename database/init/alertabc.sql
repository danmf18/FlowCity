
SHOW DATABASES;

CREATE DATABASE IF NOT EXISTS alertabc;

USE alertabc;

SET FOREIGN_KEY_CHECKS = 0;


SELECT DATABASE();

SHOW CREATE DATABASE alertabc;

SHOW TABLES;


-- ==================== MUNICÍPIOS ====================

CREATE TABLE municipios(

    id_municipio INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(100) NOT NULL UNIQUE,

    codigo_ibge CHAR(7) NOT NULL UNIQUE

);

INSERT INTO municipios (nome, codigo_ibge) VALUES

    ('São Bernardo do Campo', '3548708'),

    ('Santo André', '3547809'),

    ('São Caetano do Sul', '3548807'),

    ('Diadema', '3513801'),

    ('Mauá', '3529401'),

    ('Ribeirão Pires', '3543303'),

    ('Rio Grande da Serra', '3544103');

SELECT * FROM municipios
ORDER BY id_municipio ASC;


-- ==================== CATEGORIAS ====================

CREATE TABLE categorias(

    id_categoria INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(100) NOT NULL UNIQUE

);

INSERT INTO categorias (nome) VALUES

    ('Apreensão de Entorpecentes'),

    ('Estupro'),

    ('Estupro de Vulnerável'),

    ('Extorsão Mediante Sequestro'),

    ('Furto - Outros'),

    ('Furto de Carga'),

    ('Furto de Veículo'),

    ('Homicídio Culposo Outros'),

    ('Homicídio Culposo por Acidente de Trânsito'),

    ('Homicídio Doloso'),

    ('Homicídio Doloso por Acidente de Trânsito'),

    ('Latrocínio'),

    ('Lesão Corporal Culposa - Outras'),

    ('Lesão Corporal Culposa por Acidente de Trânsito'),

    ('Lesão Corporal Dolosa'),

    ('Lesão Corporal Seguida de Morte'),

    ('Porte de Arma'),

    ('Porte de Entorpecentes'),

    ('Roubo - Outros'),

    ('Roubo de Carga'),

    ('Roubo de Veículo'),

    ('Tentativa de Homicídio'),

    ('Tráfico de Entorpecentes');

SELECT * FROM categorias
ORDER BY id_categoria ASC;


-- ==================== FONTES ====================

CREATE TABLE fontes(

    id_fonte INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(150) NOT NULL UNIQUE

);

INSERT INTO fontes (nome) VALUES

    ('Secretaria da Segurança Pública de São Paulo (SSP-SP)');

SELECT * FROM fontes
ORDER BY id_fonte ASC;


-- ==================== CONTAS ====================

CREATE TABLE contas(

    id_conta INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(150) NOT NULL,

    email VARCHAR(254) NOT NULL UNIQUE,

    senha_hash VARCHAR(255) NOT NULL,

    perfil VARCHAR(30) NOT NULL,

    fk_id_municipio INT,


    -- Permite somente os três perfis definidos.

    CONSTRAINT chk_perfil_valido CHECK (

        perfil IN (
            'cidadao',
            'admin_municipal',
            'admin_geral'
        )

    ),


    -- Administrador municipal precisa ter município.
    -- Cidadão e administrador geral não possuem vínculo municipal.

    CONSTRAINT chk_perfil_municipio CHECK (

        (perfil = 'admin_municipal'
         AND fk_id_municipio IS NOT NULL)

        OR

        (perfil IN ('cidadao', 'admin_geral')
         AND fk_id_municipio IS NULL)

    ),


    FOREIGN KEY (fk_id_municipio)
        REFERENCES municipios(id_municipio)

);


INSERT INTO contas
(nome, email, senha_hash, perfil, fk_id_municipio)
VALUES

(
    'Teste',
    'teste@gmail.com',
    '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
    'cidadao',
    NULL
),

(
    'TesteMunicipal',
    'testemunicipal@gmail.com',
    '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
    'admin_municipal',
    1
),

(
    'TesteGeral',
    'testegeral@gmail.com',
    '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
    'admin_geral',
    NULL
);



-- ==================== AÇÕES ADMINISTRATIVAS ====================

CREATE TABLE acoes_administrativas(

    id_acao INT AUTO_INCREMENT PRIMARY KEY,

    tipo VARCHAR(50) NOT NULL,

    realizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    detalhes TEXT NOT NULL,

    fk_id_conta_responsavel INT NOT NULL,

    fk_id_conta_afetada INT,

    fk_id_importacao INT,


    FOREIGN KEY (fk_id_conta_responsavel)
        REFERENCES contas(id_conta),

    FOREIGN KEY (fk_id_conta_afetada)
        REFERENCES contas(id_conta),

    FOREIGN KEY (fk_id_importacao)
        REFERENCES importacoes(id_importacao)

);


-- ==================== RELATOS ====================

CREATE TABLE relatos(

    id_relato INT AUTO_INCREMENT PRIMARY KEY,

    descricao TEXT NOT NULL,

    data_fato DATE NOT NULL,

    hora_fato TIME,

    latitude DECIMAL(9,6) NOT NULL,

    longitude DECIMAL(10,6) NOT NULL,

    referencia_local VARCHAR(255),

    enviado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    situacao VARCHAR(30) NOT NULL DEFAULT 'Pendente',

    chave_envio CHAR(36) NOT NULL UNIQUE,

    fk_id_conta_autor INT NOT NULL,

    fk_id_municipio INT NOT NULL,

    fk_id_categoria INT NOT NULL,


    FOREIGN KEY (fk_id_conta_autor)
        REFERENCES contas(id_conta),

    FOREIGN KEY (fk_id_municipio)
        REFERENCES municipios(id_municipio),

    FOREIGN KEY (fk_id_categoria)
        REFERENCES categorias(id_categoria)

);


-- ==================== DECISÕES ====================

CREATE TABLE decisoes(

    id_decisao INT AUTO_INCREMENT PRIMARY KEY,

    resultado VARCHAR(20) NOT NULL,

    motivo_rejeicao TEXT,

    fk_id_acao INT NOT NULL,

    fk_id_relato INT NOT NULL UNIQUE,


    FOREIGN KEY (fk_id_acao)
        REFERENCES acoes_administrativas(id_acao),

    FOREIGN KEY (fk_id_relato)
        REFERENCES relatos(id_relato)

);




-- Limpa eventuais vínculos antigos de auditoria antes de recriar as tabelas de importação
UPDATE acoes_administrativas
SET fk_id_importacao = NULL
WHERE fk_id_importacao IS NOT NULL;

DROP TABLE IF EXISTS registro_oficial;
DROP TABLE IF EXISTS censo_demografico;
DROP TABLE IF EXISTS item_importacao;
DROP TABLE IF EXISTS importacoes;
DROP TABLE IF EXISTS fontes;

-- ==================== FONTES ====================
CREATE TABLE fontes (
  id_fonte INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO fontes (id_fonte, nome) VALUES
  (1, 'IBGE - Censo Demográfico'),
  (2, 'SSP-SP - Dados Criminais');

-- ==================== IMPORTAÇÕES ====================
CREATE TABLE importacoes (
  id_importacao INT AUTO_INCREMENT PRIMARY KEY,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho_arquivo VARCHAR(500) NULL,
  hash_arquivo CHAR(64) NULL,
  pagina_origem VARCHAR(500) NULL,
  inicio_periodo DATE NULL,
  fim_periodo DATE NULL,
  enviada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluida_em TIMESTAMP NULL DEFAULT NULL,
  situacao VARCHAR(30) NOT NULL,
  resumo_resultado TEXT NULL,
  fk_id_conta_responsavel INT NOT NULL,
  fk_id_fonte INT NOT NULL,
  INDEX idx_importacoes_conta (fk_id_conta_responsavel),
  INDEX idx_importacoes_fonte (fk_id_fonte),
  INDEX idx_importacoes_excluida (excluida_em),
  INDEX idx_importacoes_hash (hash_arquivo),
  CONSTRAINT fk_importacoes_conta
    FOREIGN KEY (fk_id_conta_responsavel) REFERENCES contas(id_conta),
  CONSTRAINT fk_importacoes_fonte
    FOREIGN KEY (fk_id_fonte) REFERENCES fontes(id_fonte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ITEM IMPORTAÇÃO ====================
CREATE TABLE item_importacao (
  id_item_importacao INT AUTO_INCREMENT PRIMARY KEY,
  numero_linha INT NOT NULL,
  dados_recebidos TEXT NULL,
  resultado VARCHAR(30) NOT NULL,
  motivo VARCHAR(255) NULL,
  municipio_informado VARCHAR(100) NULL,
  nome_aba VARCHAR(100) NULL,
  fk_id_importacao INT NOT NULL,
  INDEX idx_item_importacao_imp (fk_id_importacao),
  INDEX idx_item_importacao_resultado (fk_id_importacao, resultado),
  UNIQUE KEY uq_item_importacao_linha (fk_id_importacao, nome_aba, numero_linha),
  CONSTRAINT fk_item_importacao
    FOREIGN KEY (fk_id_importacao) REFERENCES importacoes(id_importacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CENSO DEMOGRÁFICO ====================
CREATE TABLE censo_demografico (
  id_censo INT AUTO_INCREMENT PRIMARY KEY,
  ano_censo SMALLINT UNSIGNED NOT NULL,
  nivel_territorial VARCHAR(20) NOT NULL,
  cod_ibge CHAR(7) NOT NULL,
  nome_municipio VARCHAR(150) NOT NULL,
  bairro VARCHAR(150) NULL,
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
  CONSTRAINT fk_censo_municipio
    FOREIGN KEY (fk_id_municipio) REFERENCES municipios(id_municipio),
  CONSTRAINT fk_censo_importacao
    FOREIGN KEY (fk_id_importacao) REFERENCES importacoes(id_importacao),
  CONSTRAINT fk_censo_item
    FOREIGN KEY (fk_id_item_origem) REFERENCES item_importacao(id_item_importacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== REGISTROS OFICIAIS ====================
CREATE TABLE registro_oficial (
  id_ocorrencia INT AUTO_INCREMENT PRIMARY KEY,
  nome_departamento VARCHAR(150) NULL,
  nome_municipio VARCHAR(150) NULL,
  data_registro DATE NULL,
  num_bo VARCHAR(150) NULL,
  data_ocorrencia_bo DATE NULL,
  hora_ocorrencia_bo TIME NULL,
  bairro VARCHAR(150) NULL,
  latitude DECIMAL(11, 8) NULL,
  longitude DECIMAL(11, 8) NULL,
  geom POINT NULL,
  rubrica VARCHAR(255) NULL,
  descr_conduta TEXT NULL,
  natureza_apurada VARCHAR(255) NULL,
  cod_ibge INT NULL,
  populacao_bairro INT NULL,
  populacao_municipio INT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  chave_identificacao CHAR(64) NULL,
  hash_conteudo CHAR(64) NULL,
  fk_id_municipio INT NULL,
  fk_id_importacao INT NULL,
  fk_id_item_origem INT NULL UNIQUE,
  INDEX idx_ocorrencias_data (data_ocorrencia_bo),
  INDEX idx_ocorrencias_cod_ibge (cod_ibge),
  INDEX idx_ocorrencias_municipio_bairro (nome_municipio, bairro),
  INDEX idx_ocorrencias_natureza (natureza_apurada),
  INDEX idx_ocorrencias_lat_lng (latitude, longitude),
  INDEX idx_ocorrencias_importacao (fk_id_importacao),
  INDEX idx_ocorrencias_ativo (ativo),
  INDEX idx_ocorrencias_chave (chave_identificacao),
  CONSTRAINT fk_registro_municipio
    FOREIGN KEY (fk_id_municipio) REFERENCES municipios(id_municipio),
  CONSTRAINT fk_registro_importacao
    FOREIGN KEY (fk_id_importacao) REFERENCES importacoes(id_importacao),
  CONSTRAINT fk_registro_item
    FOREIGN KEY (fk_id_item_origem) REFERENCES item_importacao(id_item_importacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================================
   RESUMO DA FUNÇÃO DE CADA TABELA (VERSÃO FINAL COM PRÉVIA E DEDUPLICAÇÃO)
   ============================================================================

   1. fontes
      Cadastra as instituições oficiais de origem das planilhas importadas
      (1 = IBGE - Censo Demográfico; 2 = SSP-SP - Dados Criminais).

   2. importacoes
      Cabeçalho de cada upload de planilha .xlsx feito no painel administrativo.
      Armazena o nome do arquivo, caminho físico para download (caminho_arquivo),
      hash SHA-256 do arquivo (hash_arquivo), responsável, fonte, período,
      resumo da conferência, ciclo de situação (EM_PROCESSO, AGUARDANDO_CONFIRMACAO,
      PUBLICADA, CANCELADA, ERRO, EXCLUIDA) e controle de lixeira (excluida_em).

   3. item_importacao
      Log linha por linha da conferência (prévia). Armazena aba, número da linha
      (único por importação/aba), retrato em JSON dos dados (dados_recebidos),
      classificação (ACEITO, DUPLICADO, CONFLITANTE ou PROBLEMA) e motivo.
      Alimenta o modal de prévia e serve de origem para a publicação confirmada.

   4. censo_demografico
      Armazena a população oficial do Censo IBGE para os 7 municípios do Grande
      ABC e seus bairros (nivel_territorial). Inclui chave_identificacao e
      hash_conteudo (SHA-256) para impedir duplicidade e detectar conflitos,
      além da flag ativo (1/0) para lixeira e restauração.

   5. registro_oficial
      Armazena cada ocorrência criminal da SSP-SP publicada para o Grande ABC,
      com dados do boletim, bairro padronizado via censo, coordenadas validadas,
      ponto espacial geom, população vinculada e hashes chave_identificacao /
      hash_conteudo para controle de duplicidade (RN12) e conflitos (RN15),
      preservando múltiplos registros do mesmo boletim (RN17).

   Fluxo de relacionamento:
   fontes -> importacoes -> item_importacao -> censo_demografico / registro_oficial
   ============================================================================ */