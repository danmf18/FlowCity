'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import './importacoes.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
const ITENS_POR_PAGINA = 50;

function formatarDataHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleString('pt-BR');
}

function formatarNumero(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('pt-BR');
}

function formatarResumoDadosLinha(dados) {
  if (!dados || typeof dados !== 'object') return '—';

  // Formato SSP-SP
  if ('naturezaApurada' in dados || 'numBo' in dados || 'rubrica' in dados) {
    const partes = [];
    if (dados.numBo) partes.push(`BO: ${dados.numBo}`);
    if (dados.naturezaApurada || dados.rubrica) {
      partes.push(dados.naturezaApurada || dados.rubrica);
    }
    if (dados.bairro) partes.push(`Bairro: ${dados.bairro}`);
    if (dados.dataOcorrencia || dados.dataRegistro) {
      partes.push(`Data: ${dados.dataOcorrencia || dados.dataRegistro}`);
    }
    return partes.join(' • ') || '—';
  }

  // Formato IBGE Censo
  if ('populacao' in dados) {
    const local = dados.localidade || dados.bairro || dados.nomeMunicipio || '—';
    const nivel = dados.nivel ? `[${dados.nivel}] ` : '';
    return `${nivel}${local} • Pop.: ${formatarNumero(dados.populacao)}`;
  }

  return JSON.stringify(dados);
}

