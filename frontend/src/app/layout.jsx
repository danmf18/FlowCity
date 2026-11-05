
import 'bootstrap/dist/css/bootstrap.min.css';
import "./globals.css";

import Header from "./Components/Header/Header";
import Footer from "./Components/Footer/Footer";

import "bootstrap-icons/font/bootstrap-icons.css";
export const metadata = {
  title: 'AlertABC',
  description: 'Plataforma de registro e consulta de relatos.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
    <Header />

    {children}

    <Footer />
  </body>
    </html>
  );
}
