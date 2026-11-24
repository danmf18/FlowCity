'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import './importacoes.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

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
    arquivo: null,
  });

  const [editando, setEditando] = useState(null);
  const [detalhes, setDetalhes] = useState(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formUpload.arquivo) {
      setMensagem({ tipo: 'erro', texto: 'Selecione uma planilha .xlsx antes de importar.' });
      return;
    }

    setEnviando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const body = new FormData();
      body.append('tipo', formUpload.tipo);
      body.append('fk_id_conta_responsavel', formUpload.fk_id_conta_responsavel);
      if (formUpload.pagina_origem) body.append('pagina_origem', formUpload.pagina_origem);
      if (formUpload.tipo === 'censo') body.append('ano_censo', formUpload.ano_censo);
      body.append('arquivo', formUpload.arquivo);

      const res = await fetch(`${API_URL}/importacoes`, {
        method: 'POST',
        body,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao importar planilha.');

      setMensagem({
        tipo: 'sucesso',
        texto: `Importação #${json.id_importacao} concluída: ${json.resumo}`,
      });
      setFormUpload((prev) => ({ ...prev, pagina_origem: '', arquivo: null }));
      const inputArq = document.getElementById('input-arquivo-xlsx');
      if (inputArq) inputArq.value = '';
      setAbaAtiva('ativas');
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setEnviando(false);
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
      carregarLista();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="home-alertabc imp-wrapper">
      <main className="imp-main">
        <header className="imp-header">
          <div>
            <h1>GERENCIAR IMPORTAÇÕES</h1>
            <p>Envio, auditoria, lixeira e restauração de planilhas oficiais (SSP-SP e Censo IBGE)</p>
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
            <span>Os arquivos enviados ficam arquivados e podem ser restaurados caso sejam excluídos</span>
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
                {enviando ? 'Processando planilha...' : 'Importar Planilha'}
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
                    const totalVinculado =
                      Number(item.total_registros_criminais) > 0
                        ? `${formatarNumero(item.total_registros_criminais)} crimes`
                        : `${formatarNumero(item.total_registros_censo)} censo`;
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
                            <button
                              type="button"
                              className="imp-btn-acao"
                              onClick={() => abrirDetalhes(item.id_importacao)}
                              disabled={ocupado}
                            >
                              Ver
                            </button>

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
                                <button
                                  type="button"
                                  className="imp-btn-acao"
                                  onClick={() => setEditando({ ...item })}
                                  disabled={ocupado}
                                >
                                  Editar
                                </button>
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
                    value={editando.situacao || 'CONCLUIDA'}
                    onChange={(e) =>
                      setEditando((prev) => ({ ...prev, situacao: e.target.value }))
                    }
                  >
                    <option value="CONCLUIDA">CONCLUIDA</option>
                    <option value="PROCESSANDO">PROCESSANDO</option>
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
                <button
                  type="button"
                  className="imp-btn-acao"
                  onClick={() => setDetalhes(null)}
                >
                  Fechar
                </button>
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