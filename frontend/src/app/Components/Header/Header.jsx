"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import "./Header.css";

export default function Header() {
    const [usuario, setUsuario] = useState(null);
    const [menuAberto, setMenuAberto] = useState(false);

    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        function verificarLogin() {
            const token = localStorage.getItem("token");
            const dadosUsuario =
                localStorage.getItem("usuario") ||
                localStorage.getItem("user");

            if (token && dadosUsuario) {
                try {
                    setUsuario(JSON.parse(dadosUsuario));
                } catch {
                    setUsuario(null);
                }
            } else {
                setUsuario(null);
            }
        }

        verificarLogin();
    }, [pathname]);

    function sair() {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        localStorage.removeItem("user");

        setUsuario(null);
        setMenuAberto(false);

        router.push("/");
    }

    const nomeUsuario =
        usuario?.nome ||
        usuario?.name ||
        usuario?.nome_usuario ||
        "Minha conta";

    return (
        <header className="header">
            <div className="header-container">

                <Link href="/" className="header-logo">
                    <span className="header-logo-icon">
                        <i className="bi bi-shield-check"></i>
                    </span>

                    <span>Alert<span>ABC</span></span>
                </Link>

                <button
                    className="header-menu-button"
                    onClick={() => setMenuAberto(!menuAberto)}
                    aria-label="Abrir menu"
                >
                    <i className={`bi ${menuAberto ? "bi-x-lg" : "bi-list"}`}></i>
                </button>

                <nav className={`header-nav ${menuAberto ? "active" : ""}`}>
                    <Link href="/" onClick={() => setMenuAberto(false)}>
                        Início
                    </Link>

                    <Link href="/sobre" onClick={() => setMenuAberto(false)}>
                        Sobre
                    </Link>

                    <Link href="/relatos" onClick={() => setMenuAberto(false)}>
                        Relatos
                    </Link>

                    {usuario ? (
                        <div className="header-user">
                            <div className="header-user-info">
                                <i className="bi bi-person-circle"></i>
                                <span>{nomeUsuario}</span>
                            </div>

                            <button
                                className="header-logout"
                                onClick={sair}
                            >
                                <i className="bi bi-box-arrow-right"></i>
                                Sair
                            </button>
                        </div>
                    ) : (
                        <div className="header-actions">
                            <Link
                                href="/login"
                                className="header-login"
                                onClick={() => setMenuAberto(false)}
                            >
                                Entrar
                            </Link>

                            <Link
                                href="/cadastro"
                                className="header-register"
                                onClick={() => setMenuAberto(false)}
                            >
                                Cadastrar
                            </Link>
                        </div>
                    )}
                </nav>

            </div>
        </header>
    );
}