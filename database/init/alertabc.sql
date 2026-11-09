-- ALERTABC — BANCO DE DADOS COMPLETO


SHOW DATABASES;

CREATE DATABASE IF NOT EXISTS alertabc;

USE alertabc;

SELECT DATABASE();
SHOW CREATE DATABASE alertabc;
SHOW TABLES;

-- ==================== MUNICÍPIOS ====================
CREATE TABLE municipios (
    id_municipio INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    codigo_ibge CHAR(7) NOT NULL UNIQUE,

    CONSTRAINT chk_municipio_ibge CHECK (
        (nome = 'São Bernardo do Campo' AND codigo_ibge = '3548708')
        OR
        (nome = 'Santo André' AND codigo_ibge = '3547809')
        OR
        (nome = 'São Caetano do Sul' AND codigo_ibge = '3548807')
        OR
        (nome = 'Diadema' AND codigo_ibge = '3513801')
        OR
        (nome = 'Mauá' AND codigo_ibge = '3529401')
        OR
        (nome = 'Ribeirão Pires' AND codigo_ibge = '3543303')
        OR
        (nome = 'Rio Grande da Serra' AND codigo_ibge = '3544103')
    )) ENGINE=InnoDB;

INSERT INTO municipios (nome, codigo_ibge) VALUES
    ('São Bernardo do Campo', '3548708'),
    ('Santo André', '3547809'),
    ('São Caetano do Sul', '3548807'),
    ('Diadema', '3513801'),
    ('Mauá', '3529401'),
    ('Ribeirão Pires', '3543303'),
    ('Rio Grande da Serra', '3544103');


SELECT * FROM municipios ORDER BY id_municipio ASC;

-- ==================== CATEGORIAS ====================
CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT chk_categoria_nome CHECK (
        CHAR_LENGTH(TRIM(nome)) > 0
    ),

    CONSTRAINT chk_categoria_ativa CHECK (
        ativa IN (0, 1)
    )) ENGINE=InnoDB;

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

SELECT * FROM categorias ORDER BY id_categoria ASC;

-- ==================== FONTES ====================
CREATE TABLE fontes (
    id_fonte INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL UNIQUE,

    CONSTRAINT chk_fonte_nome CHECK (
        CHAR_LENGTH(TRIM(nome)) > 0
    )) ENGINE=InnoDB;

INSERT INTO fontes (nome) VALUES
    ('Secretaria da Segurança Pública de São Paulo (SSP-SP)');

SELECT * FROM fontes ORDER BY id_fonte ASC;

