
import fs from "node:fs/promises";

import {
  alertabcPool,
  garantirEstruturaImportacoes,
  recalcularPopulacaoRegistros,
  importarPlanilhaCenso,
  importarPlanilhaCrimes,
  confirmarImportacao,
  cancelarImportacao,
  listarItensImportacao,
} from "../services/importacaoEtlService.js";

function parseId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function obterContaId(req) {
  const usuario = req.user || req.usuario || {};

  const id = parseId(
    usuario.id_conta ??
    usuario.id ??
    usuario.idConta
  );

  if (!id) {
    const erro = new Error(
      "Usuário não autenticado ou conta inválida."
    );
    erro.status = 401;
    throw erro;
  }

  return id;
}

function enviarErro(res, error, mensagemPadrao) {
  console.error(mensagemPadrao, error);

  return res.status(error.status || 500).json({
    error: error.message || mensagemPadrao,
    codigo: error.codigo || "ERRO_INTERNO",
  });
}

async function verificarFonteCenso(conn, idFonte) {
  const [[fonte]] = await conn.query(
    `SELECT id_fonte, nome
     FROM fontes
     WHERE id_fonte = ?`,
    [idFonte]
  );

  if (!fonte) return false;

  return String(fonte.nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("censo");
}

/* METADADOS */

export const obterMetadados = async (req, res) => {
  try {
    await garantirEstruturaImportacoes();

    const [[contas], [fontes], [municipios]] = await Promise.all([
      alertabcPool.query(
        `SELECT id_conta, nome, email, perfil
         FROM contas
         ORDER BY nome ASC`
      ),
      alertabcPool.query(
        `SELECT id_fonte, nome
         FROM fontes
         ORDER BY id_fonte ASC`
      ),
      alertabcPool.query(
        `SELECT id_municipio, nome, codigo_ibge
         FROM municipios
         ORDER BY nome ASC`
      ),
    ]);

    return res.json({ contas, fontes, municipios });
  } catch (error) {
    return enviarErro(res, error, "Erro ao carregar metadados de importação.");
  }
};

/* LISTAR IMPORTAÇÕES */

export const listarImportacoes = async (req, res) => {
  try {
    await garantirEstruturaImportacoes();

    const { fonte, situacao, lixeira } = req.query;
    const condicoes = ["1 = 1"];
    const params = [];

    if (lixeira === "true") {
      condicoes.push("i.excluida_em IS NOT NULL");
    } else if (lixeira === "false") {
      condicoes.push("i.excluida_em IS NULL");
    }

    if (fonte) {
      const fonteId = parseId(fonte);

      if (!fonteId) {
        return res.status(400).json({ error: "ID da fonte inválido." });
      }

      condicoes.push("i.fk_id_fonte = ?");
      params.push(fonteId);
    }

    if (situacao) {
      condicoes.push("i.situacao = ?");
      params.push(String(situacao));
    }

    const [rows] = await alertabcPool.query(
      `SELECT
        i.id_importacao,
        i.nome_arquivo,
        CASE
          WHEN i.caminho_arquivo IS NOT NULL
          AND i.caminho_arquivo <> ''
          THEN 1 ELSE 0
        END AS tem_arquivo,
        i.pagina_origem,
        DATE_FORMAT(i.inicio_periodo, '%Y-%m-%d') AS inicio_periodo,
        DATE_FORMAT(i.fim_periodo, '%Y-%m-%d') AS fim_periodo,
        i.enviada_em,
        i.excluida_em,
        i.situacao,
        i.resumo_resultado,
        i.fk_id_conta_responsavel,
        i.fk_id_fonte,
        c.nome AS responsavel_nome,
        c.email AS responsavel_email,
        f.nome AS fonte_nome,
        (
          SELECT COUNT(*)
          FROM registro_oficial r
          WHERE r.fk_id_importacao = i.id_importacao
        ) AS total_registros_criminais,
        (
          SELECT COUNT(*)
          FROM censo_demografico cd
          WHERE cd.fk_id_importacao = i.id_importacao
        ) AS total_registros_censo
      FROM importacoes i
      JOIN contas c
        ON c.id_conta = i.fk_id_conta_responsavel
      JOIN fontes f
        ON f.id_fonte = i.fk_id_fonte
      WHERE ${condicoes.join(" AND ")}
      ORDER BY i.id_importacao DESC`,
      params
    );

    return res.json(rows);
  } catch (error) {
    return enviarErro(res, error, "Erro ao listar importações.");
  }
};

/* DETALHES */

export const obterImportacaoPorId = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID de importação inválido." });
    }

    await garantirEstruturaImportacoes();

    const [[importacao]] = await alertabcPool.query(
      `SELECT
        i.id_importacao,
        i.nome_arquivo,
        CASE
          WHEN i.caminho_arquivo IS NOT NULL
          AND i.caminho_arquivo <> ''
          THEN 1 ELSE 0
        END AS tem_arquivo,
        i.pagina_origem,
        DATE_FORMAT(i.inicio_periodo, '%Y-%m-%d') AS inicio_periodo,
        DATE_FORMAT(i.fim_periodo, '%Y-%m-%d') AS fim_periodo,
        i.enviada_em,
        i.excluida_em,
        i.situacao,
        i.resumo_resultado,
        i.fk_id_conta_responsavel,
        i.fk_id_fonte,
        c.nome AS responsavel_nome,
        c.email AS responsavel_email,
        f.nome AS fonte_nome
      FROM importacoes i
      JOIN contas c
        ON c.id_conta = i.fk_id_conta_responsavel
      JOIN fontes f
        ON f.id_fonte = i.fk_id_fonte
      WHERE i.id_importacao = ?`,
      [id]
    );

    if (!importacao) {
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    const [[itens], [acoes], [amostraCenso]] = await Promise.all([
      alertabcPool.query(
        `SELECT
          id_item_importacao,
          numero_linha,
          resultado,
          motivo,
          municipio_informado,
          nome_aba,
          dados_recebidos
        FROM item_importacao
        WHERE fk_id_importacao = ?
        ORDER BY id_item_importacao DESC
        LIMIT 50`,
        [id]
      ),
      alertabcPool.query(
        `SELECT
          a.id_acao,
          a.tipo,
          a.realizada_em,
          a.detalhes,
          c.nome AS responsavel_nome
        FROM acoes_administrativas a
        JOIN contas c
          ON c.id_conta = a.fk_id_conta_responsavel
        WHERE a.fk_id_importacao = ?
        ORDER BY a.realizada_em DESC`,
        [id]
      ),
      alertabcPool.query(
        `SELECT
          id_censo,
          ano_censo,
          nivel_territorial,
          cod_ibge,
          nome_municipio,
          bairro,
          populacao
        FROM censo_demografico
        WHERE fk_id_importacao = ?
        ORDER BY nivel_territorial DESC, nome_municipio ASC, bairro ASC
        LIMIT 50`,
        [id]
      ),
    ]);

    return res.json({ importacao, itens, acoes, amostraCenso });
  } catch (error) {
    return enviarErro(res, error, "Erro ao carregar detalhes da importação.");
  }
};

