import Link from "next/link";

const indicadores = [
    {
        titulo: "Relatos recebidos",
        valor: "128",
        detalhe: "Total no município",
        icone: "bi-file-earmark-text",
    },
    {
        titulo: "Em análise",
        valor: "34",
        detalhe: "Aguardando avaliação",
        icone: "bi-search",
    },
    {
        titulo: "Concluídos",
        valor: "82",
        detalhe: "Análise finalizada",
        icone: "bi-check-circle",
    },
    {
        titulo: "Boletins oficiais",
        valor: "56",
        detalhe: "Registros disponíveis para consulta",
        icone: "bi-file-earmark-lock",
    },
];

const recentes = [
    { codigo: "ABC-128", categoria: "Furto", data: "07/11/2026", status: "Em análise" },
    { codigo: "ABC-127", categoria: "Vandalismo", data: "06/11/2026", status: "Pendente" },
    { codigo: "ABC-126", categoria: "Roubo", data: "05/11/2026", status: "Concluído" },
];

export default function AdminMunicipioPage() {
    return (
        <div className="municipal-page">
            <div className="municipal-heading">
                <div>
                    <span>PAINEL DO MUNICÍPIO</span>
                    <h1>Visão geral</h1>
                    <p>
                        Acompanhe os indicadores e os relatos da sua
                        área de gestão.
                    </p>
                </div>
                <span className="municipal-location">
                    <i className="bi bi-geo-alt"></i>
                    Município da conta
                </span>
            </div>

            <div className="municipal-stats">
                {indicadores.map((item) => (
                    <div className="municipal-stat" key={item.titulo}>
                        <div>
                            <span>{item.titulo}</span>
                            <h2>{item.valor}</h2>
                            <p>{item.detalhe}</p>
                        </div>
                        <div className="municipal-stat-icon">
                            <i className={`bi ${item.icone}`}></i>
                        </div>
                    </div>
                ))}
            </div>

            <section className="municipal-panel">
                <div className="municipal-panel-heading">
                    <div>
                        <h2>Relatos recentes</h2>
                        <p>Últimos relatos não oficiais recebidos.</p>
                    </div>
                    <Link href="/admin-municipio/relatos">
                        Ver todos <i className="bi bi-arrow-right"></i>
                    </Link>
                </div>

                <div className="table-responsive">
                    <table className="municipal-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Categoria</th>
                                <th>Data</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentes.map((item) => (
                                <tr key={item.codigo}>
                                    <td>{item.codigo}</td>
                                    <td>{item.categoria}</td>
                                    <td>{item.data}</td>
                                    <td>
                                        <span className={`municipal-status ${item.status === "Concluído" ? "is-done" : item.status === "Pendente" ? "is-pending" : "is-review"}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="municipal-notice">
                <i className="bi bi-lock"></i>
                <div>
                    <strong>Boletins de ocorrência oficiais</strong>
                    <p>
                        Os boletins são disponibilizados apenas para consulta.
                        Nenhum administrador poderá editar ou excluir esses
                        registros pelo AlertABC.
                    </p>
                    <Link href="/admin-municipio/boletins">
                        Consultar boletins
                    </Link>
                </div>
            </div>
        </div>
    );
}