-- ==================== CONTAS ====================
CREATE TABLE contas (
    id_conta INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(30) NOT NULL,
    fk_id_municipio INT,

    -- Apenas os três perfis definidos.
    CONSTRAINT chk_perfil_valido CHECK (
        perfil IN ('cidadao', 'admin_municipal', 'admin_geral')
    ),

    -- Administrador municipal exige município e os outros perfis não podem ter um município.
    CONSTRAINT chk_perfil_municipio CHECK (
        (perfil = 'admin_municipal' AND fk_id_municipio IS NOT NULL)
        OR
        (perfil IN ('cidadao', 'admin_geral') AND fk_id_municipio IS NULL)
    ),

    CONSTRAINT chk_conta_campos_nao_vazios CHECK (
        CHAR_LENGTH(TRIM(nome)) > 0
        AND
        CHAR_LENGTH(TRIM(email)) > 0
        AND
        CHAR_LENGTH(TRIM(senha_hash)) > 0
),

    -- Preserva o municipio ao qual um administrador municipal esta vinculado.
    -- Exemplo: uma conta de administrador municipal aponta para o municipio 1.
    -- Se tentar apagar o municipio 1, o banco bloqueia enquanto essa conta estiver vinculada.
    -- Esta FK bloqueia apagar o MUNICIPIO; nao bloqueia apagar a conta por esse vinculo.
    CONSTRAINT fk_contas_municipio
        FOREIGN KEY (fk_id_municipio)
        REFERENCES municipios(id_municipio)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Contas apenas para testes; não usar esses usuários como dados reais.
INSERT INTO contas (nome, email, senha_hash, perfil, fk_id_municipio) VALUES
    -- Cidadão
    (
        'Enzo',
        'enzocidadao@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'cidadao',
        NULL
    ),
    (
        'Danilo',
        'danilocidadao@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'cidadao',
        NULL
    ),
    (
        'Raí',
        'raicidadao@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'cidadao',
        NULL
    ),
    (
        'Jessé',
        'jessecidadao@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'cidadao',
        NULL
    ),


    -- Admin municipal
    (
        'Enzo',
        'enzomunicipal@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_municipal',
        1
    ),
    (
        'Danilo',
        'danilomunicipal@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_municipal',
        1
    ),
    (
        'Raí',
        'raimunicipal@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_municipal',
        1
    ),
    (
        'Jessé',
        'jessemunicipal@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_municipal',
        1
    ),



    (
        'Enzo',
        'enzogeral@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_geral',
        NULL
    ),
    (
        'Danilo',
        'danilogeral@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_geral',
        NULL
    ),
    (
        'Raí',
        'raigeral@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_geral',
        NULL
    ),
    (
        'Jessé',
        'jessegeral@gmail.com',
        '$2b$10$PJiWzIS5iurcENbBIi.yje0ax32hmOwxcuJGuuO90qp7n1nBo8R1C',
        'admin_geral',
        NULL
    ),
    ;

-- ==================== RECUPERAÇÃO DE SENHA ====================
-- O backend envia um link com token temporário e salva SOMENTE o hash do token.
-- token_hash é diferente do hash usado para identificar possíveis duplicatas
-- nos registros da SSP-SP: aqui ele protege o segredo do link de recuperação.
CREATE TABLE recuperacoes_senha (
    id_recuperacao INT AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em DATETIME NOT NULL,
    utilizado_em DATETIME,
    fk_id_conta INT NOT NULL,


    -- Se a conta puder ser excluida, elimina suas recuperacoes de senha sem utilidade.
    -- Exemplo: a conta 10 possui tres solicitacoes de recuperacao de senha.
    -- Se a exclusao da conta 10 for permitida pelos demais relacionamentos,
    -- o banco apaga automaticamente essas tres recuperacoes. Excluir uma recuperacao nao apaga a conta.
    CONSTRAINT fk_recuperacoes_senha_conta
        FOREIGN KEY (fk_id_conta)
        REFERENCES contas(id_conta)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==================== IMPORTAÇÕES ====================
CREATE TABLE importacoes (
    id_importacao INT AUTO_INCREMENT PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    pagina_origem VARCHAR(500) NOT NULL,
    inicio_periodo DATE NOT NULL,
    fim_periodo DATE NOT NULL,
    enviada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    situacao VARCHAR(30) NOT NULL DEFAULT 'Em processo',
    resumo_resultado TEXT,
    fk_id_conta_responsavel INT NOT NULL,
    fk_id_fonte INT NOT NULL,

    CONSTRAINT chk_importacao_campos_nao_vazios CHECK (
        CHAR_LENGTH(TRIM(nome_arquivo)) > 0
        AND
        CHAR_LENGTH(TRIM(pagina_origem)) > 0
        AND
        (
            -- resumo_resultado vai ser preenchido apenas depois, então tem que verificar se ele está nulo caso não tenha sido preenchido ou se caso ele for preenchido tem pelo menos um caractere
            resumo_resultado IS NULL
            OR
            CHAR_LENGTH(TRIM(resumo_resultado)) > 0
        )
    ),

    CONSTRAINT chk_situacao_importacao CHECK (
        situacao IN (
            'Em processo',
            'Aguardando confirmacao',
            'Publicada',
            'Cancelada',
            'Erro',
            'Desfeita'
        )
    ),

    CONSTRAINT chk_importacao_periodo CHECK (
        inicio_periodo <= fim_periodo
    ),

    -- Preserva a identificacao de quem realizou cada importacao.
    -- Exemplo: a conta 10 foi responsavel pela importacao 5.
    -- O banco impede apagar a conta 10 enquanto a importacao 5 apontar para ela.
    -- Assim, o historico continua identificando quem importou os dados.
    CONSTRAINT fk_importacoes_conta_responsavel
        FOREIGN KEY (fk_id_conta_responsavel)
        REFERENCES contas(id_conta)
        ON DELETE RESTRICT,

    -- Preserva a origem dos dados e o historico das importacoes.
    -- Exemplo: a importacao 5 utiliza a fonte SSP-SP.
    -- O banco impede apagar essa fonte enquanto houver importacoes vinculadas a ela.
    -- Excluir uma importacao nao apaga a fonte por este relacionamento.
    CONSTRAINT fk_importacoes_fonte
        FOREIGN KEY (fk_id_fonte)
        REFERENCES fontes(id_fonte)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

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

    -- Preserva as linhas analisadas e seus resultados no historico.
    -- Exemplo: a importacao 5 possui 100 linhas registradas em item_importacao.
    -- O banco bloqueia apagar a importacao 5 enquanto essas linhas apontarem para ela.
    -- Para desfazer a publicacao, manter a importacao e os itens e remover somente os registros oficiais publicados.
    CONSTRAINT fk_item_importacao_importacao
        FOREIGN KEY (fk_id_importacao)
        REFERENCES importacoes(id_importacao)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==================== AÇÕES ADMINISTRATIVAS ====================
CREATE TABLE acoes_administrativas (
    id_acao INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    realizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detalhes TEXT,
    fk_id_conta_responsavel INT NOT NULL,
    fk_id_conta_afetada INT,
    fk_id_importacao INT,

    CONSTRAINT chk_acoes_relacionamentos CHECK (
        (tipo IN ('Importação', 'Desfazer importação') AND fk_id_importacao IS NOT NULL AND fk_id_conta_afetada IS NULL)
        OR
        (tipo IN ('Criar administrador', 'Alterar acesso') AND fk_id_conta_afetada IS NOT NULL AND fk_id_importacao IS NULL)
        OR
        (tipo IN ('Aprovar relato', 'Rejeitar relato') AND fk_id_conta_afetada IS NULL AND fk_id_importacao IS NULL)
    ),

      

    -- Preserva a identificacao do autor de cada acao administrativa.
    -- Exemplo: a conta 10 aprovou um relato e ficou como responsavel pela acao.
    -- O banco impede apagar essa conta enquanto uma acao apontar para ela como responsavel.
    -- Isso preserva a identificacao de quem executou a acao.
    CONSTRAINT fk_acoes_administrativas_conta_responsavel
        FOREIGN KEY (fk_id_conta_responsavel)
        REFERENCES contas(id_conta)
        ON DELETE RESTRICT,

    -- Preserva a identificacao da conta afetada pela acao.
    -- Exemplo: uma acao registra que o perfil da conta 20 foi alterado.
    -- O banco impede apagar a conta 20 enquanto ela estiver identificada como conta afetada.
    -- Isso preserva qual conta foi criada ou teve seu acesso alterado.
    CONSTRAINT fk_acoes_administrativas_conta_afetada
        FOREIGN KEY (fk_id_conta_afetada)
        REFERENCES contas(id_conta)
        ON DELETE RESTRICT,

    -- Preserva as acoes e o historico ligados a importacao.
    -- Exemplo: uma acao administrativa documenta a importacao 5 ou seu desfazimento.
    -- O banco impede apagar a importacao 5 enquanto essa acao apontar para ela.
    -- Marcar a importacao como Desfeita nao significa apagar seu historico.
    CONSTRAINT fk_acoes_administrativas_importacao
        FOREIGN KEY (fk_id_importacao)
        REFERENCES importacoes(id_importacao)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==================== RELATOS ====================
CREATE TABLE relatos (
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

    CONSTRAINT chk_relato_descricao CHECK (
        CHAR_LENGTH(TRIM(descricao)) > 0
    ),

    CONSTRAINT chk_relato_situacao CHECK (
        situacao IN ('Pendente', 'Aprovado', 'Rejeitado')
    ),

    CONSTRAINT chk_relato_coordenadas CHECK (
        latitude BETWEEN -90 AND 90
        AND 
        longitude BETWEEN -180 AND 180
    ),

    CONSTRAINT chk_relato_hora CHECK (
        hora_fato BETWEEN 
        CAST('00:00:00' AS TIME) 
        AND 
        CAST('23:59:59' AS TIME)
    ),

    -- Impede que excluir a conta apague relatos ou remova sua autoria.
    -- Exemplo: a conta 10 enviou o relato 30.
    -- O banco bloqueia apagar a conta 10 enquanto o relato apontar para ela.
    -- A tentativa de excluir a conta nao apaga o relato automaticamente.
    CONSTRAINT fk_relatos_conta_autor
        FOREIGN KEY (fk_id_conta_autor)
        REFERENCES contas(id_conta)
        ON DELETE RESTRICT,

    -- Impede que excluir o municipio apague ou deixe relatos sem municipio.
    -- Exemplo: um relato pertence a Santo Andre.
    -- O banco impede apagar Santo Andre da tabela municipios enquanto existir relato vinculado.
    -- O relato continua associado ao municipio onde ocorreu o fato.
    CONSTRAINT fk_relatos_municipio
        FOREIGN KEY (fk_id_municipio)
        REFERENCES municipios(id_municipio)
        ON DELETE RESTRICT,

    -- Preserva a classificacao dos relatos; categoria em uso pode ser desativada.
    -- Exemplo: um relato utiliza a categoria Furto de Veiculo.
    -- O banco impede apagar essa categoria enquanto existir relato que a utilize.
    -- Alterar ativa para FALSE nao e uma exclusao e nao remove a classificacao do relato.
    CONSTRAINT fk_relatos_categoria
        FOREIGN KEY (fk_id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==================== DECISÕES ====================
CREATE TABLE decisoes (
    id_decisao INT AUTO_INCREMENT PRIMARY KEY,
    resultado VARCHAR(20) NOT NULL,
    motivo_rejeicao TEXT,
    fk_id_acao INT NOT NULL,
    fk_id_relato INT NOT NULL UNIQUE,

    -- Preserva a acao administrativa que documenta a decisao.
    -- Exemplo: a decisao 7 aponta para a acao administrativa 12.
    -- O banco impede apagar a acao 12 enquanto a decisao apontar para ela.
    -- Excluir a decisao nao apaga a acao automaticamente; permissoes e outras regras continuam no backend.
    CONSTRAINT fk_decisoes_acao
        FOREIGN KEY (fk_id_acao)
        REFERENCES acoes_administrativas(id_acao)
        ON DELETE RESTRICT,

    -- Preserva o relato e sua decisao final de moderacao.
    -- Exemplo: o relato 30 ja recebeu uma decisao de aprovacao ou rejeicao.
    -- O banco impede apagar o relato 30 enquanto a decisao estiver vinculada a ele.
    -- Essa FK nao impede, por si so, apagar a decisao diretamente; isso deve ser controlado pela aplicacao.
    CONSTRAINT fk_decisoes_relato
        FOREIGN KEY (fk_id_relato)
        REFERENCES relatos(id_relato)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

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

    -- Preserva a linha importada que explica a origem do registro oficial.
    -- Exemplo: o registro oficial 40 foi publicado a partir do item 80 da planilha.
    -- O banco impede apagar o item 80 enquanto o registro 40 apontar para ele.
    -- Permite apagar o registro oficial 40 sem apagar o item 80, necessario ao desfazer uma importacao.
    CONSTRAINT fk_registro_oficial_item_origem
        FOREIGN KEY (fk_id_item_origem)
        REFERENCES item_importacao(id_item_importacao)
        ON DELETE RESTRICT,

    -- Preserva o municipio dos registros oficiais.
    -- Exemplo: um registro oficial pertence a Diadema.
    -- O banco impede apagar Diadema da tabela municipios enquanto houver registros oficiais vinculados.
    -- Nao ocorre exclusao automatica das ocorrencias quando alguem tenta apagar o municipio.
    CONSTRAINT fk_registro_oficial_municipio
        FOREIGN KEY (fk_id_municipio)
        REFERENCES municipios(id_municipio)
        ON DELETE RESTRICT,

    -- Preserva a classificacao dos registros oficiais; categoria em uso pode ser desativada.
    -- Exemplo: um registro oficial utiliza a categoria Roubo de Carga.
    -- O banco impede apagar essa categoria enquanto o registro oficial a utilizar.
    -- A categoria pode ser desativada sem apagar a classificacao dos registros existentes.
    CONSTRAINT fk_registro_oficial_categoria
        FOREIGN KEY (fk_id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==================== CONFERÊNCIA ====================
SHOW TABLES;
