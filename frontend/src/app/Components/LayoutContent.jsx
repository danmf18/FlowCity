
"use client";

import { usePathname } from "next/navigation";

import Header from "./Header/Header";
import Footer from "./Footer/Footer";

export default function LayoutContent({ children }) {
    const pathname = usePathname();

    const paginaAdministrativa =
        pathname.startsWith("/admin-municipio") ||
        pathname.startsWith("/admin-geral");

    return (
        <>
            {!paginaAdministrativa && <Header />}

            {children}

            {!paginaAdministrativa && <Footer />}
        </>
    );
}
