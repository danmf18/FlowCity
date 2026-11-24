"use client";

import { useState } from "react";
import Link from "next/link";
import "./recovery.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export default function EsqueciSenhaPage() {
    const [email, setEmail] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [enviado, setEnviado] = useState(false);

    function enviar(e) {
        e.preventDefault();

        if (!email.trim()) {
            setMensagem("Informe seu endereço de e-mail.");
            return;
        }

        setMensagem(
            "Se esse endereço estiver cadastrado, você receberá as instruções para recuperar sua senha."
        );

        setEnviado(true);
    }

    function voltar() {
        setEmail("");
        setMensagem("");
        setEnviado(false);
    }

    return (
        <main className="recovery-page">
            <section className="recovery-card">

                <div className="recovery-icon">
                    {enviado ? (
                        <i className="bi bi-check-lg"></i>
                    ) : (
                        <i className="bi bi-envelope"></i>
                    )}
                </div>

                {!enviado ? (
                    <>
                        <h1>Esqueceu sua senha?</h1>

                        <p className="recovery-description">
                            Não se preocupe! Informe o e-mail associado
                            à sua conta para iniciar o processo de
                            recuperação de acesso ao AlertABC.
                        </p>

                        <form onSubmit={enviar}>
                            <div className="recovery-field">
                                <label htmlFor="email">
                                    Endereço de e-mail
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    className="recovery-input"
                                    placeholder="seuemail@exemplo.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setMensagem("");
                                    }}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            {mensagem && (
                                <div className="recovery-message recovery-error">
                                    {mensagem}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="recovery-button"
                            >
                                Recuperar senha
                                <i className="bi bi-arrow-right"></i>
                            </button>
                        </form>

                        <div className="recovery-back-container">
                            <Link href="/login" className="recovery-back">
                                <i className="bi bi-arrow-left"></i>
                                Voltar para o login
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        <h1>Solicitação recebida!</h1>

                        <p className="recovery-description">
                            {mensagem}
                        </p>

                        <div className="recovery-email">
                            <i className="bi bi-envelope"></i>
                            <span>{email}</span>
                        </div>

                        <Link
                            href="/login"
                            className="recovery-button"
                        >
                            Voltar para o login
                            <i className="bi bi-arrow-right"></i>
                        </Link>

                        <button
                            type="button"
                            className="recovery-resend"
                            onClick={voltar}
                        >
                            Utilizar outro e-mail
                        </button>
                    </>
                )}

                <div className="recovery-footer">
                    AlertABC — Informação e transparência.
                </div>

            </section>
        </main>
    );
}