/* CRIAR IMPORTAÇÃO */

export const criarImportacao = async (req, res) => {
  const arquivo = req.file;

  if (!arquivo) {
    return res.status(400).json({
      error: "Envie um arquivo .xlsx para importar.",
    });
  }

  try {
    const contaId = obterContaId(req);
    const tipo = String(req.body.tipo || "ssp").toLowerCase();

    const paginaOrigem = req.body.pagina_origem
      ? String(req.body.pagina_origem).trim()
      : null;

    const anoCenso = Number(req.body.ano_censo || 2022);

    const nomeOriginal = Buffer
      .from(arquivo.originalname, "latin1")
      .toString("utf8");

    let resultado;

    if (tipo === "censo") {
      if (
        !Number.isInteger(anoCenso) ||
        anoCenso < 1900 ||
        anoCenso > 2100
      ) {
        return res.status(400).json({ error: "Ano do Censo inválido." });
      }

      resultado = await importarPlanilhaCenso({
        caminhoArquivo: arquivo.path,
        nomeArquivo: nomeOriginal,
        paginaOrigem,
        anoCenso,
        contaId,
      });
    } else if (tipo === "ssp") {
      resultado = await importarPlanilhaCrimes({
        caminhoArquivo: arquivo.path,
        nomeArquivo: nomeOriginal,
        paginaOrigem,
        contaId,
      });
    } else {
      return res.status(400).json({
        error: "Tipo de importação inválido. Use 'ssp' ou 'censo'.",
      });
    }

    return res.status(201).json(resultado);
  } catch (error) {
    return enviarErro(res, error, "Erro ao processar a planilha.");
  } finally {
    if (arquivo?.path) {
      await fs.unlink(arquivo.path).catch(() => {});
    }
  }
};

