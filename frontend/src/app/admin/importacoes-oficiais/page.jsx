"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./importacoes-oficiais.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

const IMPORTACOES_URL = `${API_URL}/admin-geral/importacoes`;

export default function ImportacoesOficiaisPage() {
  const [aba, setAba] = useState("todas");
  const [importacoes, setImportacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [detalhes, setDetalhes] = useState(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);
  const [anoCenso, setAnoCenso] = useState(2022);

  const arquivoIBGERef = useRef(null);
  const arquivoSSPRef = useRef(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  const requisicao = useCallback(
    async (url, options = {}) => {
      const resposta = await fetch(url, {
        ...options,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados.error || dados.message || "Erro ao realizar operação."
        );
      }

      return dados;
    },
    [token]
  );

  const carregarImportacoes = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const dados = await requisicao(IMPORTACOES_URL);

      setImportacoes(Array.isArray(dados) ? dados : []);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [requisicao]);

  useEffect(() => {
    carregarImportacoes();
  }, [carregarImportacoes]);

  function obterFonte(item) {
    const nome = String(item.fonte_nome || "").toLowerCase();

    if (nome.includes("ibge") || nome.includes("censo")) {
      return "IBGE";
    }

    return "SSP-SP";
  }

  function formatarData(data) {
    if (!data) return "—";

    return new Date(data).toLocaleString("pt-BR");
  }

  function formatarPeriodo(item) {
    const inicio = item.inicio_periodo;
    const fim = item.fim_periodo;

    if (!inicio && !fim) return "Não informado";

    const formatar = (data) => {
      if (!data) return "—";

      const [ano, mes, dia] = data.split("-");
      return `${dia}/${mes}/${ano}`;
    };

    if (inicio && fim) {
      return `${formatar(inicio)} até ${formatar(fim)}`;
    }

    return formatar(inicio || fim);
  }

  function obterSituacao(item) {
    if (item.excluida_em) return "Na lixeira";

    return item.situacao || "Não informado";
  }

  const importacoesFiltradas = importacoes.filter((item) => {
    const fonte = obterFonte(item);

    if (aba === "todas") return !item.excluida_em;
    if (aba === "ibge") return fonte === "IBGE" && !item.excluida_em;
    if (aba === "ssp") return fonte === "SSP-SP" && !item.excluida_em;
    if (aba === "lixeira") return Boolean(item.excluida_em);

    return true;
  });

  async function importarArquivo(arquivo, tipo) {
    if (!arquivo) return;

    if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
      setErro("Selecione um arquivo no formato .xlsx.");
      return;
    }

    if (tipo === "censo" && (!Number.isInteger(Number(anoCenso)) ||
      Number(anoCenso) < 1900 ||
      Number(anoCenso) > 2100)) {
      setErro("Informe um ano válido para o Censo.");
      return;
    }

    try {
      setEnviando(true);
      setErro("");
      setMensagem("");

      const formulario = new FormData();

      formulario.append("arquivo", arquivo);
      formulario.append("tipo", tipo);

      if (tipo === "censo") {
        formulario.append("ano_censo", String(anoCenso));
      }

      const resultado = await requisicao(IMPORTACOES_URL, {
        method: "POST",
        body: formulario,
      });

      setMensagem(
        resultado.message || "Planilha processada com sucesso."
      );

      await carregarImportacoes();
    } catch (error) {
      setErro(error.message);
    } finally {
      setEnviando(false);

      if (arquivoIBGERef.current) {
        arquivoIBGERef.current.value = "";
      }

      if (arquivoSSPRef.current) {
        arquivoSSPRef.current.value = "";
      }
    }
  }

  async function abrirDetalhes(id) {
    try {
      setCarregandoDetalhes(true);
      setErro("");

      const dados = await requisicao(`${IMPORTACOES_URL}/${id}`);

      setDetalhes(dados);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregandoDetalhes(false);
    }
  }

  async function executarAcao(id, acao, confirmacao) {
    if (confirmacao && !window.confirm(confirmacao)) return;

    try {
      setErro("");
      setMensagem("");

      let url = `${IMPORTACOES_URL}/${id}`;
      let method = "POST";

      if (acao === "lixeira") {
        method = "DELETE";
      } else if (acao === "restaurar") {
        url += "/restaurar";
      } else if (acao === "permanente") {
        url += "/permanente";
        method = "DELETE";
      } else {
        url += `/${acao}`;
      }

      const resultado = await requisicao(url, { method });

      setMensagem(resultado.message || "Operação realizada com sucesso.");

      if (detalhes?.importacao?.id_importacao === id) {
        setDetalhes(null);
      }

      await carregarImportacoes();
    } catch (error) {
      setErro(error.message);
    }
  }

  async function baixarArquivo(id, nomeArquivo) {
    try {
      setErro("");

      const resposta = await fetch(`${IMPORTACOES_URL}/${id}/arquivo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.error || "Não foi possível baixar o arquivo.");
      }

      const blob = await resposta.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo || "importacao.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErro(error.message);
    }
  }

  const totalIBGE = importacoes.filter(
    (item) => obterFonte(item) === "IBGE"
  ).length;

  const totalSSP = importacoes.filter(
    (item) => obterFonte(item) === "SSP-SP"
  ).length;

  const totalLixeira = importacoes.filter(
    (item) => Boolean(item.excluida_em)
  ).length;

  return (
    <main className="importacoes-page">
      <header className="importacoes-header">
        <div>
          <span className="importacoes-breadcrumb">
            Administração geral / Importações oficiais
          </span>

          <h1>Importações oficiais</h1>

          <p>
            Gerencie os dados oficiais do IBGE e da Secretaria da
            Segurança Pública de São Paulo.
          </p>
        </div>
      </header>

      {erro && (
        <div className="importacoes-alerta erro">
          {erro}
          <button type="button" onClick={() => setErro("")}>
            ×
          </button>
        </div>
      )}

      {mensagem && (
        <div className="importacoes-alerta sucesso">
          {mensagem}
          <button type="button" onClick={() => setMensagem("")}>
            ×
          </button>
        </div>
      )}

      <section className="importacoes-indicadores">
        <article className="importacao-indicador">
          <span>Total de importações</span>
          <strong>{importacoes.length}</strong>
          <small>Arquivos registrados</small>
        </article>

        <article className="importacao-indicador">
          <span>Dados do IBGE</span>
          <strong>{totalIBGE}</strong>
          <small>Censo demográfico</small>
        </article>

        <article className="importacao-indicador">
          <span>Dados da SSP-SP</span>
          <strong>{totalSSP}</strong>
          <small>Registros criminais</small>
        </article>

        <article className="importacao-indicador">
          <span>Na lixeira</span>
          <strong>{totalLixeira}</strong>
          <small>Importações excluídas</small>
        </article>
      </section>

      <section className="importacoes-fontes">
        <article className="importacao-fonte-card">
          <div className="importacao-fonte-icon ibge">IBGE</div>

          <div className="importacao-fonte-conteudo">
            <h2>Censo Demográfico</h2>

            <p>
              Importe dados populacionais para os municípios e bairros
              do Grande ABC.
            </p>

            <label htmlFor="ano-censo">Ano do Censo</label>

            <input
              id="ano-censo"
              type="number"
              min="1900"
              max="2100"
              value={anoCenso}
              onChange={(event) => setAnoCenso(event.target.value)}
            />

            <input
              ref={arquivoIBGERef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(event) =>
                importarArquivo(event.target.files?.[0], "censo")
              }
            />

            <button
              type="button"
              disabled={enviando}
              onClick={() => arquivoIBGERef.current?.click()}
            >
              {enviando ? "Processando..." : "Importar dados do IBGE"}
            </button>
          </div>
        </article>

        <article className="importacao-fonte-card">
          <div className="importacao-fonte-icon ssp">SSP</div>

          <div className="importacao-fonte-conteudo">
            <h2>Dados criminais SSP-SP</h2>

            <p>
              Importe ocorrências oficiais para alimentar o mapa e os
              indicadores criminais.
            </p>

            <input
              ref={arquivoSSPRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(event) =>
                importarArquivo(event.target.files?.[0], "ssp")
              }
            />

            <button
              type="button"
              disabled={enviando}
              onClick={() => arquivoSSPRef.current?.click()}
            >
              {enviando ? "Processando..." : "Importar dados da SSP-SP"}
            </button>
          </div>
        </article>
      </section>

      <section className="importacoes-historico">
        <div className="importacoes-historico-header">
          <div>
            <h2>Histórico de importações</h2>
            <p>Acompanhe os arquivos enviados e seus resultados.</p>
          </div>

          <button
            type="button"
            onClick={carregarImportacoes}
            disabled={carregando}
          >
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <nav className="importacoes-abas">
          <button
            className={aba === "todas" ? "ativa" : ""}
            onClick={() => setAba("todas")}
          >
            Todas
          </button>

          <button
            className={aba === "ibge" ? "ativa" : ""}
            onClick={() => setAba("ibge")}
          >
            IBGE
          </button>

          <button
            className={aba === "ssp" ? "ativa" : ""}
            onClick={() => setAba("ssp")}
          >
            SSP-SP
          </button>

          <button
            className={aba === "lixeira" ? "ativa" : ""}
            onClick={() => setAba("lixeira")}
          >
            Lixeira
          </button>
        </nav>

        {carregando ? (
          <div className="importacoes-vazio">
            <strong>Carregando importações...</strong>
          </div>
        ) : importacoesFiltradas.length === 0 ? (
          <div className="importacoes-vazio">
            <span>▤</span>
            <strong>Nenhuma importação encontrada</strong>
            <p>
              Quando novos arquivos forem importados, eles aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="importacoes-tabela">
            <table>
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Fonte</th>
                  <th>Enviado em</th>
                  <th>Período</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {importacoesFiltradas.map((item) => {
                  const naLixeira = Boolean(item.excluida_em);

                  return (
                    <tr key={item.id_importacao}>
                      <td>{item.nome_arquivo}</td>

                      <td>{obterFonte(item)}</td>

                      <td>{formatarData(item.enviada_em)}</td>

                      <td>{formatarPeriodo(item)}</td>

                      <td>
                        <span
                          className={`importacao-status ${
                            naLixeira
                              ? "excluida"
                              : String(item.situacao).toLowerCase()
                          }`}
                        >
                          {obterSituacao(item)}
                        </span>
                      </td>

                      <td>
                        <div className="importacao-acoes">
                          <button
                            type="button"
                            onClick={() =>
                              abrirDetalhes(item.id_importacao)
                            }
                          >
                            Detalhes
                          </button>

                          {item.tem_arquivo === 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                baixarArquivo(
                                  item.id_importacao,
                                  item.nome_arquivo
                                )
                              }
                            >
                              Baixar
                            </button>
                          )}

                          {naLixeira ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  executarAcao(
                                    item.id_importacao,
                                    "restaurar",
                                    "Deseja restaurar esta importação?"
                                  )
                                }
                              >
                                Restaurar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  executarAcao(
                                    item.id_importacao,
                                    "permanente",
                                    "Tem certeza? Esta operação excluirá permanentemente os registros desta importação."
                                  )
                                }
                              >
                                Excluir definitivamente
                              </button>
                            </>
                          ) : (
                            <>
                              {item.situacao !== "CONCLUIDA" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    executarAcao(
                                      item.id_importacao,
                                      "confirmar",
                                      "Deseja confirmar esta importação?"
                                    )
                                  }
                                >
                                  Confirmar
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  executarAcao(
                                    item.id_importacao,
                                    "cancelar",
                                    "Deseja cancelar esta importação?"
                                  )
                                }
                              >
                                Cancelar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  executarAcao(
                                    item.id_importacao,
                                    "lixeira",
                                    "Deseja mover esta importação para a lixeira?"
                                  )
                                }
                              >
                                Excluir
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

      {carregandoDetalhes && (
        <div className="importacoes-detalhes">
          Carregando detalhes da importação...
        </div>
      )}

      {detalhes && (
        <section className="importacoes-detalhes">
          <div className="importacoes-historico-header">
            <div>
              <h2>Detalhes da importação</h2>
              <p>{detalhes.importacao?.nome_arquivo}</p>
            </div>

            <button
              type="button"
              onClick={() => setDetalhes(null)}
            >
              Fechar
            </button>
          </div>

          <div className="importacoes-detalhes-resumo">
            <p>
              <strong>Fonte:</strong>{" "}
              {detalhes.importacao?.fonte_nome}
            </p>

            <p>
              <strong>Situação:</strong>{" "}
              {detalhes.importacao?.situacao}
            </p>

            <p>
              <strong>Responsável:</strong>{" "}
              {detalhes.importacao?.responsavel_nome}
            </p>

            <p>
              <strong>Resumo:</strong>{" "}
              {detalhes.importacao?.resumo_resultado || "Não informado"}
            </p>
          </div>

          <h3>Itens processados</h3>

          {detalhes.itens?.length ? (
            <div className="importacoes-tabela">
              <table>
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Aba</th>
                    <th>Município</th>
                    <th>Resultado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>

                <tbody>
                  {detalhes.itens.map((item) => (
                    <tr key={item.id_item_importacao}>
                      <td>{item.numero_linha}</td>
                      <td>{item.nome_aba || "—"}</td>
                      <td>{item.municipio_informado || "—"}</td>
                      <td>{item.resultado}</td>
                      <td>{item.motivo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nenhum item encontrado.</p>
          )}

          {detalhes.acoes?.length > 0 && (
            <>
              <h3>Ações administrativas</h3>

              {detalhes.acoes.map((acao) => (
                <p key={acao.id_acao}>
                  <strong>{acao.tipo}</strong> —{" "}
                  {acao.responsavel_nome} —{" "}
                  {formatarData(acao.realizada_em)}
                  <br />
                  {acao.detalhes}
                </p>
              ))}
            </>
          )}
        </section>
      )}
    </main>
  );
}