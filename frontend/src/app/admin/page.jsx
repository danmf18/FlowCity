const indicadores = [
  {
    titulo: "Total de relatos",
    valor: "1.284",
    descricao: "Relatos registrados",
    icone: "▤",
  },
  {
    titulo: "Usuários cadastrados",
    valor: "856",
    descricao: "Contas registradas",
    icone: "♙",
  },
  {
    titulo: "Em andamento",
    valor: "128",
    descricao: "Relatos em atendimento",
    icone: "◷",
  },
  {
    titulo: "Resolvidos",
    valor: "942",
    descricao: "Ocorrências concluídas",
    icone: "✓",
  },
];

const atividades = [
  {
    titulo: "Buraco em via pública",
    categoria: "Infraestrutura",
    local: "Centro",
    status: "Pendente",
  },
  {
    titulo: "Iluminação defeituosa",
    categoria: "Iluminação",
    local: "Jardim América",
    status: "Em andamento",
  },
  {
    titulo: "Descarte irregular de lixo",
    categoria: "Limpeza urbana",
    local: "Vila Nova",
    status: "Resolvido",
  },
  {
    titulo: "Vazamento de água",
    categoria: "Saneamento",
    local: "Centro",
    status: "Pendente",
  },
];

export default function AdminDashboard() {
  return (
    <div className="admin-content">
      <header className="admin-header">
        <div>
          <span className="admin-eyebrow">ADMINISTRAÇÃO</span>
          <h1>Visão geral</h1>
          <p>Acompanhe os dados e as atividades do AlertAbc.</p>
        </div>

        <div className="admin-header-right">
          <span className="admin-date">Painel administrativo geral</span>
        </div>
      </header>

      <section className="admin-welcome">
        <div>
          <span>PAINEL DE CONTROLE</span>
          <h2>Bem-vindo ao AlertAbc</h2>
          <p>
            Gerencie os relatos, acompanhe os usuários e visualize os
            indicadores da plataforma em um só lugar.
          </p>
        </div>

        <div className="welcome-decoration">F</div>
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Indicadores gerais</h2>
            <p>Resumo das atividades da plataforma.</p>
          </div>

          <span className="demo-label">Dados demonstrativos</span>
        </div>

        <div className="admin-stats-grid">
          {indicadores.map((item) => (
            <article className="admin-stat-card" key={item.titulo}>
              <div className="stat-card-top">
                <span>{item.titulo}</span>
                <div className="stat-icon">{item.icone}</div>
              </div>

              <strong className="stat-value">{item.valor}</strong>

              <span className="stat-description">{item.descricao}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel">
          <div className="section-heading">
            <div>
              <h2>Distribuição de relatos</h2>
              <p>Exemplo de distribuição por situação.</p>
            </div>
          </div>

          <div className="chart-placeholder">
            <div className="chart-column">
              <div className="chart-bar bar-blue" style={{ height: "75%" }} />
              <span>Pendentes</span>
              <strong>214</strong>
            </div>

            <div className="chart-column">
              <div className="chart-bar bar-orange" style={{ height: "48%" }} />
              <span>Em andamento</span>
              <strong>128</strong>
            </div>

            <div className="chart-column">
              <div className="chart-bar bar-green" style={{ height: "92%" }} />
              <span>Resolvidos</span>
              <strong>942</strong>
            </div>
          </div>
        </article>

        <article className="admin-panel admin-summary">
          <div className="section-heading">
            <div>
              <h2>Resumo do sistema</h2>
              <p>Indicadores de demonstração.</p>
            </div>
          </div>

          <div className="summary-item">
            <span>Relatos pendentes</span>
            <strong>214</strong>
          </div>

          <div className="summary-item">
            <span>Relatos em andamento</span>
            <strong>128</strong>
          </div>

          <div className="summary-item">
            <span>Relatos resolvidos</span>
            <strong>942</strong>
          </div>

          <div className="summary-item">
            <span>Total de usuários</span>
            <strong>856</strong>
          </div>
        </article>
      </section>

      <section className="admin-panel admin-recent">
        <div className="section-heading">
          <div>
            <h2>Relatos recentes</h2>
            <p>Exemplos de registros da plataforma.</p>
          </div>

          <a href="/admin/relatos" className="admin-text-link">
            Ver todos
          </a>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Relato</th>
                <th>Categoria</th>
                <th>Localização</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {atividades.map((atividade, index) => (
                <tr key={index}>
                  <td>{atividade.titulo}</td>
                  <td>{atividade.categoria}</td>
                  <td>{atividade.local}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        atividade.status === "Resolvido"
                          ? "status-resolved"
                          : atividade.status === "Em andamento"
                            ? "status-progress"
                            : "status-pending"
                      }`}
                    >
                      {atividade.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="admin-footer">
        AlertAbc — Painel administrativo geral
      </footer>
    </div>
  );
}