/* ATUALIZAR IMPORTAÇÃO */

export const atualizarImportacao = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  let conn;

  try {
    const contaAcao = obterContaId(req);

    await garantirEstruturaImportacoes();
    conn = await alertabcPool.getConnection();
    await conn.beginTransaction();

    const {
      nome_arquivo,
      pagina_origem,
      inicio_periodo,
      fim_periodo,
      situacao,
      resumo_resultado,
    } = req.body;

    const [[atual]] = await conn.query(
      `SELECT id_importacao, nome_arquivo
       FROM importacoes
       WHERE id_importacao = ?
       FOR UPDATE`,
      [id]
    );

    if (!atual) {
      await conn.rollback();
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    await conn.query(
      `UPDATE importacoes
       SET nome_arquivo = ?,
           pagina_origem = ?,
           inicio_periodo = ?,
           fim_periodo = ?,
           situacao = ?,
           resumo_resultado = ?
       WHERE id_importacao = ?`,
      [
        nome_arquivo || atual.nome_arquivo,
        pagina_origem || null,
        inicio_periodo || null,
        fim_periodo || null,
        situacao || "CONCLUIDA",
        resumo_resultado || null,
        id,
      ]
    );

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel,
         fk_id_conta_afetada, fk_id_importacao)
       VALUES (?, ?, ?, NULL, ?)`,
      [
        "EDICAO_IMPORTACAO",
        `Metadados da importação #${id} atualizados.`,
        contaAcao,
        id,
      ]
    );

    await conn.commit();

    return res.json({ message: "Importação atualizada com sucesso." });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    return enviarErro(res, error, "Erro ao atualizar importação.");
  } finally {
    conn?.release();
  }
};

/* EXCLUIR PARA LIXEIRA */

export const excluirImportacao = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  let conn;

  try {
    const contaAcao = obterContaId(req);
    await garantirEstruturaImportacoes();

    conn = await alertabcPool.getConnection();
    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      `SELECT id_importacao, nome_arquivo, fk_id_fonte, excluida_em
       FROM importacoes
       WHERE id_importacao = ?
       FOR UPDATE`,
      [id]
    );

    if (!atual) {
      await conn.rollback();
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    if (atual.excluida_em) {
      await conn.rollback();
      return res.status(400).json({ error: "Esta importação já está na lixeira." });
    }

    await conn.query(
      `UPDATE registro_oficial SET ativo = 0 WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE censo_demografico SET ativo = 0 WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE importacoes
       SET situacao = 'EXCLUIDA',
           excluida_em = CURRENT_TIMESTAMP
       WHERE id_importacao = ?`,
      [id]
    );

    const ehCenso = await verificarFonteCenso(conn, atual.fk_id_fonte);

    if (ehCenso) await recalcularPopulacaoRegistros(conn);

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel,
         fk_id_conta_afetada, fk_id_importacao)
       VALUES (?, ?, ?, NULL, ?)`,
      [
        "EXCLUSAO_IMPORTACAO",
        `Importação #${id} (${atual.nome_arquivo}) movida para a lixeira.`,
        contaAcao,
        id,
      ]
    );

    await conn.commit();

    return res.json({
      message: "Importação movida para a lixeira.",
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    return enviarErro(res, error, "Erro ao excluir importação.");
  } finally {
    conn?.release();
  }
};

/* RESTAURAR */

export const restaurarImportacao = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  let conn;

  try {
    const contaAcao = obterContaId(req);
    await garantirEstruturaImportacoes();

    conn = await alertabcPool.getConnection();
    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      `SELECT id_importacao, nome_arquivo, fk_id_fonte, excluida_em
       FROM importacoes
       WHERE id_importacao = ?
       FOR UPDATE`,
      [id]
    );

    if (!atual) {
      await conn.rollback();
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    if (!atual.excluida_em) {
      await conn.rollback();
      return res.status(400).json({ error: "Esta importação já está ativa." });
    }

    await conn.query(
      `UPDATE registro_oficial SET ativo = 1 WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE censo_demografico SET ativo = 1 WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE importacoes
       SET situacao = 'CONCLUIDA',
           excluida_em = NULL
       WHERE id_importacao = ?`,
      [id]
    );

    await recalcularPopulacaoRegistros(conn);

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel,
         fk_id_conta_afetada, fk_id_importacao)
       VALUES (?, ?, ?, NULL, ?)`,
      [
        "RESTAURACAO_IMPORTACAO",
        `Importação #${id} (${atual.nome_arquivo}) restaurada.`,
        contaAcao,
        id,
      ]
    );

    await conn.commit();

    return res.json({
      message: "Importação e registros vinculados restaurados com sucesso.",
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    return enviarErro(res, error, "Erro ao restaurar importação.");
  } finally {
    conn?.release();
  }
};

