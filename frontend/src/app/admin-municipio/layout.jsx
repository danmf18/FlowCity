import Link from "next/link";
import "./admin-municipio.css";

const menu = [
    { titulo: "Visão geral", href: "/admin-municipio", icone: "bi-grid" },
    { titulo: "Relatos", href: "/admin-municipio/relatos", icone: "bi-file-earmark-text" },
    { titulo: "Boletins oficiais", href: "/admin-municipio/boletins", icone: "bi-file-earmark-lock" },
    { titulo: "Usuários", href: "/admin-municipio/usuarios", icone: "bi-people" },
];

export default function AdminMunicipioLayout({ children }) {
    return (
        <div className="municipal-dashboard">
            <aside className="municipal-sidebar">
                <Link href="/admin-municipio" className="municipal-brand">
                    <div className="municipal-brand-icon">
                        <i className="bi bi-shield-check"></i>
                    </div>
                    <div>
                        <strong>AlertABC</strong>
                        <span>Gestão municipal</span>
                    </div>
                </Link>

                <div className="municipal-menu-label">MENU PRINCIPAL</div>

                <nav className="municipal-navigation">
                    {menu.map((item) => (
                        <Link
                            href={item.href}
                            key={item.href}
                            className="municipal-nav-link"
                        >
                            <i className={`bi ${item.icone}`}></i>
                            <span>{item.titulo}</span>
                        </Link>
                    ))}
                </nav>

                <div className="municipal-sidebar-bottom">
                    <div className="municipal-help">
                        <i className="bi bi-info-circle"></i>
                        <strong>Acesso municipal</strong>
                        <p>
                            Esta área apresenta informações vinculadas ao
                            município associado à sua conta.
                        </p>
                    </div>

                    <Link href="/" className="municipal-back">
                        <i className="bi bi-box-arrow-left"></i>
                        Voltar ao início
                    </Link>
                </div>
            </aside>

            <main className="municipal-main">
                <header className="municipal-topbar">
                    <div>
                        <span>PAINEL ADMINISTRATIVO</span>
                        <h2>Administrador de município</h2>
                    </div>

                    <Link
                        href="/admin-municipio/usuarios"
                        className="municipal-account"
                    >
                        <div className="municipal-avatar">
                            <i className="bi bi-person"></i>
                        </div>
                        <div>
                            <strong>Administrador</strong>
                            <span>Gestão municipal</span>
                        </div>
                    </Link>
                </header>

                <div className="municipal-content">
                    {children}
                </div>
            </main>
        </div>
    );
}