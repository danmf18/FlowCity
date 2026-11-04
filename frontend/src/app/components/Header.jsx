import Link from 'next/link';

export default function Header() {
  return (
    <header className="navbar navbar-expand-lg bg-white border-bottom py-3">
      <div className="container">
        <Link href="/" className="navbar-brand fw-bold">
          AlertABC
        </Link>

        <nav className="d-flex gap-3">
          <Link href="/" className="nav-link">
            Início
          </Link>

          <Link href="/login" className="nav-link">
            Entrar
          </Link>

          <Link href="/cadastro" className="nav-link">
            Cadastrar
          </Link>
        </nav>
      </div>
    </header>
  );
}