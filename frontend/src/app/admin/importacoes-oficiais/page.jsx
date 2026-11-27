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
          dados.error ||
            dados.message ||
            "Erro ao realizar operação."
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

  function normalizarNomeArquivo(nome) {
    return String(nome || "")
      .trim()
      .toLowerCase();
  }

  const contagemArquivosAtivos = importacoes.reduce(
    (acumulador, item) => {
      if (item.excluida_em) {
        return acumulador;
      }

      const chave = normalizarNomeArquivo(item.nome_arquivo);

      if (!chave) {
        return acumulador;
      }

      acumulador[chave] = (acumulador[chave] || 0) + 1;
      return acumulador;
    },
    {}
  );

  function obterOcorrenciasArquivo(item) {
    if (!item || item.excluida_em) {
      return 0;
    }

    const chave = normalizarNomeArquivo(item.nome_arquivo);
    return contagemArquivosAtivos[chave] || 0;
  }

  function ehArquivoDuplicado(item) {
    return obterOcorrenciasArquivo(item) > 1;
  }

  function formatarData(data) {
    if (!data) return "—";

    const dataConvertida = new Date(data);

    if (Number.isNaN(dataConvertida.getTime())) {
      return "—";
    }

    return dataConvertida.toLocaleString("pt-BR");
  }

  function formatarPeriodo(item) {
    const inicio = item.inicio_periodo;
    const fim = item.fim_periodo;

    if (!inicio && !fim) {
      return "Não informado";
    }

    const formatar = (data) => {
      if (!data) return "—";

      const valor = String(data).slice(0, 10);
      const partes = valor.split("-");

      if (partes.length !== 3) return valor;

      const [ano, mes, dia] = partes;

      return `${dia}/${mes}/${ano}`;
    };

    if (inicio && fim) {
      return `${formatar(inicio)} até ${formatar(fim)}`;
    }

    return formatar(inicio || fim);
  }

  function obterSituacao(item) {
    if (item.excluida_em) {
      return "Na lixeira";
    }

    return item.situacao || "Não informado";
  }

  function obterClasseSituacao(item) {
    if (item.excluida_em) {
      return "excluida";
    }

    return String(item.situacao || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
  }

  const importacoesFiltradas = importacoes.filter((item) => {
    const fonte = obterFonte(item);

    if (aba === "todas") {
      return !item.excluida_em;
    }

    if (aba === "ibge") {
      return fonte === "IBGE" && !item.excluida_em;
    }

    if (aba === "ssp") {
      return fonte === "SSP-SP" && !item.excluida_em;
    }

    if (aba === "duplicados") {
      return ehArquivoDuplicado(item);
    }

    if (aba === "lixeira") {
      return Boolean(item.excluida_em);
    }

    return true;
  });

  async function importarArquivo(arquivo, tipo) {
    if (!arquivo) return;

    if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
      setErro("Selecione um arquivo no formato .xlsx.");
      return;
    }

    if (
      tipo === "censo" &&
      (!Number.isInteger(Number(anoCenso)) ||
        Number(anoCenso) < 1900 ||
        Number(anoCenso) > 2100)
    ) {
      setErro("Informe um ano válido para o Censo.");
      return;
    }

    const chaveArquivo = normalizarNomeArquivo(arquivo.name);
    const arquivoJaImportado = Boolean(
      contagemArquivosAtivos[chaveArquivo]
    );

    if (
      arquivoJaImportado &&
      !window.confirm(
        `Já existe uma importação ativa com o arquivo "${arquivo.name}". Deseja importar mesmo assim?`
      )
    ) {
      if (arquivoIBGERef.current) {
        arquivoIBGERef.current.value = "";
      }

      if (arquivoSSPRef.current) {
        arquivoSSPRef.current.value = "";
      }

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
        resultado.message ||
          "Planilha processada com sucesso."
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
      setDetalhes(null);

      const dados = await requisicao(
        `${IMPORTACOES_URL}/${id}`
      );

      setDetalhes(dados);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregandoDetalhes(false);
    }
  }

  async function executarAcao(id, acao, confirmacao) {
    if (confirmacao && !window.confirm(confirmacao)) {
      return;
    }

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

      setMensagem(
        resultado.message ||
          "Operação realizada com sucesso."
      );

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

      const resposta = await fetch(
        `${IMPORTACOES_URL}/${id}/arquivo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));

        throw new Error(
          dados.error ||
            "Não foi possível baixar o arquivo."
        );
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

  const totalDuplicados = importacoes.filter((item) =>
    ehArquivoDuplicado(item)
  ).length;

  const totalLixeira = importacoes.filter(
    (item) => Boolean(item.excluida_em)
  ).length;

  const totalAtivas = importacoes.filter(
    (item) => !item.excluida_em
  ).length;

  // Os indicadores de processamento vêm do backend.
  const resumo = detalhes?.resumoItens || {};
  const ocorrenciasDetalhe = obterOcorrenciasArquivo(
    detalhes?.importacao
  );

  function formatarNumero(valor) {
    return Number(valor || 0).toLocaleString("pt-BR");
  }

  return (
    <main className="importacoes-page">
      {/* CABEÇALHO */}

      <header className="importacoes-header">
        <div>
          <span className="importacoes-breadcrumb">
            Administração geral / Importações oficiais
          </span>

          <h1>Importações oficiais</h1>

          <p>
            Gerencie os dados oficiais do IBGE e da
            Secretaria da Segurança Pública de São Paulo.
          </p>
        </div>
      </header>

      {/* MENSAGENS */}

      {erro && (
        <div className="importacoes-alerta erro">
          <span>{erro}</span>

          <button
            type="button"
            onClick={() => setErro("")}
            aria-label="Fechar mensagem"
          >
            ×
          </button>
        </div>
      )}

      {mensagem && (
        <div className="importacoes-alerta sucesso">
          <span>{mensagem}</span>

          <button
            type="button"
            onClick={() => setMensagem("")}
            aria-label="Fechar mensagem"
          >
            ×
          </button>
        </div>
      )}

      {/* INDICADORES GERAIS */}

      <section className="importacoes-indicadores">
        <article className="importacao-indicador">
          <span>Total de importações</span>
          <strong>{formatarNumero(importacoes.length)}</strong>
          <small>Arquivos registrados</small>
        </article>

        <article className="importacao-indicador">
          <span>Dados do IBGE</span>
          <strong>{formatarNumero(totalIBGE)}</strong>
          <small>Importações do Censo</small>
        </article>

        <article className="importacao-indicador">
          <span>Dados da SSP-SP</span>
          <strong>{formatarNumero(totalSSP)}</strong>
          <small>Importações de ocorrências</small>
        </article>

        <article className="importacao-indicador">
          <span>Arquivos duplicados</span>
          <strong>{formatarNumero(totalDuplicados)}</strong>
          <small>Importações com mesmo nome</small>
        </article>

        <article className="importacao-indicador">
          <span>Na lixeira</span>
          <strong>{formatarNumero(totalLixeira)}</strong>
          <small>Importações excluídas</small>
        </article>
      </section>

      {/* FONTES DE DADOS */}

      <section className="importacoes-fontes">
        <article className="importacao-fonte-card">
          <div className="importacao-fonte-icon ibge">
            IBGE
          </div>

          <div className="importacao-fonte-conteudo">
            <h2>Censo Demográfico</h2>

            <p>
              Importe dados populacionais para os
              municípios e bairros do Grande ABC.
            </p>

            <label htmlFor="ano-censo">
              Ano do Censo
            </label>

            <input
              id="ano-censo"
              type="number"
              min="1900"
              max="2100"
              value={anoCenso}
              onChange={(event) =>
                setAnoCenso(event.target.value)
              }
            />

            <input
              ref={arquivoIBGERef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(event) =>
                importarArquivo(
                  event.target.files?.[0],
                  "censo"
                )
              }
            />

            <button
              type="button"
              disabled={enviando}
              onClick={() =>
                arquivoIBGERef.current?.click()
              }
            >
              {enviando
                ? "Processando..."
                : "Importar dados do IBGE"}
            </button>
          </div>
        </article>

        <article className="importacao-fonte-card">
          <div className="importacao-fonte-icon ssp">
            SSP
          </div>

          <div className="importacao-fonte-conteudo">
            <h2>Dados criminais SSP-SP</h2>

            <p>
              Importe ocorrências oficiais para alimentar
              o mapa e os indicadores criminais.
            </p>

            <input
              ref={arquivoSSPRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(event) =>
                importarArquivo(
                  event.target.files?.[0],
                  "ssp"
                )
              }
            />

            <button
              type="button"
              disabled={enviando}
              onClick={() =>
                arquivoSSPRef.current?.click()
              }
            >
              {enviando
                ? "Processando..."
                : "Importar dados da SSP-SP"}
            </button>
          </div>
        </article>
      </section>

      {/* HISTÓRICO */}

      <section className="importacoes-historico">
        <div className="importacoes-historico-header">
          <div>
            <h2>Histórico de importações</h2>

            <p>
              Acompanhe os arquivos enviados e seus
              resultados.
            </p>
          </div>

          <button
            type="button"
            onClick={carregarImportacoes}
            disabled={carregando}
          >
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {/* ABAS */}

        <nav className="importacoes-abas">
          <button
            type="button"
            className={aba === "todas" ? "ativa" : ""}
            onClick={() => setAba("todas")}
          >
            Todas ({totalAtivas})
          </button>

          <button
            type="button"
            className={aba === "ibge" ? "ativa" : ""}
            onClick={() => setAba("ibge")}
          >
            IBGE
          </button>

          <button
            type="button"
            className={aba === "ssp" ? "ativa" : ""}
            onClick={() => setAba("ssp")}
          >
            SSP-SP
          </button>

          <button
            type="button"
            className={aba === "duplicados" ? "ativa" : ""}
            onClick={() => setAba("duplicados")}
          >
            Duplicados ({totalDuplicados})
          </button>

          <button
            type="button"
            className={aba === "lixeira" ? "ativa" : ""}
            onClick={() => setAba("lixeira")}
          >
            Lixeira ({totalLixeira})
          </button>
        </nav>

        {/* CARREGAMENTO E TABELA */}

        {carregando ? (
          <div className="importacoes-vazio">
            <strong>Carregando importações...</strong>
          </div>
        ) : importacoesFiltradas.length === 0 ? (
          <div className="importacoes-vazio">
            <span>▤</span>

            <strong>
              Nenhuma importação encontrada
            </strong>

            <p>
              Quando novos arquivos forem importados,
              eles aparecerão aqui.
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
                  <th>Duplicado</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {importacoesFiltradas.map((item) => {
                  const naLixeira = Boolean(item.excluida_em);
                  const ocorrencias = obterOcorrenciasArquivo(item);
                  const duplicado = ocorrencias > 1;

                  return (
                    <tr key={item.id_importacao}>
                      <td>{item.nome_arquivo}</td>

                      <td>{obterFonte(item)}</td>

                      <td>
                        {formatarData(item.enviada_em)}
                      </td>

                      <td>{formatarPeriodo(item)}</td>

                      <td>
                        {naLixeira
                          ? "—"
                          : duplicado
                            ? `Sim (${ocorrencias}x)`
                            : "Não"}
                      </td>

                      <td>
                        <span
                          className={`importacao-status ${obterClasseSituacao(
                            item
                          )}`}
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

                          {Boolean(Number(item.tem_arquivo)) && (
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

      {/* CARREGAMENTO DOS DETALHES */}

      {carregandoDetalhes && (
        <section className="importacoes-detalhes">
          <strong>
            Carregando detalhes da importação...
          </strong>
        </section>
      )}

      {/* DETALHES DA IMPORTAÇÃO */}

      {detalhes && (
        <section className="importacoes-detalhes">
          <div className="importacoes-historico-header">
            <div>
              <h2>Detalhes da importação</h2>

              <p>
                {detalhes.importacao?.nome_arquivo}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDetalhes(null)}
            >
              Fechar
            </button>
          </div>

          {/* INFORMAÇÕES GERAIS */}

          <div className="importacoes-detalhes-resumo">
            <p>
              <strong>Fonte:</strong>{" "}
              {detalhes.importacao?.fonte_nome || "Não informada"}
            </p>

            <p>
              <strong>Situação:</strong>{" "}
              {detalhes.importacao?.situacao || "Não informada"}
            </p>

            <p>
              <strong>Responsável:</strong>{" "}
              {detalhes.importacao?.responsavel_nome || "Não informado"}
            </p>

            <p>
              <strong>Arquivo:</strong>{" "}
              {detalhes.importacao?.nome_arquivo || "Não informado"}
            </p>

            <p>
              <strong>Arquivo duplicado:</strong>{" "}
              {detalhes.importacao?.excluida_em
                ? "Na lixeira"
                : ocorrenciasDetalhe > 1
                  ? `Sim (${ocorrenciasDetalhe} importações ativas com este nome)`
                  : "Não"}
            </p>

            <p>
              <strong>Período dos dados:</strong>{" "}
              {formatarPeriodo(detalhes.importacao || {})}
            </p>

            <p>
              <strong>Data da importação:</strong>{" "}
              {formatarData(detalhes.importacao?.enviada_em)}
            </p>

            <p>
              <strong>Início do processamento:</strong>{" "}
              {formatarData(detalhes.importacao?.iniciada_em)}
            </p>

            <p>
              <strong>Conclusão:</strong>{" "}
              {formatarData(detalhes.importacao?.concluida_em)}
            </p>

            <p>
              <strong>Resumo:</strong>{" "}
              {detalhes.importacao?.resumo_resultado || "Não informado"}
            </p>

            <p>
              <strong>Ações administrativas:</strong>{" "}
              {detalhes.acoes?.length || 0}
            </p>
          </div>

          {/* INDICADORES VINDOS DO BACKEND */}

          <h3>Resumo do processamento</h3>

          <div className="importacoes-resumo-metricas">
            <article className="importacoes-resumo-metrica">
              <span>Itens processados</span>
              <strong>
                {formatarNumero(resumo.total_processados)}
              </strong>
            </article>

            <article className="importacoes-resumo-metrica importados">
              <span>Importados</span>
              <strong>
                {formatarNumero(resumo.importados)}
              </strong>
            </article>

            <article className="importacoes-resumo-metrica ignorados">
              <span>Ignorados</span>
              <strong>
                {formatarNumero(resumo.ignorados)}
              </strong>
            </article>

            <article className="importacoes-resumo-metrica erros">
              <span>Com erro</span>
              <strong>
                {formatarNumero(resumo.erros)}
              </strong>
            </article>

            <article className="importacoes-resumo-metrica">
              <span>Outros resultados</span>
              <strong>
                {formatarNumero(resumo.outros)}
              </strong>
            </article>
          </div>

          {/* ITENS PROCESSADOS */}

          <h3>Itens processados</h3>

          {detalhes.itens?.length > 0 ? (
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

          <p className="importacoes-itens-observacao">
            A tabela apresenta os 50 itens mais recentes.
            Os indicadores acima consideram todos os itens registrados
            para esta importação.
          </p>

          {/* AMOSTRA DO CENSO */}

          {detalhes.amostraCenso?.length > 0 && (
            <>
              <h3>Amostra dos dados do Censo</h3>

              <div className="importacoes-tabela">
                <table>
                  <thead>
                    <tr>
                      <th>Ano</th>
                      <th>Nível territorial</th>
                      <th>Código IBGE</th>
                      <th>Município</th>
                      <th>Bairro</th>
                      <th>População</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalhes.amostraCenso.map((item) => (
                      <tr key={item.id_censo}>
                        <td>{item.ano_censo}</td>
                        <td>{item.nivel_territorial}</td>
                        <td>{item.cod_ibge}</td>
                        <td>{item.nome_municipio}</td>
                        <td>{item.bairro || "—"}</td>
                        <td>
                          {formatarNumero(item.populacao)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* AÇÕES ADMINISTRATIVAS */}

          {detalhes.acoes?.length > 0 && (
            <>
              <h3>Histórico de ações administrativas</h3>

              <div className="importacoes-acoes-historico">
                {detalhes.acoes.map((acao) => (
                  <article
                    className="importacoes-acao-historico"
                    key={acao.id_acao}
                  >
                    <strong>{acao.tipo}</strong>

                    <p>
                      Responsável:{" "}
                      {acao.responsavel_nome || "Não informado"}
                    </p>

                    <p>
                      Data: {formatarData(acao.realizada_em)}
                    </p>

                    {acao.detalhes && (
                      <p>{acao.detalhes}</p>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}