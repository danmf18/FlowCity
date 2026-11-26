"use client";

import { useState } from "react";
import "./importacoes-oficiais.css";
export default function ImportacoesOficiaisPage() {
  const [aba, setAba] = useState("todas");

  const [importacoes, setImportacoes] = useState([]);

  const importacoesFiltradas = importacoes.filter((item) => {
    if (aba === "todas") return true;
    if (aba === "ibge") return item.fonte === "IBGE";
    if (aba === "ssp") return item.fonte === "SSP-SP";
    return item.situacao === "Na lixeira";
  });

  return (
    <main className="importacoes-page">
      <header className="importacoes-header">
        <div>
          <span className="importacoes-breadcrumb">
            Administração geral / Importações oficiais
          </span>

          <h1>Importações oficiais</h1>

          <p>
            Gerencie os dados oficiais do IBGE e da Secretaria da Segurança
            Pública de São Paulo.
          </p>
        </div>
      </header>

      <section className="importacoes-indicadores">
        <article className="importacao-indicador">
          <span>Total de importações</span>
          <strong>{importacoes.length}</strong>
          <small>Arquivos registrados</small>
        </article>

        <article className="importacao-indicador">
          <span>Dados do IBGE</span>
          <strong>
            {importacoes.filter((item) => item.fonte === "IBGE").length}
          </strong>
          <small>Censo demográfico</small>
        </article>

        <article className="importacao-indicador">
          <span>Dados da SSP-SP</span>
          <strong>
            {importacoes.filter((item) => item.fonte === "SSP-SP").length}
          </strong>
          <small>Registros criminais</small>
        </article>

        <article className="importacao-indicador">
          <span>Na lixeira</span>
          <strong>
            {importacoes.filter((item) => item.situacao === "Na lixeira").length}
          </strong>
          <small>Importações excluídas</small>
        </article>
      </section>

      <section className="importacoes-fontes">
        <article className="importacao-fonte-card">
          <div className="importacao-fonte-icon ibge">IBGE</div>

          <div className="importacao-fonte-conteudo">
            <h2>Censo Demográfico</h2>
            <p>
              Importe dados populacionais para os municípios e bairros do
              Grande ABC.
            </p>

            <button type="button" disabled>
              Importar dados do IBGE
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

            <button type="button" disabled>
              Importar dados da SSP-SP
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

        {importacoesFiltradas.length === 0 ? (
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
                {importacoesFiltradas.map((item) => (
                  <tr key={item.id}>
                    <td>{item.arquivo}</td>
                    <td>{item.fonte}</td>
                    <td>{item.data}</td>
                    <td>{item.periodo}</td>
                    <td>{item.situacao}</td>
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}