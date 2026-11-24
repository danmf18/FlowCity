import fs from "node:fs/promises";
import {
  alertabcPool,
  garantirEstruturaImportacoes,
  recalcularPopulacaoRegistros,
  importarPlanilhaCenso,
  importarPlanilhaCrimes,
} from "../services/importacaoEtlService.js";

function parseId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const obterMetadados = async (req, res) => {
  try {
    await garantirEstruturaImportacoes();

    const [[contas], [fontes], [municipios]] = await Promise.all([
      alertabcPool.query(
        "SELECT id_conta, nome, email, perfil FROM contas ORDER BY nome ASC"
      ),
      alertabcPool.query(
        "SELECT id_fonte, nome FROM fontes ORDER BY id_fonte ASC"
      ),
      alertabcPool.query(
        "SELECT id_municipio, nome, codigo_ibge FROM municipios ORDER BY nome ASC"
      ),
    ]);

    res.json({ contas, fontes, municipios });
  } catch (error) {
    console.error("Erro ao carregar metadados de importação:", error);
    res.status(500).json({ error: "Erro ao carregar metadados." });
  }
};

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
      condicoes.push("i.fk_id_fonte = ?");
      params.push(Number(fonte));
    }
    if (situacao) {
      condicoes.push("i.situacao = ?");
      params.push(situacao);
    }

    const [rows] = await alertabcPool.query(
      `SELECT
        i.id_importacao,
        i.nome_arquivo,
        CASE WHEN i.caminho_arquivo IS NOT NULL AND i.caminho_arquivo <> '' THEN 1 ELSE 0 END AS tem_arquivo,
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
        (SELECT COUNT(*) FROM registro_oficial r WHERE r.fk_id_importacao = i.id_importacao) AS total_registros_criminais,
        (SELECT COUNT(*) FROM censo_demografico cd WHERE cd.fk_id_importacao = i.id_importacao) AS total_registros_censo
      FROM importacoes i
      JOIN contas c ON c.id_conta = i.fk_id_conta_responsavel
      JOIN fontes f ON f.id_fonte = i.fk_id_fonte
      WHERE ${condicoes.join(" AND ")}
      ORDER BY i.id_importacao DESC`,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar importações:", error);
    res.status(500).json({ error: "Erro ao listar importações." });
  }
};

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
        CASE WHEN i.caminho_arquivo IS NOT NULL AND i.caminho_arquivo <> '' THEN 1 ELSE 0 END AS tem_arquivo,
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
      JOIN contas c ON c.id_conta = i.fk_id_conta_responsavel
      JOIN fontes f ON f.id_fonte = i.fk_id_fonte
      WHERE i.id_importacao = ?`,
      [id]
    );

    if (!importacao) {
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    const [[itens], [acoes], [amostraCenso]] = await Promise.all([
      alertabcPool.query(
        `SELECT id_item_importacao, numero_linha, resultado, motivo, municipio_informado, nome_aba, dados_recebidos
         FROM item_importacao
         WHERE fk_id_importacao = ?
         ORDER BY id_item_importacao DESC
         LIMIT 50`,
        [id]
      ),
      alertabcPool.query(
        `SELECT a.id_acao, a.tipo, a.realizada_em, a.detalhes, c.nome AS responsavel_nome
         FROM acoes_administrativas a
         JOIN contas c ON c.id_conta = a.fk_id_conta_responsavel
         WHERE a.fk_id_importacao = ?
         ORDER BY a.realizada_em DESC`,
        [id]
      ),
      alertabcPool.query(
        `SELECT id_censo, ano_censo, nivel_territorial, cod_ibge, nome_municipio, bairro, populacao
         FROM censo_demografico
         WHERE fk_id_importacao = ?
         ORDER BY nivel_territorial DESC, nome_municipio ASC, bairro ASC
         LIMIT 50`,
        [id]
      ),
    ]);

    res.json({
      importacao,
      itens,
      acoes,
      amostraCenso,
    });
  } catch (error) {
    console.error("Erro ao detalhar importação:", error);
    res.status(500).json({ error: "Erro ao carregar detalhes da importação." });
  }
};

export const criarImportacao = async (req, res) => {
  const arquivo = req.file;
  if (!arquivo) {
    return res.status(400).json({ error: "Envie um arquivo .xlsx para importar." });
  }

  try {
    const tipo = String(req.body.tipo || "ssp").toLowerCase();
    const contaId = Number(req.user?.id_conta || req.body.fk_id_conta_responsavel || 1);
    const paginaOrigem = req.body.pagina_origem ? String(req.body.pagina_origem).trim() : null;
    const anoCenso = Number(req.body.ano_censo || 2022);
    const nomeOriginal = Buffer.from(arquivo.originalname, "latin1").toString("utf8");

    let resultado;
    if (tipo === "censo") {
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
      await fs.unlink(arquivo.path).catch(() => {});
      return res.status(400).json({ error: "Tipo de importação inválido. Use 'ssp' ou 'censo'." });
    }

    res.status(201).json(resultado);
  } catch (error) {
    await fs.unlink(arquivo.path).catch(() => {});
    console.error("Erro ao importar planilha:", error);
    res.status(500).json({ error: error.message || "Erro ao processar a planilha." });
  }
};

export const atualizarImportacao = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  const conn = await alertabcPool.getConnection();
  try {
    await garantirEstruturaImportacoes();
    const {
      nome_arquivo,
      pagina_origem,
      inicio_periodo,
      fim_periodo,
      situacao,
      resumo_resultado,
      fk_id_conta_responsavel,
    } = req.body;

    const contaAcao = Number(req.user?.id_conta || fk_id_conta_responsavel || 1);

    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      "SELECT id_importacao, nome_arquivo FROM importacoes WHERE id_importacao = ?",
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
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('EDICAO_IMPORTACAO', ?, ?, NULL, ?)`,
      [`Metadados da importação #${id} (${nome_arquivo || atual.nome_arquivo}) atualizados.`, contaAcao, id]
    );

    await conn.commit();
    res.json({ message: "Importação atualizada com sucesso." });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao atualizar importação:", error);
    res.status(500).json({ error: "Erro ao atualizar importação." });
  } finally {
    conn.release();
  }
};

