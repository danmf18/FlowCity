"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const categorias = [
    "Apreensão de Entorpecentes",
    "Estupro",
    "Estupro de Vulnerável",
    "Extorsão Mediante Sequestro",
    "Furto - Outros",
    "Furto de Carga",
    "Furto de Veículo",
    "Homicídio Culposo Outros",
    "Homicídio Culposo por Acidente de Trânsito",
    "Homicídio Doloso",
    "Homicídio Doloso por Acidente de Trânsito",
    "Latrocínio",
    "Lesão Corporal Culposa - Outras",
    "Lesão Corporal Culposa por Acidente de Trânsito",
    "Lesão Corporal Dolosa",
    "Lesão Corporal Seguida de Morte",
    "Porte de Arma",
    "Porte de Entorpecentes",
    "Roubo - Outros",
    "Roubo de Carga",
    "Roubo de Veículo",
    "Tentativa de Homicídio",
    "Tráfico de Entorpecentes",
];

const municipios = [
    "São Bernardo do Campo",
    "Santo André",
    "São Caetano do Sul",
    "Diadema",
    "Mauá",
    "Ribeirão Pires",
    "Rio Grande da Serra",
];

export default function NovoRelatoPage() {
    const router = useRouter();
    const mapaRef = useRef(null);
    const instanciaMapaRef = useRef(null);
    const marcadorRef = useRef(null);

    const [formulario, setFormulario] = useState({
        categoria: "",
        municipio: "",
        data: "",
        hora: "",
        latitude: "",
        longitude: "",
        referencia: "",
        descricao: "",
    });
    const [mensagem, setMensagem] = useState("");
    const [mapaAberto, setMapaAberto] = useState(false);

    useEffect(() => {
        if (!mapaAberto || !mapaRef.current || instanciaMapaRef.current) return;

        const mapa = new maplibregl.Map({
            container: mapaRef.current,
            style: "https://tiles.openfreemap.org/styles/liberty",
            center: [-46.53, -23.67],
            zoom: 9,
        });

        mapa.addControl(new maplibregl.NavigationControl(), "top-right");
        mapa.on("click", (evento) => {
            const latitude = evento.lngLat.lat.toFixed(6);
            const longitude = evento.lngLat.lng.toFixed(6);

            setFormulario((anterior) => ({
                ...anterior,
                latitude,
                longitude,
            }));

            if (marcadorRef.current) {
                marcadorRef.current.setLngLat(evento.lngLat);
            } else {
                marcadorRef.current = new maplibregl.Marker()
                    .setLngLat(evento.lngLat)
                    .addTo(mapa);
            }
            setMapaAberto(false);
        });

        instanciaMapaRef.current = mapa;

        return () => {
            mapa.remove();
            instanciaMapaRef.current = null;
            marcadorRef.current = null;
        };
    }, [mapaAberto]);

    function atualizarCampo(e) {
        const { name, value } = e.target;
        setFormulario((anterior) => ({ ...anterior, [name]: value }));
    }

    function enviarRelato(e) {
        e.preventDefault();

        if (
            !formulario.categoria ||
            !formulario.municipio ||
            !formulario.data ||
            !formulario.latitude ||
            !formulario.longitude ||
            !formulario.descricao.trim()
        ) {
            setMensagem("Preencha os campos obrigatórios e marque o local no mapa.");
            return;
        }

        setMensagem(
            "Relato preenchido com sucesso! O envio ao banco de dados ainda não está disponível."
        );
    }

    return (
        <div className="user-page">
            <div className="user-page-heading">
                <div>
                    <span>REGISTRO DE INFORMAÇÕES</span>
                    <h1>Registrar novo relato</h1>
                    <p>Compartilhe informações sobre uma possível ocorrência na sua região.</p>
                </div>
            </div>

            <section className="user-panel">
                <div className="user-panel-header">
                    <div>
                        <h2>Informações do relato</h2>
                        <p>Preencha os dados com clareza e responsabilidade.</p>
                    </div>
                </div>

                <form className="user-form" onSubmit={enviarRelato}>
                    <div className="user-form-grid">
                        <div className="user-form-group">
                            <label htmlFor="categoria">Categoria da ocorrência *</label>
                            <select id="categoria" name="categoria" value={formulario.categoria} onChange={atualizarCampo} required style={{ borderColor: "#64748B" }}>
                                <option value="">Selecione uma categoria</option>
                                {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                            </select>
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="municipio">Município da ocorrência *</label>
                            <select id="municipio" name="municipio" value={formulario.municipio} onChange={atualizarCampo} required style={{ borderColor: "#64748B" }}>
                                <option value="">Selecione um município</option>
                                {municipios.map((municipio) => <option key={municipio} value={municipio}>{municipio}</option>)}
                            </select>
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="data">Data da ocorrência *</label>
                            <input type="date" id="data" name="data" value={formulario.data} onChange={atualizarCampo} max={new Date().toISOString().split("T")[0]} required style={{ borderColor: "#64748B" }} />
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="hora">Hora da ocorrência</label>
                            <input type="time" id="hora" name="hora" value={formulario.hora} onChange={atualizarCampo} style={{ borderColor: "#64748B" }} />
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="latitude">Latitude *</label>
                            <input type="text" id="latitude" name="latitude" value={formulario.latitude} readOnly required placeholder="Clique no mapa" style={{ borderColor: "#64748B" }} />
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="longitude">Longitude *</label>
                            <input type="text" id="longitude" name="longitude" value={formulario.longitude} readOnly required placeholder="Clique no mapa" style={{ borderColor: "#64748B" }} />
                        </div>

                        <div className="user-form-group" style={{ gridColumn: "1 / -1" }}>
                            <label htmlFor="referencia">Referência do local</label>
                            <input type="text" id="referencia" name="referencia" placeholder="Ex.: próximo à praça central" value={formulario.referencia} onChange={atualizarCampo} maxLength={255} style={{ borderColor: "#64748B" }} />
                        </div>

                        <div className="user-form-group">
                            <label htmlFor="descricao">Descrição do relato *</label>
                            <textarea id="descricao" name="descricao" placeholder="Descreva o que foi observado e inclua informações relevantes sobre a situação." value={formulario.descricao} onChange={atualizarCampo} rows={6} maxLength={2000} required style={{ borderColor: "#64748B" }} />
                            <small>{formulario.descricao.length}/2000 caracteres</small>
                        </div>

                        <div className="user-form-group user-map-group" style={{ gridColumn: "1 / -1" }}>
                            <label>Local da ocorrência no mapa *</label>
                            <p className="user-map-help">Escolha o ponto da ocorrência para preencher as coordenadas.</p>
                            <button type="button" className="user-btn-secondary" onClick={() => setMapaAberto(true)}>
                                {formulario.latitude ? "Alterar ponto no mapa" : "Selecionar ponto no mapa"}
                            </button>
                            {formulario.latitude && formulario.longitude && (
                                <small>Local selecionado: {formulario.latitude}, {formulario.longitude}</small>
                            )}
                        </div>
                    </div>

                    <div className="user-alert">
                        <i className="bi bi-exclamation-triangle"></i>
                        <div>
                            <strong>Antes de enviar</strong>
                            <p>O AlertABC recebe relatos não oficiais enviados por usuários. Não inclua acusações sem fundamento, dados pessoais de terceiros ou informações que possam colocar alguém em risco. O registro não substitui uma comunicação às autoridades competentes.</p>
                        </div>
                    </div>

                    {mensagem && <div className="user-alert" role="status"><i className="bi bi-info-circle"></i><p>{mensagem}</p></div>}

                    <div className="user-form-actions">
                        <button type="button" className="user-btn-secondary" onClick={() => router.push("/usuarios")}>Cancelar</button>
                        <button type="submit" className="user-btn-primary"><i className="bi bi-send"></i>Enviar relato</button>
                    </div>
                </form>
            </section>

            {mapaAberto && (
                <div
                    role="presentation"
                    onClick={(evento) => {
                        if (evento.target === evento.currentTarget) setMapaAberto(false);
                    }}
                    style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "rgba(15, 23, 42, 0.65)" }}
                >
                    <section role="dialog" aria-modal="true" aria-labelledby="titulo-mapa-relato" style={{ position: "relative", width: "min(100%, 1000px)", height: "min(80vh, 680px)", padding: "20px", background: "#fff", borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
                        <h2 id="titulo-mapa-relato" style={{ margin: "0 48px 14px 0", fontSize: "18px" }}>Clique no mapa para selecionar o ponto</h2>
                        <button type="button" onClick={() => setMapaAberto(false)} aria-label="Fechar mapa" style={{ position: "absolute", top: "12px", right: "12px", width: "40px", height: "40px", border: 0, borderRadius: "50%", background: "#F1F5F9", color: "#101B2D", fontSize: "26px", lineHeight: 1, cursor: "pointer" }}>
                            ×
                        </button>
                        <div ref={mapaRef} role="application" aria-label="Mapa para selecionar o local da ocorrência" style={{ width: "100%", height: "calc(100% - 38px)", borderRadius: "8px", overflow: "hidden" }} />
                    </section>
                </div>
            )}
        </div>
    );
}
