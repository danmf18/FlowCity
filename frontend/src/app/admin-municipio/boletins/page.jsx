"use client";

import { useState } from "react";

const boletins = [
    { numero: "2026-000128", categoria: "Furto", data: "07/11/2026", origem: "Registro oficial" },
    { numero: "2026-000117", categoria: "Roubo", data: "05/11/2026", origem: "Registro oficial" },
    { numero: "2026-000103", categoria: "Vandalismo", data: "02/11/2026", origem: "Registro oficial" },
];

export default function BoletinsMunicipioPage() {
    const [busca, setBusca] = useState("");

    const resultado = boletins.filter((item) =>
        `${item.numero} ${item.categoria}`
            .toLowerCase()
            .includes(busca.toLowerCase())
    );

    return (
        <div className="municipal-page">
            <div className="municipal-heading">
                <div>
                    <span>CONSULTA DE DADOS OFICIAIS</span>
                    <h1>Boletins de ocorrência</h1>
                    <p>
                        Consulte os registros oficiais disponíveis para
                        o município.
                    </p>
                </div>
                <span className="municipal-readonly">
                    <i className="bi bi-lock"></i>
                    Somente leitura
                </span>
            </div>

            <div className="municipal-notice">
                <i className="bi bi-shield-lock"></i>
                <div>
                    <strong>Área de consulta protegida</strong>
                    <p>
                        Os boletins são provenientes da tabela de registros
                        oficiais. Seu conteúdo não pode ser alterado pelo
                        administrador municipal ou geral.
                    </p>
                </div>
            </div>

            <section className="municipal-panel">
                <div className="municipal-panel-heading">
                    <div>
                        <h2>Registros oficiais</h2>
                        <p>Lista demonstrativa. A conexão com o banco será feita posteriormente.</p>
                    </div>
                </div>

                <div className="municipal-filters">
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Pesquisar número ou categoria..."
                    />
                </div>

                <div className="table-responsive">
                    <table className="municipal-table">
                        <thead>
                            <tr>
                                <th>Número do BO</th>
                                <th>Categoria</th>
                                <th>Data do registro</th>
                                <th>Origem</th>
                                <th>Acesso</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resultado.length ? resultado.map((item) => (
                                <tr key={item.numero}>
                                    <td>{item.numero}</td>
                                    <td>{item.categoria}</td>
                                    <td>{item.data}</td>
                                    <td>{item.origem}</td>
                                    <td>
                                        <span className="municipal-readonly small">
                                            <i className="bi bi-eye"></i>
                                            Consulta
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5">Nenhum boletim encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}