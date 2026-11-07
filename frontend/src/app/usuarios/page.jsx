import Link from "next/link";

const estatisticas = [
    {
        titulo: "Relatos enviados",
        valor: "08",
        descricao: "Total de relatos registrados",
        icone: "bi-file-earmark-text",
    },
    {
        titulo: "Em análise",
        valor: "03",
        descricao: "Aguardando avaliação",
        icone: "bi-search",
    },
    {
        titulo: "Concluídos",
        valor: "05",
        descricao: "Análise finalizada",
        icone: "bi-check-circle",
    },
];

const relatosRecentes = [
    {
        codigo: "#ABC-008",
        categoria: "Furto",
        local: "Centro",
        data: "05/11/2026",
        status: "Em análise",
        classe: "status-analise",
    },
    {
        codigo: "#ABC-007",
        categoria: "Vandalismo",
        local: "Jardim América",
        data: "03/11/2026",
        status: "Pendente",
        classe: "status-pendente",
    },
    {
        codigo: "#ABC-006",
        categoria: "Roubo",
        local: "Vila Nova",
        data: "01/11/2026",
        status: "Concluído",
        classe: "status-concluido",
    },
];

export default function UsuariosPage() {
    return (
        <div className="user-page">
            <div className="user-page-heading">
                <div>
                    <span>PAINEL DO CIDADÃO</span>
                    <h1>Visão geral</h1>
                    <p>
                        Acompanhe os relatos de possíveis ocorrências
                        registrados por você.
                    </p>
                </div>

                <Link
                    href="/usuarios/novo-relato"
                    className="user-btn-primary"
                >
                    <i className="bi bi-plus-lg"></i>
                    Novo relato
                </Link>
            </div>

            <div className="user-stats-grid">
                {estatisticas.map((item) => (
                    <div className="user-stat-card" key={item.titulo}>
                        <div>
                            <span>{item.titulo}</span>
                            <h2>{item.valor}</h2>
                            <p>{item.descricao}</p>
                        </div>

                        <div className="user-stat-icon">
                            <i className={`bi ${item.icone}`}></i>
                        </div>
                    </div>
                ))}
            </div>

            <section className="user-panel">
                <div className="user-panel-header">
                    <div>
                        <h2>Relatos recentes</h2>
                        <p>
                            Acompanhe as atualizações dos seus últimos
                            registros.
                        </p>
                    </div>

                    <Link href="/usuarios/relatos">
                        Ver todos
                        <i className="bi bi-arrow-right"></i>
                    </Link>
                </div>

                <div className="table-responsive">
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Categoria</th>
                                <th>Localidade</th>
                                <th>Data</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {relatosRecentes.map((relato) => (
                                <tr key={relato.codigo}>
                                    <td>{relato.codigo}</td>
                                    <td>{relato.categoria}</td>
                                    <td>{relato.local}</td>
                                    <td>{relato.data}</td>
                                    <td>
                                        <span
                                            className={`user-status ${relato.classe}`}
                                        >
                                            {relato.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="user-alert">
                <i className="bi bi-info-circle"></i>
                <div>
                    <strong>Sobre os relatos do AlertABC</strong>
                    <p>
                        Os registros são informações enviadas por usuários
                        e não representam crimes confirmados nem substituem
                        boletins de ocorrência ou canais oficiais.
                    </p>
                </div>
            </div>
        </div>
    );
}