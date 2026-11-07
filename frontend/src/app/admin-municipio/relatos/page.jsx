"use client";

import { useState } from "react";

const dados = [
    { codigo: "ABC-128", categoria: "Furto", local: "Centro", data: "07/11/2026", status: "Em análise" },
    { codigo: "ABC-127", categoria: "Vandalismo", local: "Jardim América", data: "06/11/2026", status: "Pendente" },
    { codigo: "ABC-126", categoria: "Roubo", local: "Vila Nova", data: "05/11/2026", status: "Concluído" },
    { codigo: "ABC-125", categoria: "Ameaça", local: "Centro", data: "04/11/2026", status: "Em análise" },
];

export default function RelatosMunicipioPage() {
    const [busca, setBusca] = useState("");
    const [filtro, setFiltro] = useState("Todos");

    const filtrados = dados.filter((item) => {
        const correspondeBusca =
            `${item.codigo} ${item.categoria} ${item.local}`
                .toLowerCase()
                .includes(busca.toLowerCase());

        const correspondeStatus =
            filtro === "Todos" || item.status === filtro;

        return correspondeBusca && correspondeStatus;
    });

    return (
        <div className="municipal-page">
            <div className="municipal-heading">
                <div>
                    <span>GESTÃO DE RELATOS</span>
                    <h1>Relatos do município</h1>
                    <p>
                        Consulte e acompanhe os relatos não oficiais
                        enviados pelos cidadãos.
                    </p>
                </div>
            </div>

            <section className="municipal-panel">
                <div className="municipal-panel-heading">
                    <div>
                        <h2>Registros recebidos</h2>
                        <p>Dados demonstrativos para visualização da interface.</p>
                    </div>
                </div>

                <div className="municipal-filters">
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Pesquisar código, categoria ou local..."
                    />

                    <select
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    >
                        <option value="Todos">Todos os status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Em análise">Em análise</option>
                        <option value="Concluído">Concluído</option>
                    </select>
                </div>

                <div className="table-responsive">
                    <table className="municipal-table">
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
                            {filtrados.length ? filtrados.map((item) => (
                                <tr key={item.codigo}>
                                    <td>{item.codigo}</td>
                                    <td>{item.categoria}</td>
                                    <td>{item.local}</td>
                                    <td>{item.data}</td>
                                    <td>
                                        <span className={`municipal-status ${item.status === "Concluído" ? "is-done" : item.status === "Pendente" ? "is-pending" : "is-review"}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5">Nenhum relato encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}