export default function AdminImportacoesPage() {
  const [meta, setMeta] = useState({ contas: [], fontes: [], municipios: [] });
  const [importacoes, setImportacoes] = useState([]);
  const [filtroFonte, setFiltroFonte] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('ativas');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [processandoId, setProcessandoId] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  const [formUpload, setFormUpload] = useState({
    tipo: 'ssp',
    fk_id_conta_responsavel: '1',
    pagina_origem: '',
    ano_censo: '2022',
    inicio_periodo: '',
    fim_periodo: '',
    arquivo: null,
  });

  const [editando, setEditando] = useState(null);
  const [detalhes, setDetalhes] = useState(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  // Estado do modal de Prévia / Conferência linha a linha (RF05 / RF06 / RNF10)
  const [previa, setPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = filtroFonte ? `?fonte=${encodeURIComponent(filtroFonte)}` : '';
      const res = await fetch(`${API_URL}/importacoes${qs}`);
      if (!res.ok) throw new Error('Erro ao buscar histórico de importações.');
      const json = await res.json();
      setImportacoes(json);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setCarregando(false);
    }
  }, [filtroFonte]);

  useEffect(() => {
    async function carregarMeta() {
      try {
        const res = await fetch(`${API_URL}/importacoes/meta`);
        if (!res.ok) return;
        const json = await res.json();
        setMeta(json);
        if (json.contas?.length > 0) {
          setFormUpload((prev) => ({
            ...prev,
            fk_id_conta_responsavel: String(json.contas[0].id_conta),
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    carregarMeta();
  }, []);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  const { ativas, excluidas } = useMemo(() => {
    const listaAtivas = [];
    const listaExcluidas = [];
    for (const item of importacoes) {
      if (item.excluida_em || item.situacao === 'EXCLUIDA') {
        listaExcluidas.push(item);
      } else {
        listaAtivas.push(item);
      }
    }
    return { ativas: listaAtivas, excluidas: listaExcluidas };
  }, [importacoes]);

  const listaVisivel = abaAtiva === 'ativas' ? ativas : excluidas;

  const carregarItensPrevia = useCallback(
    async (infoBase, filtroResultado = '', pagina = 0) => {
      setCarregandoPrevia(true);
      try {
        const params = new URLSearchParams({
          limite: String(ITENS_POR_PAGINA),
          offset: String(pagina * ITENS_POR_PAGINA),
        });
        if (filtroResultado) params.set('resultado', filtroResultado);

        const res = await fetch(
          `${API_URL}/importacoes/${infoBase.id_importacao}/itens?${params.toString()}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar linhas conferidas.');

        setPrevia({
          id_importacao: infoBase.id_importacao,
          nome_arquivo: infoBase.nome_arquivo || `Importação #${infoBase.id_importacao}`,
          situacao: infoBase.situacao,
          resumo: infoBase.resumo_resultado || infoBase.resumo || '',
          filtroResultado,
          pagina,
          contagemPorResultado: json.contagemPorResultado || {},
          itens: json.itens || [],
        });
      } catch (err) {
        setMensagem({ tipo: 'erro', texto: err.message });
      } finally {
        setCarregandoPrevia(false);
      }
    },
    []
  );

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formUpload.arquivo) {
      setMensagem({ tipo: 'erro', texto: 'Selecione uma planilha .xlsx antes de importar.' });
      return;
    }

    if (
      formUpload.inicio_periodo &&
      formUpload.fim_periodo &&
      formUpload.inicio_periodo > formUpload.fim_periodo
    ) {
      setMensagem({
        tipo: 'erro',
        texto: 'A data de início do período não pode ser posterior à data de fim.',
      });
      return;
    }

    setEnviando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const body = new FormData();
      body.append('tipo', formUpload.tipo);
      body.append('fk_id_conta_responsavel', formUpload.fk_id_conta_responsavel);
      if (formUpload.pagina_origem) body.append('pagina_origem', formUpload.pagina_origem);
      if (formUpload.inicio_periodo) body.append('inicio_periodo', formUpload.inicio_periodo);
      if (formUpload.fim_periodo) body.append('fim_periodo', formUpload.fim_periodo);
      if (formUpload.tipo === 'censo') body.append('ano_censo', formUpload.ano_censo);
      body.append('arquivo', formUpload.arquivo);

      const res = await fetch(`${API_URL}/importacoes`, {
        method: 'POST',
        body,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao conferir planilha.');

      const nomeEnviado = formUpload.arquivo.name;

      setFormUpload((prev) => ({
        ...prev,
        pagina_origem: '',
        inicio_periodo: '',
        fim_periodo: '',
        arquivo: null,
      }));
      const inputArq = document.getElementById('input-arquivo-xlsx');
      if (inputArq) inputArq.value = '';
      setAbaAtiva('ativas');

      await carregarLista();

      if (json.situacao === 'AGUARDANDO_CONFIRMACAO') {
        setMensagem({
          tipo: 'sucesso',
          texto: `Prévia #${json.id_importacao} pronta: ${json.resumo}. Revise abaixo e confirme ou cancele a publicação.`,
        });
        await carregarItensPrevia(
          {
            id_importacao: json.id_importacao,
            nome_arquivo: nomeEnviado,
            situacao: json.situacao,
            resumo: json.resumo,
          },
          '',
          0
        );
      } else {
        setMensagem({
          tipo: 'sucesso',
          texto: `Importação #${json.id_importacao} concluída: ${json.resumo}`,
        });
      }
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const confirmarPublicacao = async (item) => {
    const id = item.id_importacao;
    const confirmado = window.confirm(
      `Confirmar a publicação dos registros aceitos da importação #${id} (${item.nome_arquivo})?`
    );
    if (!confirmado) return;

    setProcessandoId(id);
    setMensagem({ tipo: '', texto: '' });
    try {
      const res = await fetch(`${API_URL}/importacoes/${id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fk_id_conta_responsavel: formUpload.fk_id_conta_responsavel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao confirmar publicação.');

      setMensagem({
        tipo: 'sucesso',
        texto: `Importação #${id} publicada com sucesso (${formatarNumero(json.totalPublicados)} registros efetivamente publicados).`,
      });
      if (previa?.id_importacao === id) {
        setPrevia(null);
      }
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessandoId(null);
    }
  };

  const cancelarImportacaoPendente = async (item) => {
    const id = item.id_importacao;
    const confirmado = window.confirm(
      `Cancelar a importação #${id} (${item.nome_arquivo})? Nenhum registro dela será publicado.`
    );
    if (!confirmado) return;

    setProcessandoId(id);
    setMensagem({ tipo: '', texto: '' });
    try {
      const res = await fetch(`${API_URL}/importacoes/${id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fk_id_conta_responsavel: formUpload.fk_id_conta_responsavel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao cancelar importação.');

      setMensagem({
        tipo: 'sucesso',
        texto: `Importação #${id} cancelada antes da publicação.`,
      });
      if (previa?.id_importacao === id) {
        setPrevia(null);
      }
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessandoId(null);
    }
  };

  const abrirDetalhes = async (id) => {
    setCarregandoDetalhes(true);
    setDetalhes(null);
    try {
      const res = await fetch(`${API_URL}/importacoes/${id}`);
      if (!res.ok) throw new Error('Falha ao carregar detalhes.');
      const json = await res.json();
      setDetalhes(json);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setCarregandoDetalhes(false);
    }
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    if (!editando) return;

    try {
      const res = await fetch(`${API_URL}/importacoes/${editando.id_importacao}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_arquivo: editando.nome_arquivo,
          pagina_origem: editando.pagina_origem,
          inicio_periodo: editando.inicio_periodo || null,
          fim_periodo: editando.fim_periodo || null,
          situacao: editando.situacao,
          resumo_resultado: editando.resumo_resultado,
          fk_id_conta_responsavel: formUpload.fk_id_conta_responsavel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao atualizar importação.');

      setMensagem({ tipo: 'sucesso', texto: json.message });
      setEditando(null);
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    }
  };

  const moverParaLixeira = async (item) => {
    const confirmado = window.confirm(
      `Mover a importação #${item.id_importacao} (${item.nome_arquivo}) para a lixeira? Os dados sairão do dashboard, mas você poderá restaurá-la depois.`
    );
    if (!confirmado) return;

    setProcessandoId(item.id_importacao);
    try {
      const res = await fetch(
        `${API_URL}/importacoes/${item.id_importacao}?contaId=${encodeURIComponent(formUpload.fk_id_conta_responsavel)}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir importação.');

      setMensagem({ tipo: 'sucesso', texto: json.message });
      if (detalhes?.importacao?.id_importacao === item.id_importacao) {
        setDetalhes(null);
      }
      if (previa?.id_importacao === item.id_importacao) {
        setPrevia(null);
      }
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessandoId(null);
    }
  };

  const restaurarRegistro = async (item) => {
    setProcessandoId(item.id_importacao);
    try {
      const res = await fetch(`${API_URL}/importacoes/${item.id_importacao}/restaurar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contaId: formUpload.fk_id_conta_responsavel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao restaurar importação.');

      setMensagem({ tipo: 'sucesso', texto: json.message });
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessandoId(null);
    }
  };

  const apagarPermanentemente = async (item) => {
    const confirmado = window.confirm(
      `Apagar DEFINITIVAMENTE a importação #${item.id_importacao} (${item.nome_arquivo}) e o arquivo salvo? Esta ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setProcessandoId(item.id_importacao);
    try {
      const res = await fetch(
        `${API_URL}/importacoes/${item.id_importacao}/permanente?contaId=${encodeURIComponent(formUpload.fk_id_conta_responsavel)}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao apagar importação.');

      setMensagem({ tipo: 'sucesso', texto: json.message });
      if (detalhes?.importacao?.id_importacao === item.id_importacao) {
        setDetalhes(null);
      }
      if (previa?.id_importacao === item.id_importacao) {
        setPrevia(null);
      }
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessandoId(null);
    }
  };

  const totalAceitosPrevia = Number(previa?.contagemPorResultado?.ACEITO || 0);
  const totalDuplicadosPrevia = Number(previa?.contagemPorResultado?.DUPLICADO || 0);
  const totalConflitantesPrevia = Number(previa?.contagemPorResultado?.CONFLITANTE || 0);
  const totalProblemasPrevia = Number(previa?.contagemPorResultado?.PROBLEMA || 0);
  const totalGeralPrevia =
    totalAceitosPrevia +
    totalDuplicadosPrevia +
    totalConflitantesPrevia +
    totalProblemasPrevia;

  const totalFiltradoPrevia = previa?.filtroResultado
    ? Number(previa?.contagemPorResultado?.[previa.filtroResultado] || 0)
    : totalGeralPrevia;
  const temProximaPagina =
    previa && (previa.pagina + 1) * ITENS_POR_PAGINA < totalFiltradoPrevia;

  return (
    <div className="home-alertabc imp-wrapper">
      <main className="imp-main">
        <header className="imp-header">
          <div>
            <h1>GERENCIAR IMPORTAÇÕES</h1>
            <p>
              Conferência, prévia, publicação, auditoria, lixeira e restauração de planilhas oficiais (SSP-SP e Censo IBGE)
            </p>
          </div>
          <Link href="/dashboard" className="imp-btn-secundario">
            Ir para o Dashboard
          </Link>
        </header>

        {mensagem.texto && (
          <div className={`imp-alerta ${mensagem.tipo}`}>{mensagem.texto}</div>
        )}

        <section className="imp-card">
          <div className="imp-card-topo">
            <h2>Nova Importação</h2>
            <span>
              Primeiro é gerada uma prévia com aceitos, duplicados, conflitantes e problemas antes da publicação
            </span>
          </div>

          <form className="imp-form-grid" onSubmit={handleUpload}>
            <div className="imp-campo">
              <label htmlFor="f-tipo">Tipo de Planilha</label>
              <select
                id="f-tipo"
                value={formUpload.tipo}
                onChange={(e) => setFormUpload((prev) => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="ssp">SSP-SP — Dados Criminais</option>
                <option value="censo">IBGE — Censo Demográfico</option>
              </select>
            </div>

            <div className="imp-campo">
              <label htmlFor="f-conta">Responsável pela Inserção</label>
              <select
                id="f-conta"
                value={formUpload.fk_id_conta_responsavel}
                onChange={(e) =>
                  setFormUpload((prev) => ({ ...prev, fk_id_conta_responsavel: e.target.value }))
                }
              >
                {meta.contas.length === 0 ? (
                  <option value="1">Administrador AlertABC</option>
                ) : (
                  meta.contas.map((c) => (
                    <option key={c.id_conta} value={c.id_conta}>
                      {c.nome} ({c.perfil})
                    </option>
                  ))
                )}
              </select>
            </div>

            {formUpload.tipo === 'censo' && (
              <div className="imp-campo">
                <label htmlFor="f-ano">Ano do Censo</label>
                <input
                  id="f-ano"
                  type="number"
                  min="2000"
                  max="2100"
                  value={formUpload.ano_censo}
                  onChange={(e) =>
                    setFormUpload((prev) => ({ ...prev, ano_censo: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="imp-campo">
              <label htmlFor="f-inicio">Início do Período (opcional)</label>
              <input
                id="f-inicio"
                type="date"
                value={formUpload.inicio_periodo}
                onChange={(e) =>
                  setFormUpload((prev) => ({ ...prev, inicio_periodo: e.target.value }))
                }
              />
            </div>

            <div className="imp-campo">
              <label htmlFor="f-fim">Fim do Período (opcional)</label>
              <input
                id="f-fim"
                type="date"
                value={formUpload.fim_periodo}
                onChange={(e) =>
                  setFormUpload((prev) => ({ ...prev, fim_periodo: e.target.value }))
                }
              />
            </div>

            <div className="imp-campo">
              <label htmlFor="f-origem">Página de Origem (opcional)</label>
              <input
                id="f-origem"
                type="url"
                placeholder="https://..."
                value={formUpload.pagina_origem}
                onChange={(e) =>
                  setFormUpload((prev) => ({ ...prev, pagina_origem: e.target.value }))
                }
              />
            </div>

            <div className="imp-campo imp-campo-arquivo">
              <label htmlFor="input-arquivo-xlsx">Arquivo Excel (.xlsx)</label>
              <input
                id="input-arquivo-xlsx"
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  const nome = file?.name?.toLowerCase() || '';
                  setFormUpload((prev) => ({
                    ...prev,
                    arquivo: file,
                    tipo:
                      nome.includes('tabela') || nome.includes('censo') || nome.includes('ibge')
                        ? 'censo'
                        : nome.includes('dadoscriminais') || nome.includes('ssp')
                          ? 'ssp'
                          : prev.tipo,
                  }));
                }}
              />
            </div>

            <div className="imp-acoes-form">
              <button type="submit" className="imp-btn-primario" disabled={enviando}>
                {enviando ? 'Conferindo planilha...' : 'Conferir e Gerar Prévia'}
              </button>
            </div>
          </form>
        </section>

        <section className="imp-card">
          <div className="imp-card-topo">
            <div className="imp-tabs">
              <button
                type="button"
                className={`imp-tab ${abaAtiva === 'ativas' ? 'ativa' : ''}`}
                onClick={() => setAbaAtiva('ativas')}
              >
                Importações Ativas ({ativas.length})
              </button>
              <button
                type="button"
                className={`imp-tab ${abaAtiva === 'lixeira' ? 'ativa' : ''}`}
                onClick={() => setAbaAtiva('lixeira')}
              >
                Lixeira ({excluidas.length})
              </button>
            </div>

            <div className="imp-filtro-inline">
              <select
                aria-label="Filtrar por fonte"
                value={filtroFonte}
                onChange={(e) => setFiltroFonte(e.target.value)}
              >
                <option value="">Todas as fontes</option>
                {meta.fontes.map((f) => (
                  <option key={f.id_fonte} value={f.id_fonte}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {carregando ? (
            <p className="imp-vazio">Carregando importações...</p>
          ) : listaVisivel.length === 0 ? (
            <p className="imp-vazio">
              {abaAtiva === 'ativas'
                ? 'Nenhuma importação ativa registrada.'
                : 'A lixeira está vazia.'}
            </p>
          ) : (
            <div className="imp-tabela-wrap">
              <table className="imp-tabela">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Arquivo</th>
                    <th>Fonte</th>
                    <th>Inserido por</th>
                    <th>Registros</th>
                    <th>{abaAtiva === 'ativas' ? 'Período' : 'Excluída em'}</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaVisivel.map((item) => {
                    const aguardando = item.situacao === 'AGUARDANDO_CONFIRMACAO';
                    const cancelada = item.situacao === 'CANCELADA';
                    const totalCrimes = Number(item.total_registros_criminais || 0);
                    const totalCenso = Number(item.total_registros_censo || 0);

                    let totalVinculado = '0 registros';
                    if (totalCrimes > 0) {
                      totalVinculado = `${formatarNumero(totalCrimes)} crimes`;
                    } else if (totalCenso > 0) {
                      totalVinculado = `${formatarNumero(totalCenso)} censo`;
                    } else if (aguardando) {
                      totalVinculado = 'Aguardando confirmação';
                    } else if (cancelada) {
                      totalVinculado = 'Não publicada';
                    }

                    const ocupado = processandoId === item.id_importacao;

                    return (
                      <tr key={item.id_importacao}>
                        <td data-label="ID">#{item.id_importacao}</td>
                        <td data-label="Arquivo">
                          <div className="imp-arq-nome">{item.nome_arquivo}</div>
                          <small className="imp-sub">{formatarDataHora(item.enviada_em)}</small>
                        </td>
                        <td data-label="Fonte">{item.fonte_nome}</td>
                        <td data-label="Inserido por">
                          <div>{item.responsavel_nome}</div>
                          <small className="imp-sub">{item.responsavel_email}</small>
                        </td>
                        <td data-label="Registros">{totalVinculado}</td>
                        <td data-label={abaAtiva === 'ativas' ? 'Período' : 'Excluída em'}>
                          {abaAtiva === 'ativas'
                            ? `${item.inicio_periodo || '—'} até ${item.fim_periodo || '—'}`
                            : formatarDataHora(item.excluida_em)}
                        </td>
                        <td data-label="Situação">
                          <span className={`imp-badge ${String(item.situacao).toLowerCase()}`}>
                            {item.situacao}
                          </span>
                        </td>
                        <td data-label="Ações">
                          <div className="imp-btns-linha">
                            {aguardando && (
                              <>
                                <button
                                  type="button"
                                  className="imp-btn-acao"
                                  onClick={() => carregarItensPrevia(item, '', 0)}
                                  disabled={ocupado}
                                >
                                  Prévia
                                </button>
                                <button
                                  type="button"
                                  className="imp-btn-acao confirmar"
                                  onClick={() => confirmarPublicacao(item)}
                                  disabled={ocupado}
                                >
                                  {ocupado ? '...' : 'Confirmar'}
                                </button>
                                <button
                                  type="button"
                                  className="imp-btn-acao perigo"
                                  onClick={() => cancelarImportacaoPendente(item)}
                                  disabled={ocupado}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {!aguardando && (
                              <>
                                <button
                                  type="button"
                                  className="imp-btn-acao"
                                  onClick={() => abrirDetalhes(item.id_importacao)}
                                  disabled={ocupado}
                                >
                                  Ver
                                </button>
                                <button
                                  type="button"
                                  className="imp-btn-acao"
                                  onClick={() => carregarItensPrevia(item, '', 0)}
                                  disabled={ocupado}
                                >
                                  Linhas
                                </button>
                              </>
                            )}

                            {Boolean(item.tem_arquivo) && (
                              <a
                                href={`${API_URL}/importacoes/${item.id_importacao}/arquivo`}
                                className="imp-btn-acao"
                              >
                                Baixar
                              </a>
                            )}

                            {abaAtiva === 'ativas' ? (
                              <>
                                {!aguardando && (
                                  <button
                                    type="button"
                                    className="imp-btn-acao"
                                    onClick={() => setEditando({ ...item })}
                                    disabled={ocupado}
                                  >
                                    Editar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="imp-btn-acao perigo"
                                  onClick={() => moverParaLixeira(item)}
                                  disabled={ocupado}
                                >
                                  {ocupado ? '...' : 'Excluir'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="imp-btn-acao restaurar"
                                  onClick={() => restaurarRegistro(item)}
                                  disabled={ocupado}
                                >
                                  {ocupado ? '...' : 'Restaurar'}
                                </button>
                                <button
                                  type="button"
                                  className="imp-btn-acao perigo"
                                  onClick={() => apagarPermanentemente(item)}
                                  disabled={ocupado}
                                >
                                  Apagar de vez
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Modal de Prévia / Conferência linha a linha (RF05, RF06, RNF10) */}
        {(carregandoPrevia || previa) && (
          <div
            className="imp-modal-backdrop"
            onClick={() => !carregandoPrevia && setPrevia(null)}
          >
            <div className="imp-modal imp-modal-grande" onClick={(e) => e.stopPropagation()}>
              <div className="imp-card-topo">
                <div>
                  <h2>
                    {previa
                      ? `Conferência da Importação #${previa.id_importacao}`
                      : 'Carregando conferência...'}
                  </h2>
                  {previa && <small className="imp-sub">{previa.nome_arquivo}</small>}
                </div>
                <button
                  type="button"
                  className="imp-btn-acao"
                  onClick={() => setPrevia(null)}
                >
                  Fechar
                </button>
              </div>

              {previa && (
                <>
                  {previa.resumo && <p className="imp-previa-resumo">{previa.resumo}</p>}

                  <div className="imp-previa-cards">
                    <button
                      type="button"
                      className={`imp-previa-pill ${previa.filtroResultado === '' ? 'ativa' : ''}`}
                      onClick={() => carregarItensPrevia(previa, '', 0)}
                    >
                      Todos ({formatarNumero(totalGeralPrevia)})
                    </button>
                    <button
                      type="button"
                      className={`imp-previa-pill aceito ${previa.filtroResultado === 'ACEITO' ? 'ativa' : ''}`}
                      onClick={() => carregarItensPrevia(previa, 'ACEITO', 0)}
                    >
                      Aceitos ({formatarNumero(totalAceitosPrevia)})
                    </button>
                    <button
                      type="button"
                      className={`imp-previa-pill duplicado ${previa.filtroResultado === 'DUPLICADO' ? 'ativa' : ''}`}
                      onClick={() => carregarItensPrevia(previa, 'DUPLICADO', 0)}
                    >
                      Duplicados ({formatarNumero(totalDuplicadosPrevia)})
                    </button>
                    <button
                      type="button"
                      className={`imp-previa-pill conflitante ${previa.filtroResultado === 'CONFLITANTE' ? 'ativa' : ''}`}
                      onClick={() => carregarItensPrevia(previa, 'CONFLITANTE', 0)}
                    >
                      Conflitantes ({formatarNumero(totalConflitantesPrevia)})
                    </button>
                    <button
                      type="button"
                      className={`imp-previa-pill problema ${previa.filtroResultado === 'PROBLEMA' ? 'ativa' : ''}`}
                      onClick={() => carregarItensPrevia(previa, 'PROBLEMA', 0)}
                    >
                      Problemas ({formatarNumero(totalProblemasPrevia)})
                    </button>
                  </div>

                  {carregandoPrevia ? (
                    <p className="imp-vazio">Carregando linhas...</p>
                  ) : previa.itens.length === 0 ? (
                    <p className="imp-vazio">Nenhuma linha encontrada para este filtro.</p>
                  ) : (
                    <div className="imp-tabela-wrap imp-previa-scroll">
                      <table className="imp-tabela">
                        <thead>
                          <tr>
                            <th>Aba / Linha</th>
                            <th>Município</th>
                            <th>Resultado</th>
                            <th>Dados</th>
                            <th>Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previa.itens.map((it) => (
                            <tr key={it.id_item_importacao}>
                              <td data-label="Linha">
                                {it.nome_aba || '—'} #{it.numero_linha}
                              </td>
                              <td data-label="Município" className="capitalize">
                                {it.municipio_informado || '—'}
                              </td>
                              <td data-label="Resultado">
                                <span
                                  className={`imp-badge ${String(it.resultado || '').toLowerCase()}`}
                                >
                                  {it.resultado}
                                </span>
                              </td>
                              <td data-label="Dados">
                                <small>{formatarResumoDadosLinha(it.dados_recebidos)}</small>
                              </td>
                              <td data-label="Motivo">
                                <small>{it.motivo || 'Pronto para publicação'}</small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="imp-previa-rodape">
                    <div className="imp-paginacao">
                      <button
                        type="button"
                        className="imp-btn-acao"
                        disabled={previa.pagina === 0 || carregandoPrevia}
                        onClick={() =>
                          carregarItensPrevia(previa, previa.filtroResultado, previa.pagina - 1)
                        }
                      >
                        Anterior
                      </button>
                      <small className="imp-sub">
                        Página {previa.pagina + 1} de{' '}
                        {Math.max(1, Math.ceil(totalFiltradoPrevia / ITENS_POR_PAGINA))}
                      </small>
                      <button
                        type="button"
                        className="imp-btn-acao"
                        disabled={!temProximaPagina || carregandoPrevia}
                        onClick={() =>
                          carregarItensPrevia(previa, previa.filtroResultado, previa.pagina + 1)
                        }
                      >
                        Próxima
                      </button>
                    </div>

                    {previa.situacao === 'AGUARDANDO_CONFIRMACAO' && (
                      <div className="imp-acoes-modal">
                        <button
                          type="button"
                          className="imp-btn-acao perigo"
                          disabled={processandoId === previa.id_importacao}
                          onClick={() => cancelarImportacaoPendente(previa)}
                        >
                          Cancelar Importação
                        </button>
                        <button
                          type="button"
                          className="imp-btn-primario"
                          disabled={
                            totalAceitosPrevia === 0 || processandoId === previa.id_importacao
                          }
                          title={
                            totalAceitosPrevia === 0
                              ? 'É necessário ao menos 1 registro aceito para publicar (RN14).'
                              : 'Publicar registros aceitos'
                          }
                          onClick={() => confirmarPublicacao(previa)}
                        >
                          {processandoId === previa.id_importacao
                            ? 'Publicando...'
                            : `Confirmar Publicação (${formatarNumero(totalAceitosPrevia)})`}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {editando && (
          <div className="imp-modal-backdrop" onClick={() => setEditando(null)}>
            <div className="imp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="imp-card-topo">
                <h2>Editar Importação #{editando.id_importacao}</h2>
                <button
                  type="button"
                  className="imp-btn-acao"
                  onClick={() => setEditando(null)}
                >
                  Fechar
                </button>
              </div>

              <form className="imp-form-modal" onSubmit={salvarEdicao}>
                <div className="imp-campo">
                  <label>Nome do Arquivo</label>
                  <input
                    type="text"
                    value={editando.nome_arquivo || ''}
                    onChange={(e) =>
                      setEditando((prev) => ({ ...prev, nome_arquivo: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="imp-campo">
                  <label>Página de Origem</label>
                  <input
                    type="text"
                    value={editando.pagina_origem || ''}
                    onChange={(e) =>
                      setEditando((prev) => ({ ...prev, pagina_origem: e.target.value }))
                    }
                  />
                </div>

                <div className="imp-grid-2">
                  <div className="imp-campo">
                    <label>Início do Período</label>
                    <input
                      type="date"
                      value={editando.inicio_periodo || ''}
                      onChange={(e) =>
                        setEditando((prev) => ({ ...prev, inicio_periodo: e.target.value }))
                      }
                    />
                  </div>
                  <div className="imp-campo">
                    <label>Fim do Período</label>
                    <input
                      type="date"
                      value={editando.fim_periodo || ''}
                      onChange={(e) =>
                        setEditando((prev) => ({ ...prev, fim_periodo: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="imp-campo">
                  <label>Situação</label>
                  <select
                    value={editando.situacao || 'PUBLICADA'}
                    onChange={(e) =>
                      setEditando((prev) => ({ ...prev, situacao: e.target.value }))
                    }
                  >
                    <option value="PUBLICADA">PUBLICADA</option>
                    <option value="AGUARDANDO_CONFIRMACAO">AGUARDANDO_CONFIRMACAO</option>
                    <option value="CANCELADA">CANCELADA</option>
                    <option value="CONCLUIDA">CONCLUIDA</option>
                    <option value="EM_PROCESSO">EM_PROCESSO</option>
                    <option value="ERRO">ERRO</option>
                    <option value="ARQUIVADA">ARQUIVADA</option>
                  </select>
                </div>

                <div className="imp-campo">
                  <label>Resumo do Resultado</label>
                  <textarea
                    rows={3}
                    value={editando.resumo_resultado || ''}
                    onChange={(e) =>
                      setEditando((prev) => ({ ...prev, resumo_resultado: e.target.value }))
                    }
                  />
                </div>

                <div className="imp-acoes-modal">
                  <button
                    type="button"
                    className="imp-btn-secundario"
                    onClick={() => setEditando(null)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="imp-btn-primario">
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {(carregandoDetalhes || detalhes) && (
          <section className="imp-card">
            <div className="imp-card-topo">
              <h2>
                {detalhes
                  ? `Detalhes da Importação #${detalhes.importacao.id_importacao}`
                  : 'Carregando detalhes...'}
              </h2>
              {detalhes && (
                <div className="imp-btns-linha">
                  <button
                    type="button"
                    className="imp-btn-acao"
                    onClick={() => carregarItensPrevia(detalhes.importacao, '', 0)}
                  >
                    Ver linhas conferidas
                  </button>
                  <button
                    type="button"
                    className="imp-btn-acao"
                    onClick={() => setDetalhes(null)}
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>

            {detalhes && (
              <div className="imp-detalhes-grid">
                <div>
                  <p>
                    <strong>Arquivo:</strong> {detalhes.importacao.nome_arquivo}
                  </p>
                  <p>
                    <strong>Fonte:</strong> {detalhes.importacao.fonte_nome}
                  </p>
                  <p>
                    <strong>Responsável:</strong> {detalhes.importacao.responsavel_nome} (
                    {detalhes.importacao.responsavel_email})
                  </p>
                  <p>
                    <strong>Resumo:</strong> {detalhes.importacao.resumo_resultado || '—'}
                  </p>
                </div>

                <div>
                  <h3>Auditoria (Ações Administrativas)</h3>
                  <ul className="imp-lista-simples">
                    {detalhes.acoes.map((a) => (
                      <li key={a.id_acao}>
                        <strong>{a.tipo}</strong> — {a.responsavel_nome} em{' '}
                        {formatarDataHora(a.realizada_em)}
                        <div className="imp-sub">{a.detalhes}</div>
                      </li>
                    ))}
                  </ul>
                </div>

                {detalhes.amostraCenso?.length > 0 && (
                  <div className="imp-col-full">
                    <h3>Amostra do Censo Demográfico</h3>
                    <div className="imp-tabela-wrap">
                      <table className="imp-tabela">
                        <thead>
                          <tr>
                            <th>Ano</th>
                            <th>Nível</th>
                            <th>Município</th>
                            <th>Bairro</th>
                            <th>População</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalhes.amostraCenso.map((c) => (
                            <tr key={c.id_censo}>
                              <td data-label="Ano">{c.ano_censo}</td>
                              <td data-label="Nível">{c.nivel_territorial}</td>
                              <td data-label="Município" className="capitalize">
                                {c.nome_municipio}
                              </td>
                              <td data-label="Bairro" className="capitalize">
                                {c.bairro || '—'}
                              </td>
                              <td data-label="População">{formatarNumero(c.populacao)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}