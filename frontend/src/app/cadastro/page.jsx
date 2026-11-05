
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import "@/app/cadastro/cadastro.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export default function Cadastro() {
    const router = useRouter();

    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");

    const [mensagem, setMensagem] = useState("");
    const [tipoMensagem, setTipoMensagem] = useState("");
    const [carregando, setCarregando] = useState(false);

    async function handleCadastro(e) {
        e.preventDefault();

        setMensagem("");
        setTipoMensagem("");

        // Validar campos
        if (!nome.trim() || !email.trim() || !senha || !confirmarSenha) {
            setMensagem("Preencha todos os campos.");
            setTipoMensagem("erro");
            return;
        }

        // Validar nome
        if (nome.trim().length < 3) {
            setMensagem("Informe seu nome completo.");
            setTipoMensagem("erro");
            return;
        }

        // Validar formato do e-mail
        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formatoEmail.test(email.trim())) {
            setMensagem("Informe um e-mail válido.");
            setTipoMensagem("erro");
            return;
        }

        // Validar senha
        if (senha.length < 8) {
            setMensagem("A senha deve ter pelo menos 8 caracteres.");
            setTipoMensagem("erro");
            return;
        }

        // Confirmar senha
        if (senha !== confirmarSenha) {
            setMensagem("As senhas não coincidem.");
            setTipoMensagem("erro");
            return;
        }

        try {
            setCarregando(true);

            const API_URL = process.env.NEXT_PUBLIC_API_URL;

            if (!API_URL) {
                throw new Error("URL da API não configurada.");
            }

            const url = `${API_URL.replace(/\/$/, "")}/auth/registrar`;

            console.log("Enviando cadastro para:", url);

            const resposta = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nome: nome.trim(),
                    email: email.trim().toLowerCase(),
                    senha,
                    confirmarSenha
                })
            });

            // Verificar o tipo de resposta
            const tipoConteudo = resposta.headers.get("content-type") || "";

            if (!tipoConteudo.includes("application/json")) {
                const texto = await resposta.text();

                console.error("Resposta não JSON recebida:", {
                    status: resposta.status,
                    url: resposta.url,
                    resposta: texto
                });

                throw new Error(
                    `A API retornou uma resposta inesperada (HTTP ${resposta.status}).`
                );
            }

            const dados = await resposta.json();

            // Verificar resposta da API
            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem || "Não foi possível realizar o cadastro."
                );
            }

            // Cadastro realizado
            setMensagem(
                "Conta criada com sucesso! Redirecionando para o login..."
            );
            setTipoMensagem("sucesso");

            setNome("");
            setEmail("");
            setSenha("");
            setConfirmarSenha("");

            setTimeout(() => {
                router.push("/login");
            }, 1800);

        } catch (erro) {
            console.error("Erro ao realizar cadastro:", erro);

            setMensagem(
                erro.message || "Erro ao conectar com o servidor."
            );

            setTipoMensagem("erro");

        } finally {
            setCarregando(false);
        }
    }

    return (
        <section className="page-login">

            <div className="lado-esquerdo">

                <div className="img-lado-esquerdo">
                    <img
                        className="img-logo"
                        src="/imagens/logo.png"
                        alt="Logo AlertABC"
                    />
                </div>

                <div className="text-lado-esquerdo">
                    <h1>
                        Faça parte de uma{" "}
                        <span className="quebra-linha">
                            comunidade mais segura.
                        </span>
                    </h1>

                    <p>
                        Registre e acompanhe relatos de ocorrências
                        <span className="quebra-linha">
                            por região, contribuindo para uma cidade
                        </span>
                        <span> mais informada e segura.</span>
                    </p>
                </div>

                <div className="icon-lado-esquerdo">

                    <div className="icon">
                        <i className="bi bi-geo-alt"></i>
                        <h3>Mapa interativo</h3>
                        <p>
                            Visualize relatos por
                            <span className="quebra-linha">
                                localização.
                            </span>
                        </p>
                    </div>

                    <div className="icon">
                        <i className="bi bi-file-earmark-plus"></i>
                        <h3>Registre relatos</h3>
                        <p>
                            Compartilhe informações
                            <span className="quebra-linha">
                                com a comunidade.
                            </span>
                        </p>
                    </div>

                    <div className="icon">
                        <i className="bi bi-shield-check"></i>
                        <h3>Mais segurança</h3>
                        <p>
                            Contribua para uma cidade
                            <span className="quebra-linha">
                                mais informada.
                            </span>
                        </p>
                    </div>

                </div>
            </div>

            <div className="lado-direito">

                <div className="container-info-lado-direito">

                    <div className="text-lado-direito">
                        <h2>Crie sua conta</h2>

                        <p>
                            Preencha os dados abaixo para começar
                            <span className="quebra-linha">
                                a usar a AlertABC.
                            </span>
                        </p>
                    </div>

                    <div className="forms-login">

                        <form onSubmit={handleCadastro}>

                            <div className="inputs">
                                <p>Nome completo</p>

                                <input
                                    className="input-person"
                                    type="text"
                                    placeholder="Digite seu nome completo"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    autoComplete="name"
                                    disabled={carregando}
                                />
                            </div>

                            <div className="inputs">
                                <p>E-mail</p>

                                <input
                                    className="input-person"
                                    type="email"
                                    placeholder="Digite seu e-mail"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    disabled={carregando}
                                />
                            </div>

                            <div className="inputs">
                                <p>Senha</p>

                                <input
                                    className="input-person"
                                    type="password"
                                    placeholder="Digite sua senha"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    autoComplete="new-password"
                                    disabled={carregando}
                                />
                            </div>

                            <div className="inputs">
                                <p>Confirmar senha</p>

                                <input
                                    className="input-person"
                                    type="password"
                                    placeholder="Confirme sua senha"
                                    value={confirmarSenha}
                                    onChange={(e) =>
                                        setConfirmarSenha(e.target.value)
                                    }
                                    autoComplete="new-password"
                                    disabled={carregando}
                                />
                            </div>

                            {mensagem && (
                                <div
                                    className={`mensagem-cadastro ${tipoMensagem}`}
                                    role="alert"
                                >
                                    <i
                                        className={
                                            tipoMensagem === "sucesso"
                                                ? "bi bi-check-circle"
                                                : "bi bi-exclamation-circle"
                                        }
                                    ></i>

                                    {mensagem}
                                </div>
                            )}

                            <div className="botao-acao-container">

                                <div className="botao-acao">
                                    <button
                                        type="submit"
                                        disabled={carregando}
                                    >
                                        {carregando
                                            ? "Criando conta..."
                                            : "Criar uma conta"
                                        }

                                        {!carregando && (
                                            <i className="bi bi-arrow-right"></i>
                                        )}
                                    </button>
                                </div>

                            </div>

                            <div className="link-login-cadastro">
                                <p>
                                    Já possui uma conta?{" "}
                                    <a href="/login">Entrar</a>
                                </p>
                            </div>

                        </form>

                    </div>
                </div>
            </div>
        </section>
    );
}