/* EXCLUSÃO PERMANENTE */

export const excluirPermanentemente = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  let conn;
  let caminhoArquivo = null;

  try {
    const contaAcao = obterContaId(req);
    await garantirEstruturaImportacoes();

    conn = await alertabcPool.getConnection();
    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      `SELECT id_importacao, nome_arquivo, caminho_arquivo, fk_id_fonte
       FROM importacoes
       WHERE id_importacao = ?
       FOR UPDATE`,
      [id]
    );

    if (!atual) {
      await conn.rollback();
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    caminhoArquivo = atual.caminho_arquivo;

    const ehCenso = await verificarFonteCenso(conn, atual.fk_id_fonte);

    await conn.query(
      `DELETE FROM registro_oficial WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `DELETE FROM censo_demografico WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `DELETE FROM item_importacao WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `UPDATE acoes_administrativas
       SET fk_id_importacao = NULL
       WHERE fk_id_importacao = ?`,
      [id]
    );

    await conn.query(
      `DELETE FROM importacoes WHERE id_importacao = ?`,
      [id]
    );

    if (ehCenso) await recalcularPopulacaoRegistros(conn);

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel,
         fk_id_conta_afetada, fk_id_importacao)
       VALUES (?, ?, ?, NULL, NULL)`,
      [
        "EXCLUSAO_PERMANENTE_IMPORTACAO",
        `Importação #${id} (${atual.nome_arquivo}) removida permanentemente.`,
        contaAcao,
      ]
    );

    await conn.commit();

    if (caminhoArquivo) {
      await fs.unlink(caminhoArquivo).catch((error) => {
        console.error("Não foi possível remover o arquivo físico:", error);
      });
    }

    return res.json({
      message: "Importação removida permanentemente do banco e do disco.",
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    return enviarErro(res, error, "Erro ao excluir importação permanentemente.");
  } finally {
    conn?.release();
  }
};

/* BAIXAR ARQUIVO */

export const baixarArquivoImportacao = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID de importação inválido." });
    }

    await garantirEstruturaImportacoes();

    const [[atual]] = await alertabcPool.query(
      `SELECT nome_arquivo, caminho_arquivo
       FROM importacoes
       WHERE id_importacao = ?`,
      [id]
    );

    if (!atual || !atual.caminho_arquivo) {
      return res.status(404).json({
        error: "Arquivo original não está arquivado para esta importação.",
      });
    }

    try {
      await fs.access(atual.caminho_arquivo);
    } catch {
      return res.status(404).json({ error: "Arquivo não encontrado no servidor." });
    }

    return res.download(atual.caminho_arquivo, atual.nome_arquivo);
  } catch (error) {
    return enviarErro(res, error, "Erro ao baixar arquivo.");
  }
};

/* CONFIRMAR */

export async function confirmarImportacaoHandler(req, res) {
  try {
    const idImportacao = parseId(req.params.id);

    if (!idImportacao) {
      return res.status(400).json({ error: "ID de importação inválido." });
    }

    const contaId = obterContaId(req);

    const resultado = await confirmarImportacao({
      idImportacao,
      contaId,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return enviarErro(res, error, "Erro ao confirmar importação.");
  }
}

/* CANCELAR */

export async function cancelarImportacaoHandler(req, res) {
  try {
    const idImportacao = parseId(req.params.id);

    if (!idImportacao) {
      return res.status(400).json({ error: "ID de importação inválido." });
    }

    const contaId = obterContaId(req);

    const resultado = await cancelarImportacao({
      idImportacao,
      contaId,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return enviarErro(res, error, "Erro ao cancelar importação.");
  }
}

/* ITENS */

export async function obterItensImportacaoHandler(req, res) {
  try {
    const idImportacao = parseId(req.params.id);

    if (!idImportacao) {
      return res.status(400).json({ error: "ID de importação inválido." });
    }

    const dados = await listarItensImportacao(idImportacao, {
      resultado: req.query.resultado,
      limite: req.query.limite,
      offset: req.query.offset,
    });

    return res.status(200).json(dados);
  } catch (error) {
    return enviarErro(res, error, "Erro ao consultar itens da importação.");
  }
}
