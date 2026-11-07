
import Link from "next/link";
import "./usuarios.css";

const menu = [
    { titulo: "Visão geral", href: "/usuarios", icone: "bi-grid" },
    { titulo: "Meus relatos", href: "/usuarios/relatos", icone: "bi-file-earmark-text" },
    { titulo: "Novo relato", href: "/usuarios/novo-relato", icone: "bi-plus-circle" },
    { titulo: "Meu perfil", href: "/usuarios/perfil", icone: "bi-person" },
];

export default function UsuariosLayout({ children }) {
    return (
        <div className="user-dashboard">
            <aside className="user-sidebar">
                <Link href="/usuarios" className="user-brand">
                    <div className="user-brand-icon">
                        <i className="bi bi-shield-check"></i>
                    </div>
                    <div>
                        <strong>AlertABC</strong>
                        <span>Área do cidadão</span>
                    </div>
                </Link>

                <div className="user-sidebar-label">MENU PRINCIPAL</div>

                <nav className="user-navigation">
                    {menu.map((item) => (
                        <Link
                            href={item.href}
                            key={item.href}
                            className="user-nav-link"
                        >
                            <i className={`bi ${item.icone}`}></i>
                            <span>{item.titulo}</span>
                        </Link>
                    ))}
                </nav>

                <div className="user-sidebar-bottom">
                    <div className="user-help-card">
                        <i className="bi bi-info-circle"></i>
                        <strong>Precisa de ajuda?</strong>
                        <p>
                            Utilize os canais de atendimento da plataforma
                            para esclarecer suas dúvidas.
                        </p>
                    </div>

                    <Link href="/" className="user-back-link">
                        <i className="bi bi-box-arrow-left"></i>
                        Voltar ao início
                    </Link>
                </div>
            </aside>

            <main className="user-main">
                <header className="user-topbar">
                    <div>
                        <span className="user-topbar-label">
                            PORTAL DO CIDADÃO
                        </span>
                        <h2>Área do usuário</h2>
                    </div>

                    <Link
                        href="/usuarios/perfil"
                        className="user-topbar-profile"
                        aria-label="Meu perfil"
                    >
                        <div className="user-avatar">
                            <i className="bi bi-person"></i>
                        </div>
                        <div className="user-topbar-user">
                            <strong>Minha conta</strong>
                            <span>Usuário</span>
                        </div>
                        <i className="bi bi-chevron-down"></i>
                    </Link>
                </header>

                <div className="user-content">
                    {children}
                </div>
            </main>
        </div>
    );
}