export const excluirImportacao = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  const conn = await alertabcPool.getConnection();
  try {
    await garantirEstruturaImportacoes();
    const contaAcao = Number(req.user?.id_conta || req.query.contaId || 1);

    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      "SELECT id_importacao, nome_arquivo, fk_id_fonte, excluida_em FROM importacoes WHERE id_importacao = ?",
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
      "UPDATE registro_oficial SET ativo = 0 WHERE fk_id_importacao = ?",
      [id]
    );
    await conn.query(
      "UPDATE censo_demografico SET ativo = 0 WHERE fk_id_importacao = ?",
      [id]
    );
    await conn.query(
      "UPDATE importacoes SET situacao = 'EXCLUIDA', excluida_em = CURRENT_TIMESTAMP WHERE id_importacao = ?",
      [id]
    );

    if (Number(atual.fk_id_fonte) === 1) {
      await recalcularPopulacaoRegistros(conn);
    }

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('EXCLUSAO_IMPORTACAO', ?, ?, NULL, ?)`,
      [`Importação #${id} (${atual.nome_arquivo}) movida para a lixeira e ocultada do dashboard.`, contaAcao, id]
    );

    await conn.commit();
    res.json({ message: "Importação movida para a lixeira. Você pode restaurá-la quando quiser." });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao mover importação para a lixeira:", error);
    res.status(500).json({ error: "Erro ao excluir importação." });
  } finally {
    conn.release();
  }
};

