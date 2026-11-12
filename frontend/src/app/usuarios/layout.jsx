"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import "./usuarios.css"

const menu = [
    {
        nome: "Inicio",
        caminho: "/usuarios",
        icone: "bi-house"
    },
    {
        nome: "Meus relatos",
        caminho: "/usuarios/relatos",
        icone: "bi-file-earmark-text"
    },
    {
        nome: "Novo relato",
        caminho: "/usuarios/novo-relato",
        icone: "bi-plus-circle"
    },    {
        nome: "Meu perfil",
        caminho: "/usuarios/perfil",
        icone: "bi-person"
    }
        
];

export default function UsuariosLayout({ children}){
    
    const pathname = usePathname();
    const router = useRouter();

    const [usuario, setUsuario] = useState(null);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const usuarioSalvo = localStorage.getItem("usuario");

        if (!token){
            router.replace("/login");
            return;
        }

        try{
            if (usuarioSalvo) {
                setUsuario(JSON.parse(usuarioSalvo));
            }
        } catch(erro){
            console.error("Erro ao carregar usuário:", erro);
        }

        setCarregando(false);
    }, [router]);

    function sair(){
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");

        router.push("/login");
    }

    if (carregando){
        return (
            <div className="usuarios-loading">
                <div className="spinner-border text-primary"></div>
                <span>Carregando sua área...</span>
            </div>
        );
    }




    return(
        <div className="usuarios-container">


            <aside className="usuarios-sidebar">

                <Link href="/usuarios" className="usuarios-brand">
                    <span className="usuarios-brand-icon">
                        <i  className="bi bi-shield-check"></i>
                    </span>
                
                <span>
                    Alert<span>ABC</span>
                </span>
                </Link>

                <div className="usuarios-user">
                    <div className="usuarios-avatar">
                        <i className="bi bi-person"></i>
                    </div>

                    <div className="usuarios-user-info" >
                        <strong>
                            {usuario?.nome || "Cidadão"}
                        </strong>

                        <span>Conta de cidadão</span>
                    </div>
                </div>

                <nav  className="usuarios-navigation">

                    <span className="usuarios-menu-title" >
                        MENU PRINCIPAL
                    </span>

                    {menu.map((item) => {
                        const ativo = pathname === item.caminho;

                        return(
                            <Link
                                key={item.caminho}
                                href={item.caminho}
                                className={`usuarios-menu-item ${
                                    ativo ? "active" : ""
                                }`}
                                >
                                    <i  className={`bi ${item.icone}`}></i>
                                    <span>{item.nome}</span>
                            </Link>
                        );
                    })}
                </nav>
                


                <div className="usuarios-sidebar-bottom"  >
                    <button
                        type="button"
                        className="usuarios-logout"
                        onClick={sair}
                    >
                        <i  className="bi bi-box-arrow-left"></i>
                        <span>Sair da conta</span>
                    </button>
                </div>

            </aside>




            <div className="usuarios-main">

                <header className="usuarios-topbar" >
                    <div>
                        <span className="usuarios-topbar-label">
                            ÁREA DO CIDADÃO
                        </span>
                        <h1>Meu espaço</h1>
                    </div>

                    <div className="usuarios-topbar-user">
                        <div className="usuarios-avatar small">
                            <i className="bi bi-person"></i>
                        </div>

                        <span>
                            {usuario?.nome || "Cidadão"}
                        </span>

                    </div>

                </header>

                    <main className="usuarios-content">
                        {children}
                    </main>

                
            </div>




        </div>
    );
}