"use client";

import { useState } from "react";

const usuarios = [
    { nome: "Usuário demonstrativo 01", email: "usuario01@email.com", perfil: "Cidadão" },
    { nome: "Usuário demonstrativo 02", email: "usuario02@email.com", perfil: "Cidadão" },
    { nome: "Administrador municipal", email: "admin@email.com", perfil: "Administrador" },
];

export default function UsuariosMunicipioPage() {
    const [busca, setBusca] = useState("");

    const filtrados = usuarios.filter((usuario) =>
        `${usuario.nome} ${usuario.email}`
            .toLowerCase()
            .includes(busca.toLowerCase())
    );

    return (
        <div className="municipal-page">
            <div className="municipal-heading">
                <div>
                    <span>GESTÃO DE ACESSOS</span>
                    <h1>Usuários do município</h1>
                    <p>
                        Consulte as contas vinculadas ao município
                        da sua administração.
                    </p>
                </div>
            </div>

            <section className="municipal-panel">
                <div className="municipal-panel-heading">
                    <div>
                        <h2>Contas cadastradas</h2>
                        <p>Dados demonstrativos para a interface.</p>
                    </div>
                </div>

                <div className="municipal-filters">
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Pesquisar nome ou e-mail..."
                    />
                </div>

                <div className="table-responsive">
                    <table className="municipal-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>E-mail</th>
                                <th>Perfil</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.length ? filtrados.map((usuario) => (
                                <tr key={usuario.email}>
                                    <td>{usuario.nome}</td>
                                    <td>{usuario.email}</td>
                                    <td>{usuario.perfil}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="3">Nenhum usuário encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}