export const restaurarImportacao = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  const conn = await alertabcPool.getConnection();
  try {
    await garantirEstruturaImportacoes();
    const contaAcao = Number(req.user?.id_conta || req.body?.contaId || req.query.contaId || 1);

    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      "SELECT id_importacao, nome_arquivo, fk_id_fonte, excluida_em FROM importacoes WHERE id_importacao = ?",
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
      "UPDATE registro_oficial SET ativo = 1 WHERE fk_id_importacao = ?",
      [id]
    );
    await conn.query(
      "UPDATE censo_demografico SET ativo = 1 WHERE fk_id_importacao = ?",
      [id]
    );
    await conn.query(
      "UPDATE importacoes SET situacao = 'CONCLUIDA', excluida_em = NULL WHERE id_importacao = ?",
      [id]
    );

    await recalcularPopulacaoRegistros(conn);

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('RESTAURACAO_IMPORTACAO', ?, ?, NULL, ?)`,
      [`Importação #${id} (${atual.nome_arquivo}) restaurada para o painel ativo.`, contaAcao, id]
    );

    await conn.commit();
    res.json({ message: "Importação e registros vinculados restaurados com sucesso." });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao restaurar importação:", error);
    res.status(500).json({ error: "Erro ao restaurar importação." });
  } finally {
    conn.release();
  }
};

export const excluirPermanentemente = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID de importação inválido." });
  }

  const conn = await alertabcPool.getConnection();
  try {
    await garantirEstruturaImportacoes();
    const contaAcao = Number(req.user?.id_conta || req.query.contaId || 1);

    await conn.beginTransaction();

    const [[atual]] = await conn.query(
      "SELECT id_importacao, nome_arquivo, caminho_arquivo, fk_id_fonte FROM importacoes WHERE id_importacao = ?",
      [id]
    );
    if (!atual) {
      await conn.rollback();
      return res.status(404).json({ error: "Importação não encontrada." });
    }

    await conn.query("DELETE FROM registro_oficial WHERE fk_id_importacao = ?", [id]);
    await conn.query("DELETE FROM censo_demografico WHERE fk_id_importacao = ?", [id]);
    await conn.query("DELETE FROM item_importacao WHERE fk_id_importacao = ?", [id]);
    await conn.query(
      "UPDATE acoes_administrativas SET fk_id_importacao = NULL WHERE fk_id_importacao = ?",
      [id]
    );
    await conn.query("DELETE FROM importacoes WHERE id_importacao = ?", [id]);

    if (Number(atual.fk_id_fonte) === 1) {
      await recalcularPopulacaoRegistros(conn);
    }

    await conn.query(
      `INSERT INTO acoes_administrativas
        (tipo, detalhes, fk_id_conta_responsavel, fk_id_conta_afetada, fk_id_importacao)
       VALUES ('EXCLUSAO_PERMANENTE_IMPORTACAO', ?, ?, NULL, NULL)`,
      [`Importação #${id} (${atual.nome_arquivo}) e seu arquivo físico foram removidos permanentemente.`, contaAcao]
    );

    await conn.commit();

    if (atual.caminho_arquivo) {
      await fs.unlink(atual.caminho_arquivo).catch(() => {});
    }

    res.json({ message: "Importação removida permanentemente do banco e do disco." });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao excluir importação permanentemente:", error);
    res.status(500).json({ error: "Erro ao excluir importação permanentemente." });
  } finally {
    conn.release();
  }
};

export const baixarArquivoImportacao = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID de importação inválido." });
    }

    await garantirEstruturaImportacoes();

    const [[atual]] = await alertabcPool.query(
      "SELECT nome_arquivo, caminho_arquivo FROM importacoes WHERE id_importacao = ?",
      [id]
    );
    if (!atual || !atual.caminho_arquivo) {
      return res.status(404).json({ error: "Arquivo original não está arquivado para esta importação." });
    }

    try {
      await fs.access(atual.caminho_arquivo);
    } catch {
      return res.status(404).json({ error: "Arquivo não encontrado no servidor." });
    }

    return res.download(atual.caminho_arquivo, atual.nome_arquivo);
  } catch (error) {
    console.error("Erro ao baixar arquivo da importação:", error);
    res.status(500).json({ error: "Erro ao baixar arquivo." });
  }
};