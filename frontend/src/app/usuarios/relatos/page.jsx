"use client";

import { useState } from "react";
import Link from "next/link";

const relatosIniciais = [
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
    {
        codigo: "#ABC-005",
        categoria: "Ameaça",
        local: "Centro",
        data: "28/10/2026",
        status: "Em análise",
        classe: "status-analise",
    },
];

export default function MeusRelatosPage() {
    const [filtro, setFiltro] = useState("Todos");

    const relatosFiltrados =
        filtro === "Todos"
            ? relatosIniciais
            : relatosIniciais.filter(
                  (relato) => relato.status === filtro
              );

    return (
        <div className="user-page">
            <div className="user-page-heading">
                <div>
                    <span>ACOMPANHAMENTO</span>
                    <h1>Meus relatos</h1>
                    <p>
                        Consulte os relatos de possíveis ocorrências
                        que você registrou na plataforma.
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

            <section className="user-panel">
                <div className="user-panel-header">
                    <div>
                        <h2>Histórico de relatos</h2>
                        <p>
                            Consulte a situação dos seus registros.
                        </p>
                    </div>

                    <select
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        className="user-filter"
                        aria-label="Filtrar relatos por status"
                    >
                        <option value="Todos">Todos os status</option>
                        <option value="Pendente">Pendentes</option>
                        <option value="Em análise">Em análise</option>
                        <option value="Concluído">Concluídos</option>
                    </select>
                </div>

                <div className="table-responsive">
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Categoria</th>
                                <th>Localidade</th>
                                <th>Data do envio</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {relatosFiltrados.length > 0 ? (
                                relatosFiltrados.map((relato) => (
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
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5">
                                        Nenhum relato encontrado para
                                        esse filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="user-alert">
                <i className="bi bi-shield-check"></i>
                <div>
                    <strong>Transparência e responsabilidade</strong>
                    <p>
                        O status indica a situação do registro dentro
                        da plataforma. Ele não representa uma conclusão
                        sobre a ocorrência relatada.
                    </p>
                </div>
            </div>
        </div>
    );
}