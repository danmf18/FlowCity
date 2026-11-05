
"use client";

import { useState } from "react";
import "./recovery.css";

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
            "Solicitação realizada com sucesso! Se esse e-mail estiver cadastrado, você receberá as instruções para recuperar sua senha."
        );

        setEnviado(true);
    }

    function voltar() {
        setEmail("");
        setMensagem("");
        setEnviado(false);
    }

    return (
        <main className="recovery-page container-fluid d-flex align-items-center justify-content-center py-5">

            <section className="recovery-card card border-0 shadow-sm p-4 p-md-5">

                <div className="recovery-icon mx-auto mb-4 d-flex align-items-center justify-content-center">
                    {enviado ? (
                        <i className="bi bi-check-lg"></i>
                    ) : (
                        <i className="bi bi-envelope"></i>
                    )}
                </div>

                {!enviado ? (
                    <>
                        <h1 className="text-center fw-bold mb-3">
                            Esqueceu sua senha?
                        </h1>

                        <p className="recovery-description text-center mb-4">
                            Não se preocupe! Informe o e-mail associado
                            à sua conta para iniciar o processo de
                            recuperação de acesso ao AlertABC.
                        </p>

                        <form onSubmit={enviar}>

                            <div className="mb-3">
                                <label
                                    htmlFor="email"
                                    className="form-label fw-semibold"
                                >
                                    Endereço de e-mail
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    className="form-control recovery-input"
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
                                <div className="alert alert-danger py-2">
                                    {mensagem}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn recovery-button w-100"
                            >
                                Recuperar senha
                            </button>

                        </form>

                        <div className="text-center mt-4">
                            <a href="/login" className="recovery-back">
                                ← Voltar para o login
                            </a>
                        </div>
                    </>
                ) : (
                    <>
                        <h1 className="text-center fw-bold mb-3">
                            Solicitação recebida!
                        </h1>

                        <p className="recovery-description text-center mb-4">
                            {mensagem}
                        </p>

                        <div className="recovery-email mb-4 text-center">
                            {email}
                        </div>

                        <a
                            href="/login"
                            className="btn recovery-button w-100"
                        >
                            Voltar para o login
                        </a>

                        <button
                            type="button"
                            className="btn recovery-resend w-100 mt-3"
                            onClick={voltar}
                        >
                            Utilizar outro e-mail
                        </button>
                    </>
                )}

                <div className="recovery-footer text-center mt-4 pt-3">
                    AlertABC — Informação e transparência.
                </div>

            </section>

        </main>
    );
}