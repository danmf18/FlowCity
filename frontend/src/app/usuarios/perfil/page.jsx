"use client";

import { useEffect, useState } from "react";

export default function PerfilUsuario() {
    const [usuario, setUsuario] = useState({
        nome: "",
        email: "",
    });

    const [mensagem, setMensagem] = useState("");

    useEffect(() => {
        try {
            const dados = localStorage.getItem("usuario");

            if (dados) {
                const usuarioSalvo = JSON.parse(dados);

                setUsuario({
                    nome:
                        usuarioSalvo.nome ||
                        usuarioSalvo.nome_completo ||
                        "",
                    email: usuarioSalvo.email || "",
                });
            }
        } catch (error) {
            console.error("Erro ao carregar usuário:", error);
        }
    }, []);

    function handleSubmit(e) {
        e.preventDefault();

        setMensagem(
            "A atualização permanente do perfil depende da integração com a API."
        );
    }

    return (
        <>
            <div className="user-page-heading">
                <div>
                    <h1>Meu perfil</h1>
                    <p>Consulte as informações da sua conta.</p>
                </div>
            </div>

            {mensagem && (
                <div className="user-alert user-alert-info">
                    {mensagem}
                </div>
            )}

            <section className="user-panel">
                <div className="user-profile-header">
                    <div className="user-profile-avatar">
                        <i className="bi bi-person"></i>
                    </div>

                    <div>
                        <h2>{usuario.nome || "Usuário"}</h2>
                        <p>{usuario.email || "E-mail não informado"}</p>
                    </div>
                </div>

                <div className="user-panel-header">
                    <h3>Dados pessoais</h3>
                </div>

                <form className="user-form" onSubmit={handleSubmit}>
                    <div className="user-form-grid">
                        <div className="user-form-group">
                            <label htmlFor="nome">Nome completo</label>
                            <input
                                id="nome"
                                type="text"
                                value={usuario.nome}
                                onChange={(e) =>
                                    setUsuario({
                                        ...usuario,
                                        nome: e.target.value,
                                    })
                                }
                                required
                            />
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="email">E-mail</label>
                            <input
                                id="email"
                                type="email"
                                value={usuario.email}
                                onChange={(e) =>
                                    setUsuario({
                                        ...usuario,
                                        email: e.target.value,
                                    })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="user-form-actions">
                        <button type="submit" className="user-btn-primary">
                            <i className="bi bi-check-lg"></i>
                            Salvar alterações
                        </button>
                    </div>
                </form>
            </section>

            <section className="user-panel">
                <div className="user-panel-header">
                    <h3>Segurança da conta</h3>
                </div>

                <div className="user-alert user-alert-info">
                    Para alterar sua senha, utilize a funcionalidade de
                    recuperação de senha da plataforma.
                </div>
            </section>
        </>
    );
}