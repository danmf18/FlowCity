
"use client";

import { useEffect, useRef, useState } from "react";

import {
    Map as MapLibre,
    NavigationControl,
    Marker,
    Popup,
    LngLatBounds,
    setWorkerUrl,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import "./mapa-de-relatos.css";

setWorkerUrl(
    new URL(
        "maplibre-gl/dist/maplibre-gl-worker.mjs",
        import.meta.url
    ).toString()
);

const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
).replace(/\/+$/, "");

const MUNICIPIOS_ABC = [
    "Diadema",
    "Mauá",
    "Ribeirão Pires",
    "Rio Grande da Serra",
    "Santo André",
    "São Bernardo do Campo",
    "São Caetano do Sul",
];

const LIMITES_OFICIAIS = [100, 250, 500, 1000, 2500, 5000, 50000];

export default function MapaDeRelatos() {
    const mapaRef = useRef(null);
    const instanciaMapaRef = useRef(null);
    const marcadoresRef = useRef([]);
    const popupRef = useRef(null);

    const [mapaPronto, setMapaPronto] = useState(false);

    // Relatos dos cidadãos
    const [relatos, setRelatos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    // Ocorrências oficiais
    const [dadosOficiais, setDadosOficiais] = useState([]);
    const [carregandoOficiais, setCarregandoOficiais] = useState(true);
    const [erroOficial, setErroOficial] = useState("");
    const [totalOficial, setTotalOficial] = useState(0);

    // Filtros
    const [pesquisa, setPesquisa] = useState("");
    const [categoria, setCategoria] = useState("");
    const [municipio, setMunicipio] = useState("");

    // Limite de ocorrências oficiais
    const [limiteOficiais, setLimiteOficiais] = useState(500);

    // Paginação dos relatos
    const [pagina, setPagina] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPaginas, setTotalPaginas] = useState(1);

    const [categorias, setCategorias] = useState([]);

    const limite = 12;

    // Normaliza textos para comparar nomes de municípios
    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }

    // Verifica se dois municípios são iguais
    function municipiosIguais(valor1, valor2) {
        return normalizarTexto(valor1) === normalizarTexto(valor2);
    }

    // Verifica se o município pertence ao ABC
    function municipioPertenceAoABC(valor) {
        return MUNICIPIOS_ABC.some((item) =>
            municipiosIguais(item, valor)
        );
    }

    // Inicialização do mapa
    useEffect(() => {
        if (!mapaRef.current || instanciaMapaRef.current) {
            return;
        }

        const mapa = new MapLibre({
            container: mapaRef.current,
            style: "https://tiles.openfreemap.org/styles/liberty",
            center: [-46.53, -23.67],
            zoom: 9,
        });

        mapa.addControl(
            new NavigationControl(),
            "top-right"
        );

        mapa.on("error", (evento) => {
            console.error("Erro no MapLibre:", evento.error);
        });

        mapa.once("load", () => {
            setMapaPronto(true);
        });

        instanciaMapaRef.current = mapa;

        return () => {
            marcadoresRef.current.forEach((marcador) => {
                marcador.remove();
            });

            marcadoresRef.current = [];

            popupRef.current?.remove();
            popupRef.current = null;

            mapa.remove();
            instanciaMapaRef.current = null;
        };
    }, []);

    // Busca dos relatos públicos
    useEffect(() => {
        let ativo = true;

        async function buscarRelatos() {
            try {
                setCarregando(true);
                setErro("");

                const parametros = new URLSearchParams({
                    pagina: String(pagina),
                    limite: String(limite),
                });

                if (pesquisa.trim()) {
                    parametros.set("pesquisa", pesquisa.trim());
                }

                if (categoria) {
                    parametros.set("categoria", categoria);
                }

                if (municipio) {
                    parametros.set("municipio", municipio);
                }

                const url = `${API_URL}/relatos?${parametros.toString()}`;

                const resposta = await fetch(url);

                if (!resposta.ok) {
                    throw new Error(
                        `Erro HTTP ${resposta.status} ao carregar relatos.`
                    );
                }

                const dados = await resposta.json();

                if (!ativo) return;

                const lista = Array.isArray(dados.relatos)
                    ? dados.relatos
                    : [];

                setRelatos(lista);
                setTotal(Number(dados.total) || 0);

                setTotalPaginas(
                    Number(dados.totalPaginas) || 1
                );

                setCategorias((anteriores) => [
                    ...new Set([
                        ...anteriores,
                        ...lista
                            .map((item) => item.categoria)
                            .filter(Boolean),
                    ]),
                ]);

            } catch (error) {
                if (!ativo) return;

                console.error("Erro ao buscar relatos:", error);

                setErro(
                    error instanceof TypeError
                        ? `Não foi possível conectar à API: ${API_URL}`
                        : error.message
                );

                setRelatos([]);
                setTotal(0);
                setTotalPaginas(1);

            } finally {
                if (ativo) {
                    setCarregando(false);
                }
            }
        }

        buscarRelatos();

        return () => {
            ativo = false;
        };
    }, [pagina, pesquisa, categoria, municipio]);

    // Busca das ocorrências oficiais individuais
    useEffect(() => {
        let ativo = true;

        async function buscarDadosOficiais() {
            try {
                setCarregandoOficiais(true);
                setErroOficial("");

                const parametros = new URLSearchParams({
                    limite: String(limiteOficiais),
                });

                const url =
                    `${API_URL}/relatos/oficiais/mapa?${parametros.toString()}`;

                const resposta = await fetch(url);

                if (!resposta.ok) {
                    throw new Error(
                        `Erro HTTP ${resposta.status} ao carregar ocorrências oficiais.`
                    );
                }

                const dados = await resposta.json();

                if (!ativo) return;

                const lista = Array.isArray(dados.registros)
                    ? dados.registros
                    : [];

                setDadosOficiais(lista);
                setTotalOficial(Number(dados.total) || lista.length);

            } catch (error) {
                if (!ativo) return;

                console.error(
                    "Erro ao buscar dados oficiais:",
                    error
                );

                setErroOficial(
                    error instanceof TypeError
                        ? `Não foi possível conectar à API: ${API_URL}`
                        : error.message
                );

                setDadosOficiais([]);
                setTotalOficial(0);

            } finally {
                if (ativo) {
                    setCarregandoOficiais(false);
                }
            }
        }

        buscarDadosOficiais();

        return () => {
            ativo = false;
        };
    }, [limiteOficiais]);

    // Formatação de data
    function formatarData(data) {
        if (!data) return "Data não informada";

        if (
            typeof data === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(data)
        ) {
            const [ano, mes, dia] = data.split("-").map(Number);

            return new Date(
                ano,
                mes - 1,
                dia
            ).toLocaleDateString("pt-BR");
        }

        const dataFormatada = new Date(data);

        if (Number.isNaN(dataFormatada.getTime())) {
            return "Data não informada";
        }

        return dataFormatada.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
        });
    }

    function formatarDataHora(data) {
        if (!data) return "Não informada";

        const dataFormatada = new Date(data);

        if (Number.isNaN(dataFormatada.getTime())) {
            return "Não informada";
        }

        return dataFormatada.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
        });
    }

    // Cria uma linha de informação do popup
    function criarInformacaoPopup(rotulo, valor) {
        const linha = document.createElement("div");
        linha.className = "popup-relato-info";

        const titulo = document.createElement("span");
        titulo.className = "popup-relato-rotulo";
        titulo.textContent = rotulo;

        const conteudo = document.createElement("strong");
        conteudo.className = "popup-relato-valor";
        conteudo.textContent = valor || "Não informado";

        linha.appendChild(titulo);
        linha.appendChild(conteudo);

        return linha;
    }

    // Popup dos relatos dos cidadãos
    function criarPopupRelato(relato) {
        const container = document.createElement("div");
        container.className = "popup-relato";

        const topo = document.createElement("div");
        topo.className = "popup-relato-topo";

        const identificacao = document.createElement("span");
        identificacao.className = "popup-relato-identificacao";
        identificacao.textContent = `RELATO #${relato.id_relato}`;

        const status = document.createElement("span");
        status.className = "popup-relato-status";
        status.textContent = "Aprovado";

        topo.appendChild(identificacao);
        topo.appendChild(status);

        const titulo = document.createElement("h3");
        titulo.className = "popup-relato-titulo";
        titulo.textContent =
            relato.categoria || "Categoria não informada";

        const informacoes = document.createElement("div");
        informacoes.className = "popup-relato-informacoes";

        informacoes.appendChild(
            criarInformacaoPopup("Município", relato.municipio)
        );

        informacoes.appendChild(
            criarInformacaoPopup(
                "Data da ocorrência",
                formatarData(relato.data_fato)
            )
        );

        informacoes.appendChild(
            criarInformacaoPopup(
                "Horário",
                relato.hora_fato || "Não informado"
            )
        );

        const descricaoContainer = document.createElement("div");
        descricaoContainer.className = "popup-relato-descricao";

        const descricaoTitulo = document.createElement("span");
        descricaoTitulo.className = "popup-relato-rotulo";
        descricaoTitulo.textContent = "Descrição";

        const descricaoTexto = document.createElement("p");
        descricaoTexto.textContent =
            relato.descricao?.trim() ||
            "Nenhuma descrição pública foi disponibilizada.";

        descricaoContainer.appendChild(descricaoTitulo);
        descricaoContainer.appendChild(descricaoTexto);

        const publicacao = document.createElement("p");
        publicacao.className = "popup-relato-publicacao";
        publicacao.textContent =
            `Publicado em ${formatarDataHora(relato.enviado_em)}`;

        const aviso = document.createElement("div");
        aviso.className = "popup-relato-aviso";

        const iconeAviso = document.createElement("i");
        iconeAviso.className = "bi bi-shield-lock";

        const textoAviso = document.createElement("span");
        textoAviso.textContent =
            "A localização exibida é aproximada. Dados pessoais não são apresentados.";

        aviso.appendChild(iconeAviso);
        aviso.appendChild(textoAviso);

        container.appendChild(topo);
        container.appendChild(titulo);
        container.appendChild(informacoes);
        container.appendChild(descricaoContainer);
        container.appendChild(publicacao);
        container.appendChild(aviso);

        return container;
    }

    // Popup de uma ocorrência oficial individual
    function criarPopupOficial(registro) {
        const container = document.createElement("div");
        container.className = "popup-relato";

        const topo = document.createElement("div");
        topo.className = "popup-relato-topo";

        const identificacao = document.createElement("span");
        identificacao.className = "popup-relato-identificacao";
        identificacao.textContent =
            `OCORRÊNCIA #${registro.id_ocorrencia}`;

        const status = document.createElement("span");
        status.className = "popup-relato-status";
        status.textContent = "SSP-SP";

        topo.appendChild(identificacao);
        topo.appendChild(status);

        const titulo = document.createElement("h3");
        titulo.className = "popup-relato-titulo";
        titulo.textContent =
            registro.natureza || "Natureza não informada";

        const informacoes = document.createElement("div");
        informacoes.className = "popup-relato-informacoes";

        informacoes.appendChild(
            criarInformacaoPopup(
                "Município",
                registro.municipio
            )
        );

        informacoes.appendChild(
            criarInformacaoPopup(
                "Bairro",
                registro.bairro
            )
        );

        informacoes.appendChild(
            criarInformacaoPopup(
                "Data da ocorrência",
                formatarData(registro.data_ocorrencia)
            )
        );

        const aviso = document.createElement("div");
        aviso.className = "popup-relato-aviso";

        const iconeAviso = document.createElement("i");
        iconeAviso.className = "bi bi-info-circle";

        const textoAviso = document.createElement("span");
        textoAviso.textContent =
            "Registro individual proveniente dos dados oficiais da SSP-SP.";

        aviso.appendChild(iconeAviso);
        aviso.appendChild(textoAviso);

        container.appendChild(topo);
        container.appendChild(titulo);
        container.appendChild(informacoes);
        container.appendChild(aviso);

        return container;
    }

    // Validação das coordenadas
    function possuiCoordenadas(item) {
        if (
            item.latitude === null ||
            item.latitude === undefined ||
            item.longitude === null ||
            item.longitude === undefined ||
            item.latitude === "" ||
            item.longitude === ""
        ) {
            return false;
        }

        const latitude = Number(item.latitude);
        const longitude = Number(item.longitude);

        return (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude !== 0 &&
            longitude !== 0 &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
        );
    }

    // Criação dos marcadores
    useEffect(() => {
        const mapa = instanciaMapaRef.current;

        if (!mapa || !mapaPronto) return;

        marcadoresRef.current.forEach((marcador) => {
            marcador.remove();
        });

        marcadoresRef.current = [];

        popupRef.current?.remove();
        popupRef.current = null;

        const limites = new LngLatBounds();
        let quantidadeMarcadores = 0;

        // Marcadores dos relatos dos cidadãos
        const relatosComCoordenadas = relatos.filter((relato) => {
            if (!possuiCoordenadas(relato)) {
                return false;
            }

            if (
                municipio &&
                !municipiosIguais(relato.municipio, municipio)
            ) {
                return false;
            }

            if (
                pesquisa.trim() &&
                !normalizarTexto(
                    `${relato.municipio || ""} ${relato.categoria || ""} ${relato.descricao || ""}`
                ).includes(normalizarTexto(pesquisa))
            ) {
                return false;
            }

            return true;
        });

        relatosComCoordenadas.forEach((relato) => {
            const latitude = Number(relato.latitude);
            const longitude = Number(relato.longitude);

            const marcador = new Marker({
                color: "#2457C5",
            })
                .setLngLat([longitude, latitude])
                .addTo(mapa);

            marcador.getElement().style.cursor = "pointer";

            marcador.getElement().setAttribute(
                "aria-label",
                `Abrir relato ${relato.id_relato}`
            );

            marcador.getElement().addEventListener("click", () => {
                popupRef.current?.remove();

                const popup = new Popup({
                    closeButton: true,
                    closeOnClick: false,
                    offset: 22,
                    maxWidth: "340px",
                })
                    .setLngLat([longitude, latitude])
                    .setDOMContent(criarPopupRelato(relato))
                    .addTo(mapa);

                popupRef.current = popup;

                popup.on("close", () => {
                    if (popupRef.current === popup) {
                        popupRef.current = null;
                    }
                });
            });

            marcadoresRef.current.push(marcador);
            limites.extend([longitude, latitude]);
            quantidadeMarcadores++;
        });

        // Filtragem das ocorrências oficiais
        const oficiaisFiltrados = dadosOficiais.filter((registro) => {
            if (!possuiCoordenadas(registro)) {
                return false;
            }

            if (
                municipio &&
                !municipiosIguais(registro.municipio, municipio)
            ) {
                return false;
            }

            if (
                pesquisa.trim() &&
                !normalizarTexto(
                    `${registro.municipio || ""} ${registro.bairro || ""} ${registro.natureza || ""}`
                ).includes(normalizarTexto(pesquisa))
            ) {
                return false;
            }

            return true;
        });

        // Um marcador vermelho para cada ocorrência oficial
        oficiaisFiltrados.forEach((registro) => {
            const latitude = Number(registro.latitude);
            const longitude = Number(registro.longitude);

            const marcador = new Marker({
                color: "#DC3545",
            })
                .setLngLat([longitude, latitude])
                .addTo(mapa);

            marcador.getElement().style.cursor = "pointer";

            marcador.getElement().setAttribute(
                "aria-label",
                `Ocorrência ${registro.id_ocorrencia} - ${registro.municipio}`
            );

            marcador.getElement().addEventListener("click", () => {
                popupRef.current?.remove();

                const popup = new Popup({
                    closeButton: true,
                    closeOnClick: false,
                    offset: 22,
                    maxWidth: "340px",
                })
                    .setLngLat([longitude, latitude])
                    .setDOMContent(criarPopupOficial(registro))
                    .addTo(mapa);

                popupRef.current = popup;

                popup.on("close", () => {
                    if (popupRef.current === popup) {
                        popupRef.current = null;
                    }
                });
            });

            marcadoresRef.current.push(marcador);
            limites.extend([longitude, latitude]);
            quantidadeMarcadores++;
        });

        // Ajusta o mapa aos marcadores
        if (quantidadeMarcadores > 1) {
            mapa.fitBounds(limites, {
                padding: 90,
                maxZoom: 12,
                duration: 800,
            });
        } else if (quantidadeMarcadores === 1) {
            const centro = limites.getCenter();

            mapa.flyTo({
                center: [centro.lng, centro.lat],
                zoom: 11,
                duration: 800,
            });
        }

        return () => {
            marcadoresRef.current.forEach((marcador) => {
                marcador.remove();
            });

            marcadoresRef.current = [];

            popupRef.current?.remove();
            popupRef.current = null;
        };
    }, [
        relatos,
        dadosOficiais,
        municipio,
        pesquisa,
        mapaPronto,
    ]);

    // Limpar filtros
    function limparFiltros() {
        setPesquisa("");
        setCategoria("");
        setMunicipio("");
        setLimiteOficiais(500);
        setPagina(1);
    }

    function alterarPesquisa(valor) {
        setPesquisa(valor);
        setPagina(1);
    }

    function alterarCategoria(valor) {
        setCategoria(valor);
        setPagina(1);
    }

    function alterarMunicipio(valor) {
        setMunicipio(valor);
        setPagina(1);
    }

    return (
        <main className="mapa-relatos-page">
            <div
                ref={mapaRef}
                className="mapa-interativo"
                aria-label="Mapa de relatos públicos e ocorrências oficiais do AlertABC"
            />

            {/* Controles e filtros */}
            <section className="mapa-controles">
                <div className="mapa-controles-cabecalho">
                    <div>
                        <span className="mapa-relatos-eyebrow">
                            ALERTABC / TRANSPARÊNCIA
                        </span>

                        <h1>Mapa de Relatos</h1>

                        <p>
                            Explore os relatos públicos e as ocorrências
                            oficiais da região.
                        </p>
                    </div>

                    <span className="mapa-relatos-status">
                        <span className="status-indicator" />
                        Dados públicos
                    </span>
                </div>

                <div className="mapa-filtros">
                    <label className="mapa-pesquisa">
                        <i className="bi bi-search" />

                        <input
                            type="search"
                            placeholder="Pesquisar relatos ou municípios..."
                            value={pesquisa}
                            onChange={(evento) =>
                                alterarPesquisa(evento.target.value)
                            }
                            aria-label="Pesquisar relatos ou municípios"
                        />
                    </label>

                    <select
                        value={categoria}
                        onChange={(evento) =>
                            alterarCategoria(evento.target.value)
                        }
                        aria-label="Filtrar por categoria"
                    >
                        <option value="">Todas as categorias</option>

                        {categorias.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    {/* Lista única de municípios */}
                    <select
                        value={municipio}
                        onChange={(evento) =>
                            alterarMunicipio(evento.target.value)
                        }
                        aria-label="Filtrar por município"
                    >
                        <option value="">Todos os municípios</option>

                        {MUNICIPIOS_ABC.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    {/* Limite de ocorrências oficiais */}
                    <select
                        value={limiteOficiais}
                        onChange={(evento) =>
                            setLimiteOficiais(Number(evento.target.value))
                        }
                        aria-label="Limitar quantidade de ocorrências oficiais"
                        title="Quantidade máxima de ocorrências oficiais"
                    >
                        {LIMITES_OFICIAIS.map((valor) => (
                            <option key={valor} value={valor}>
                                {valor === 50000
                                    ? "Todas as ocorrências"
                                    : `${valor.toLocaleString("pt-BR")} ocorrências oficiais`}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className="mapa-limpar-filtros"
                        onClick={limparFiltros}
                        title="Limpar filtros"
                        aria-label="Limpar filtros"
                    >
                        <i className="bi bi-arrow-counterclockwise" />
                    </button>
                </div>

                <div className="mapa-controles-rodape">
                    <span>
                        <i className="bi bi-geo-alt" />
                        {total.toLocaleString("pt-BR")} relatos encontrados
                    </span>

                    <span>
                        <i className="bi bi-database" />
                        {totalOficial.toLocaleString("pt-BR")} ocorrências oficiais carregadas
                    </span>

                    <span className="mapa-regiao">
                        Região do ABC Paulista
                    </span>
                </div>

                <div className="mapa-legenda">
                    <span>
                        <span className="mapa-legenda-ponto mapa-legenda-cidadao" />
                        Relatos dos cidadãos
                    </span>

                    <span>
                        <span className="mapa-legenda-ponto mapa-legenda-oficial" />
                        Ocorrências oficiais SSP-SP
                    </span>
                </div>
            </section>

            {/* Carregamento dos relatos */}
            {carregando && (
                <div className="mapa-mensagem">
                    <div className="relatos-spinner" />
                    <span>Carregando relatos...</span>
                </div>
            )}

            {!carregando && erro && (
                <div className="mapa-mensagem mapa-mensagem-erro">
                    <i className="bi bi-exclamation-circle" />
                    <strong>Não foi possível carregar os relatos</strong>
                    <span>{erro}</span>
                </div>
            )}

            {/* Carregamento oficial */}
            {carregandoOficiais && (
                <div className="mapa-mensagem">
                    <div className="relatos-spinner" />
                    <span>Carregando ocorrências oficiais...</span>
                </div>
            )}

            {!carregandoOficiais && erroOficial && (
                <div className="mapa-mensagem mapa-mensagem-erro">
                    <i className="bi bi-exclamation-circle" />
                    <strong>Dados oficiais indisponíveis</strong>
                    <span>{erroOficial}</span>
                </div>
            )}

            {/* Nenhum registro */}
            {!carregando &&
                !carregandoOficiais &&
                !erro &&
                !erroOficial &&
                relatos.length === 0 &&
                dadosOficiais.length === 0 && (
                    <div className="mapa-mensagem">
                        <i className="bi bi-search" />
                        <strong>Nenhum registro encontrado</strong>
                        <span>
                            Não existem relatos ou ocorrências oficiais
                            para os filtros selecionados.
                        </span>
                    </div>
                )}

            {/* Paginação dos relatos */}
            {!carregando && !erro && totalPaginas > 1 && (
                <div className="mapa-paginacao">
                    <button
                        type="button"
                        disabled={pagina <= 1}
                        onClick={() =>
                            setPagina((atual) => atual - 1)
                        }
                        aria-label="Página anterior"
                    >
                        <i className="bi bi-chevron-left" />
                    </button>

                    <span>
                        Página <strong>{pagina}</strong> de{" "}
                        <strong>{totalPaginas}</strong>
                    </span>

                    <button
                        type="button"
                        disabled={pagina >= totalPaginas}
                        onClick={() =>
                            setPagina((atual) => atual + 1)
                        }
                        aria-label="Próxima página"
                    >
                        <i className="bi bi-chevron-right" />
                    </button>
                </div>
            )}

            {/* Aviso de privacidade */}
            <div className="mapa-privacidade">
                <i className="bi bi-shield-lock" />

                <span>
                    Localizações aproximadas. Dados pessoais protegidos.
                </span>
            </div>
        </main>
    );
}
