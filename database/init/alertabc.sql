
SHOW DATABASES;

CREATE DATABASE IF NOT EXISTS alertabc;

USE alertabc;

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


-- ==================== IMPORTAÇÕES ====================

CREATE TABLE importacoes(

    id_importacao INT AUTO_INCREMENT PRIMARY KEY,

    nome_arquivo VARCHAR(255) NOT NULL,

    pagina_origem VARCHAR(500) NOT NULL,

    inicio_periodo DATE NOT NULL,

    fim_periodo DATE NOT NULL,

    enviada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    situacao VARCHAR(30) NOT NULL,

    resumo_resultado TEXT,

    fk_id_conta_responsavel INT NOT NULL,

    fk_id_fonte INT NOT NULL,


    FOREIGN KEY (fk_id_conta_responsavel)
        REFERENCES contas(id_conta),

    FOREIGN KEY (fk_id_fonte)
        REFERENCES fontes(id_fonte)

);


-- ==================== ITEM IMPORTAÇÃO ====================

CREATE TABLE item_importacao (

    id_item_importacao INT AUTO_INCREMENT PRIMARY KEY,

    numero_linha INT NOT NULL,

    dados_recebidos TEXT NOT NULL,

    resultado VARCHAR(30) NOT NULL,

    motivo VARCHAR(255),

    municipio_informado VARCHAR(100),

    nome_aba VARCHAR(100) NOT NULL,

    fk_id_importacao INT NOT NULL,


    UNIQUE (fk_id_importacao, nome_aba, numero_linha),


    FOREIGN KEY (fk_id_importacao)
        REFERENCES importacoes(id_importacao)

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


-- ==================== REGISTROS OFICIAIS ====================

CREATE TABLE registro_oficial (

    id_registro INT AUTO_INCREMENT PRIMARY KEY,

    numero_boletim VARCHAR(50),

    ano_boletim SMALLINT,

    rubrica_original VARCHAR(255),

    natureza_apurada_original VARCHAR(255),

    data_fato DATE,

    hora_fato TIME,

    data_registro DATE,

    bairro VARCHAR(255),

    logradouro VARCHAR(255),

    numero_logradouro VARCHAR(30),

    tipo_local VARCHAR(150),

    subtipo_local VARCHAR(150),

    latitude DECIMAL(9,6),

    longitude DECIMAL(10,6),

    mes_estatistica TINYINT UNSIGNED,

    ano_estatistica SMALLINT UNSIGNED,

    fk_id_item_origem INT NOT NULL UNIQUE,

    fk_id_municipio INT NOT NULL,

    fk_id_categoria INT NOT NULL,


    FOREIGN KEY (fk_id_item_origem)
        REFERENCES item_importacao(id_item_importacao),

    FOREIGN KEY (fk_id_municipio)
        REFERENCES municipios(id_municipio),

    FOREIGN KEY (fk_id_categoria)
        REFERENCES categorias(id_categoria)

);


-- ==================== CONFERÊNCIA ====================

SHOW TABLES;
