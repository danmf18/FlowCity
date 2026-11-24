'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import './dashboard.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
const DATA_INICIO_PADRAO = '2022-01-01';

const CORES_CRIMES = ['#101B2D', '#2457C5', '#4B7BE5', '#7BA2F0', '#94A3B8'];

function formatarNumero(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '—';
  return Number(num).toLocaleString('pt-BR');
}

function formatarTaxa(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '—';
  return Number(num).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function calcularTetoY(maxValor) {
  if (!maxValor || maxValor <= 3) return 3;
  const alvo = maxValor / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(alvo)));
  const frac = alvo / magnitude;
  let passo = 10;
  if (frac <= 1) passo = 1;
  else if (frac <= 2) passo = 2;
  else if (frac <= 2.5) passo = 2.5;
  else if (frac <= 5) passo = 5;
  return passo * magnitude * 3;
}

function gerarPathSuave(pontos) {
  if (pontos.length === 0) return '';
  if (pontos.length === 1) return `M ${pontos[0].x} ${pontos[0].y}`;
  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i];
    const p1 = pontos[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function DashboardPage() {
  const [opcoes, setOpcoes] = useState({
    municipios: [],
    bairros: [],
    crimes: [],
    intervaloDatas: { data_min: '', data_max: '' }
  });

  const [filtros, setFiltros] = useState({
    municipio: '',
    bairro: '',
    crime: '',
    dataInicio: DATA_INICIO_PADRAO,
    dataFim: ''
  });

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoTempo, setModoTempo] = useState('anual');
  const [crimeAtivo, setCrimeAtivo] = useState(null);
  const [pontoAtivo, setPontoAtivo] = useState(null);

  useEffect(() => {
    async function carregarOpcoes() {
      try {
        const query = filtros.municipio
          ? `?municipio=${encodeURIComponent(filtros.municipio)}`
          : '';
        const res = await fetch(`${API_URL}/dashboard/filtros${query}`);
        if (!res.ok) throw new Error('Falha ao carregar filtros');
        const json = await res.json();
        setOpcoes(json);
      } catch (err) {
        console.error(err);
      }
    }
    carregarOpcoes();
  }, [filtros.municipio]);

  const carregarResumo = useCallback(async (filtrosAtuais) => {
    setCarregando(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtrosAtuais.municipio) params.append('municipio', filtrosAtuais.municipio);
      if (filtrosAtuais.bairro) params.append('bairro', filtrosAtuais.bairro);
      if (filtrosAtuais.crime) params.append('crime', filtrosAtuais.crime);
      if (filtrosAtuais.dataInicio) params.append('dataInicio', filtrosAtuais.dataInicio);
      if (filtrosAtuais.dataFim) params.append('dataFim', filtrosAtuais.dataFim);

      const res = await fetch(`${API_URL}/dashboard/resumo?${params.toString()}`);
      if (!res.ok) throw new Error('Não foi possível obter os dados do servidor.');
      const json = await res.json();
      setDados(json);
    } catch (err) {
      setErro(err.message || 'Erro ao conectar com a API.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarResumo(filtros);
  }, [filtros, carregarResumo]);

  const atualizarFiltro = (campo, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
      ...(campo === 'municipio' ? { bairro: '' } : {})
    }));
  };

  const alternarFiltro = (campo, valor) => {
    setFiltros((prev) => {
      const novoValor = prev[campo] === valor ? '' : valor;
      return {
        ...prev,
        [campo]: novoValor,
        ...(campo === 'municipio' ? { bairro: '' } : {})
      };
    });
  };

  const limparFiltros = () => {
    setFiltros({
      municipio: '',
      bairro: '',
      crime: '',
      dataInicio: DATA_INICIO_PADRAO,
      dataFim: ''
    });
  };

  const temFiltroAtivo = Boolean(
    filtros.municipio ||
      filtros.bairro ||
      filtros.crime ||
      filtros.dataInicio !== DATA_INICIO_PADRAO ||
      filtros.dataFim
  );

  const maxMunicipio = dados?.porMunicipio?.[0]?.total || 1;
  const maxBairro = dados?.porBairro?.[0]?.total || 1;

  const top5Crimes = useMemo(() => {
    const lista = (dados?.porCrime || []).slice(0, 5);
    const soma = lista.reduce((acc, item) => acc + Number(item.total || 0), 0) || 1;
    const raio = 62;
    const circunferencia = 2 * Math.PI * raio;
    let acumulado = 0;

    return lista.map((item, idx) => {
      const valor = Number(item.total || 0);
      const percentual = (valor / soma) * 100;
      const comprimento = (valor / soma) * circunferencia;
      const gap = lista.length > 1 ? 2.5 : 0;
      const segmento = {
        ...item,
        total: valor,
        cor: CORES_CRIMES[idx % CORES_CRIMES.length],
        percentual,
        dashArray: `${Math.max(comprimento - gap, 0)} ${circunferencia}`,
        dashOffset: -acumulado
      };
      acumulado += comprimento;
      return segmento;
    });
  }, [dados?.porCrime]);

  const serieTemporal = useMemo(() => {
    const bruto = dados?.porData || [];
    if (bruto.length === 0) return [];

    if (modoTempo === 'mensal') {
      return bruto.map((item) => ({
        label: item.periodo,
        total: Number(item.total || 0)
      }));
    }

    const mapaAnos = new Map();
    for (const item of bruto) {
      const ano = String(item.periodo).slice(0, 4);
      mapaAnos.set(ano, (mapaAnos.get(ano) || 0) + Number(item.total || 0));
    }

    return Array.from(mapaAnos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, total]) => ({ label: ano, total }));
  }, [dados?.porData, modoTempo]);

  const graficoLinha = useMemo(() => {
    const largura = 460;
    const altura = 195;
    const padEsq = 56;
    const padDir = 18;
    const padTopo = 18;
    const padBase = 32;
    const plotW = largura - padEsq - padDir;
    const plotH = altura - padTopo - padBase;

    const maxReal = serieTemporal.reduce((m, item) => Math.max(m, item.total), 0);
    const tetoY = calcularTetoY(maxReal);
    const ticksY = [0, tetoY / 3, (tetoY * 2) / 3, tetoY].map((valor) => ({
      valor,
      y: padTopo + plotH - (valor / tetoY) * plotH
    }));

    const pontos = serieTemporal.map((item, idx) => {
      const x =
        serieTemporal.length === 1
          ? padEsq + plotW / 2
          : padEsq + (idx / (serieTemporal.length - 1)) * plotW;
      const y = padTopo + plotH - (item.total / tetoY) * plotH;
      return { ...item, x, y };
    });

    const pathLinha = gerarPathSuave(pontos);
    const pathArea =
      pontos.length > 1
        ? `${pathLinha} L ${pontos[pontos.length - 1].x} ${padTopo + plotH} L ${pontos[0].x} ${padTopo + plotH} Z`
        : '';

    const passoLabel =
      pontos.length <= 6 ? 1 : Math.ceil((pontos.length - 1) / 5);

    const labelsX = pontos.filter(
      (_, idx) => idx % passoLabel === 0 || idx === pontos.length - 1
    );

    return {
      largura,
      altura,
      padEsq,
      padDir,
      padTopo,
      padBase,
      ticksY,
      pontos,
      pathLinha,
      pathArea,
      labelsX
    };
  }, [serieTemporal]);

  const anoMin = filtros.dataInicio
    ? filtros.dataInicio.slice(0, 4)
    : opcoes.intervaloDatas?.data_min
      ? opcoes.intervaloDatas.data_min.slice(0, 4)
      : '2022';
  const anoMax = filtros.dataFim
    ? filtros.dataFim.slice(0, 4)
    : opcoes.intervaloDatas?.data_max
      ? opcoes.intervaloDatas.data_max.slice(0, 4)
      : '2026';

  return (
    <div className="home-alertabc dash-wrapper">
      <main className="dash-main">
        <header className="dash-page-header">
          <div>
            <h1>DASHBOARD</h1>
            <p>
              Painel analítico integrado de ocorrências oficiais e dados populacionais do IBGE
            </p>
          </div>

          <button
            type="button"
            className="btn-limpar"
            onClick={limparFiltros}
            disabled={!temFiltroAtivo}
          >
            Limpar filtros
          </button>
        </header>

        <section className="filtros-card">
          <div className="filtro-item">
            <label htmlFor="f-municipio">Município</label>
            <select
              id="f-municipio"
              value={filtros.municipio}
              onChange={(e) => atualizarFiltro('municipio', e.target.value)}
            >
              <option value="">Todos (cidades do ABC)</option>
              {opcoes.municipios.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="filtro-item">
            <label htmlFor="f-bairro">Bairro</label>
            <select
              id="f-bairro"
              value={filtros.bairro}
              onChange={(e) => atualizarFiltro('bairro', e.target.value)}
            >
              <option value="">Todos os bairros</option>
              {opcoes.bairros.map((b) => (
                <option key={b} value={b} className="capitalize">
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="filtro-item">
            <label htmlFor="f-crime">Crime</label>
            <select
              id="f-crime"
              value={filtros.crime}
              onChange={(e) => atualizarFiltro('crime', e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {opcoes.crimes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="filtro-item filtro-periodo">
            <label htmlFor="f-inicio">
              Período ({anoMin} – {anoMax})
            </label>
            <div className="periodo-inputs">
              <input
                id="f-inicio"
                type="date"
                aria-label="Data inicial"
                value={filtros.dataInicio}
                min={opcoes.intervaloDatas?.data_min || undefined}
                max={opcoes.intervaloDatas?.data_max || undefined}
                onChange={(e) => atualizarFiltro('dataInicio', e.target.value)}
              />
              <span className="periodo-sep">até</span>
              <input
                id="f-fim"
                type="date"
                aria-label="Data final"
                value={filtros.dataFim}
                min={opcoes.intervaloDatas?.data_min || undefined}
                max={opcoes.intervaloDatas?.data_max || undefined}
                onChange={(e) => atualizarFiltro('dataFim', e.target.value)}
              />
            </div>
          </div>
        </section>

        {erro && <div className="dash-alerta erro">{erro}</div>}

        {carregando && !dados ? (
          <div className="dash-alerta">
            Carregando indicadores do banco de dados...
          </div>
        ) : dados ? (
          <>
            <section className={`kpi-grid ${carregando ? 'atualizando' : ''}`}>
              <article className="kpi-card">
                <div className="kpi-head">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" strokeLinecap="round" />
                  </svg>
                  <span>Total de Ocorrências</span>
                </div>
                <strong>{formatarNumero(dados.kpis.totalOcorrencias)}</strong>
              </article>

              <article className="kpi-card">
                <div className="kpi-head">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 21s-6-5.686-6-11a6 6 0 1 1 12 0c0 5.314-6 11-6 11z" />
                    <circle cx="12" cy="10" r="2.2" />
                  </svg>
                  <span>Municípios</span>
                </div>
                <strong>{formatarNumero(dados.kpis.totalMunicipios)}</strong>
              </article>

              <article className="kpi-card">
                <div className="kpi-head">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Bairros Mapeados</span>
                </div>
                <strong>{formatarNumero(dados.kpis.totalBairros)}</strong>
              </article>

              <article className="kpi-card">
                <div className="kpi-head">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>
                    {dados.kpis.escopoPopulacao === 'bairro'
                      ? 'População do Bairro'
                      : 'População Estimada'}
                  </span>
                </div>
                <strong>{formatarNumero(dados.kpis.populacaoReferencia)}</strong>
              </article>

              <article className="kpi-card">
                <div className="kpi-head">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3v18h18" strokeLinecap="round" />
                    <path d="m7 15 4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Taxa Geral / 100k hab.</span>
                </div>
                <strong>{formatarTaxa(dados.kpis.taxaGeral100k)}</strong>
              </article>
            </section>

            <section className={`dash-content-grid ${carregando ? 'atualizando' : ''}`}>
              <article className="dash-card card-municipios">
                <div className="card-header">
                  <div>
                    <h2>Volume e taxa / 100k hab. por Município</h2>
                    <p>ABC Paulista — clique em uma cidade para filtrar</p>
                  </div>
                </div>

                {dados.porMunicipio.length === 0 ? (
                  <p className="vazio">Nenhum registro encontrado.</p>
                ) : (
                  <ul className="municipios-lista">
                    {dados.porMunicipio.map((item) => {
                      const larguraBarra = Math.max(
                        (Number(item.total) / maxMunicipio) * 100,
                        3
                      );
                      const selecionado = filtros.municipio === item.nome_municipio;
                      return (
                        <li
                          key={item.nome_municipio}
                          className={`municipio-linha ${selecionado ? 'ativo' : ''}`}
                          onClick={() => alternarFiltro('municipio', item.nome_municipio)}
                          title={`Filtrar por ${item.nome_municipio}`}
                        >
                          <span className="municipio-nome capitalize">
                            {item.nome_municipio}
                          </span>
                          <div className="municipio-barra-wrap">
                            <div
                              className="municipio-barra-fill"
                              style={{ width: `${larguraBarra}%` }}
                            />
                            <span className="municipio-valor">
                              <strong>{formatarNumero(item.total)}</strong>
                              {item.taxa_100k !== null && item.taxa_100k !== undefined && (
                                <span className="municipio-taxa">
                                  {' '}
                                  ({formatarTaxa(item.taxa_100k)}/100k)
                                </span>
                              )}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>

              <div className="dash-right-col">
                <article className="dash-card card-crimes">
                  <div className="card-header">
                    <div>
                      <h2>Top 5 Crimes Mais Comuns</h2>
                      <p>Distribuição entre as 5 principais naturezas</p>
                    </div>
                  </div>

                  {top5Crimes.length === 0 ? (
                    <p className="vazio">Nenhum tipo de crime encontrado.</p>
                  ) : (
                    <div className="crimes-body">
                      <div className="donut-wrap">
                        <svg viewBox="0 0 180 180" className="donut-svg">
                          <g transform="rotate(-90 90 90)">
                            {top5Crimes.map((item, idx) => (
                              <circle
                                key={item.tipo_crime}
                                cx="90"
                                cy="90"
                                r="62"
                                fill="transparent"
                                stroke={item.cor}
                                strokeWidth={crimeAtivo === idx ? 32 : 28}
                                strokeDasharray={item.dashArray}
                                strokeDashoffset={item.dashOffset}
                                className="donut-slice"
                                onMouseEnter={() => setCrimeAtivo(idx)}
                                onMouseLeave={() => setCrimeAtivo(null)}
                                onClick={() => alternarFiltro('crime', item.tipo_crime)}
                              />
                            ))}
                          </g>
                        </svg>
                        <div className="donut-centro">
                          {crimeAtivo !== null && top5Crimes[crimeAtivo] ? (
                            <>
                              <strong>
                                {top5Crimes[crimeAtivo].percentual.toFixed(1)}%
                              </strong>
                              <span>{formatarNumero(top5Crimes[crimeAtivo].total)}</span>
                            </>
                          ) : (
                            <>
                              <strong>Top 5</strong>
                              <span>crimes</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="crimes-legenda-col">
                        <div className="crimes-barra-empilhada">
                          {top5Crimes.map((item, idx) => (
                            <div
                              key={item.tipo_crime}
                              className="crimes-barra-seg"
                              style={{
                                width: `${item.percentual}%`,
                                backgroundColor: item.cor
                              }}
                              title={`${item.tipo_crime}: ${formatarNumero(item.total)}`}
                              onMouseEnter={() => setCrimeAtivo(idx)}
                              onMouseLeave={() => setCrimeAtivo(null)}
                              onClick={() => alternarFiltro('crime', item.tipo_crime)}
                            />
                          ))}
                        </div>

                        <ul className="crimes-legenda">
                          {top5Crimes.map((item, idx) => {
                            const selecionado = filtros.crime === item.tipo_crime;
                            return (
                              <li
                                key={item.tipo_crime}
                                className={`crime-item ${selecionado ? 'ativo' : ''} ${crimeAtivo === idx ? 'hover' : ''}`}
                                onMouseEnter={() => setCrimeAtivo(idx)}
                                onMouseLeave={() => setCrimeAtivo(null)}
                                onClick={() => alternarFiltro('crime', item.tipo_crime)}
                              >
                                <span
                                  className="crime-dot"
                                  style={{ backgroundColor: item.cor }}
                                />
                                <span className="crime-nome" title={item.tipo_crime}>
                                  {item.tipo_crime}
                                </span>
                                <strong className="crime-qtd">
                                  {formatarNumero(item.total)}
                                </strong>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}
                </article>

                <article className="dash-card card-evolucao">
                  <div className="card-header">
                    <div>
                      <h2>Evolução Temporal</h2>
                      <p>
                        {pontoAtivo
                          ? `${pontoAtivo.label}: ${formatarNumero(pontoAtivo.total)} ocorrências`
                          : `${serieTemporal.length} ${modoTempo === 'anual' ? 'anos' : 'meses'} no recorte`}
                      </p>
                    </div>

                    <div className="toggle-grupo">
                      <button
                        type="button"
                        className={modoTempo === 'anual' ? 'ativo' : ''}
                        onClick={() => {
                          setModoTempo('anual');
                          setPontoAtivo(null);
                        }}
                      >
                        Anual
                      </button>
                      <button
                        type="button"
                        className={modoTempo === 'mensal' ? 'ativo' : ''}
                        onClick={() => {
                          setModoTempo('mensal');
                          setPontoAtivo(null);
                        }}
                      >
                        Mensal
                      </button>
                    </div>
                  </div>

                  {serieTemporal.length === 0 ? (
                    <p className="vazio">Sem registros com data válida.</p>
                  ) : (
                    <div className="linha-chart-wrap">
                      <svg
                        viewBox={`0 0 ${graficoLinha.largura} ${graficoLinha.altura}`}
                        className="linha-svg"
                      >
                        <defs>
                          <linearGradient id="areaGradiente" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2457C5" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="#2457C5" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {graficoLinha.ticksY.map((tick) => (
                          <g key={tick.valor}>
                            <line
                              x1={graficoLinha.padEsq}
                              y1={tick.y}
                              x2={graficoLinha.largura - graficoLinha.padDir}
                              y2={tick.y}
                              className="linha-grid"
                            />
                            <text
                              x={graficoLinha.padEsq - 10}
                              y={tick.y + 4}
                              textAnchor="end"
                              className="linha-eixo-texto"
                            >
                              {formatarNumero(Math.round(tick.valor))}
                            </text>
                          </g>
                        ))}

                        {graficoLinha.pathArea && (
                          <path d={graficoLinha.pathArea} fill="url(#areaGradiente)" />
                        )}

                        {graficoLinha.pathLinha && (
                          <path
                            d={graficoLinha.pathLinha}
                            fill="none"
                            className="linha-curva"
                          />
                        )}

                        {graficoLinha.pontos.map((ponto) => {
                          const destacado = pontoAtivo?.label === ponto.label;
                          return (
                            <g key={ponto.label}>
                              <circle
                                cx={ponto.x}
                                cy={ponto.y}
                                r={destacado ? 5.5 : modoTempo === 'anual' ? 3.5 : 2.2}
                                className={`linha-ponto ${destacado ? 'ativo' : ''}`}
                              />
                              <circle
                                cx={ponto.x}
                                cy={ponto.y}
                                r={12}
                                fill="transparent"
                                className="linha-hit"
                                onMouseEnter={() => setPontoAtivo(ponto)}
                                onMouseLeave={() => setPontoAtivo(null)}
                              >
                                <title>
                                  {`${ponto.label}: ${formatarNumero(ponto.total)} ocorrências`}
                                </title>
                              </circle>
                            </g>
                          );
                        })}

                        {graficoLinha.labelsX.map((ponto) => (
                          <text
                            key={ponto.label}
                            x={ponto.x}
                            y={graficoLinha.altura - 8}
                            textAnchor="middle"
                            className="linha-eixo-texto"
                          >
                            {ponto.label}
                          </text>
                        ))}
                      </svg>
                    </div>
                  )}
                </article>
              </div>
            </section>

            <section className={`dash-bottom-section ${carregando ? 'atualizando' : ''}`}>
              <article className="dash-card">
                <div className="card-header">
                  <div>
                    <h2>Top 10 Bairros com Maior Concentração</h2>
                    <p>Volume, população do IBGE e taxa / 100k hab. — clique para filtrar</p>
                  </div>
                </div>

                {dados.porBairro.length === 0 ? (
                  <p className="vazio">Nenhum bairro encontrado para este filtro.</p>
                ) : (
                  <ul className="bairros-grid">
                    {dados.porBairro.map((item, idx) => {
                      const selecionado = filtros.bairro === item.bairro;
                      const largura = Math.max((Number(item.total) / maxBairro) * 100, 4);
                      return (
                        <li
                          key={`${item.nome_municipio}-${item.bairro}-${idx}`}
                          className={`bairro-item ${selecionado ? 'ativo' : ''}`}
                          onClick={() => alternarFiltro('bairro', item.bairro)}
                        >
                          <div className="bairro-topo">
                            <span className="capitalize bairro-nome">
                              {item.bairro}
                              <em className="bairro-cidade"> ({item.nome_municipio})</em>
                            </span>
                            <span className="bairro-numeros">
                              <strong>{formatarNumero(item.total)}</strong>
                              {item.taxa_100k !== null && item.taxa_100k !== undefined && (
                                <span className="bairro-taxa">
                                  {' '}
                                  ({formatarTaxa(item.taxa_100k)}/100k)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="bairro-trilha">
                            <div
                              className="bairro-fill"
                              style={{ width: `${largura}%` }}
                            />
                          </div>
                          <div className="bairro-meta">
                            {item.populacao_bairro
                              ? `População IBGE: ${formatarNumero(item.populacao_bairro)} hab.`
                              : 'População por bairro não mapeada no IBGE'}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}