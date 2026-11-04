import React from 'react';
import '@/app/sobre/sobre.css';

export default function SobreNos() {
  return (
    <>
      <div className="container">
        
        <section className="hero">
          <div className="hero-text">
            <span>Sobre o Projeto</span>
            <h1>Tecnologia e informação a favor da sua tranquilidade</h1>
            <p>
              O AlertABC nasceu com um propósito claro: transformar dados complexos de segurança 
              em informações simples, úteis e acessíveis para o seu dia a dia. Inspirados na facilidade 
              dos aplicativos de navegação, criamos um mapa interativo e em tempo real focado em 
              Santo André, São Bernardo do Campo e São Caetano do Sul. 
              Cruzamos os registros oficiais de ocorrências com informações demográficas do IBGE 
              para mostrar não apenas onde os eventos acontecem, mas qual o risco real de cada região. 
              Nosso objetivo é colocar o poder da informação confiável nas suas mãos.
            </p>

            <div className="stats">
              <div className="stat-box">
                <i className="bi bi-geo-alt"></i>
                <div>
                  <h2>3 Cidades</h2>
                  <p>do ABC mapeadas</p>
                </div>
              </div>

              <div className="stat-box">
                <i className="bi bi-clipboard-data"></i>
                <div>
                  <h2>Dados Oficiais</h2>
                  <p>100% integrados</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-img">
            <img src="" alt="Visão aérea noturna de uma cidade iluminada" />
          </div>
        </section>

        <section className="historia">
          <div className="historia-img">
            <img src="" alt="Dashboard com dados e estatísticas" />
          </div>

          <div className="historia-text">
            <span>Como Funciona</span>
            <h2>Inteligência e precisão por trás de cada alerta no mapa</h2>
            <p>
              Lidar com informações de segurança pública exige muita responsabilidade. 
              Por trás do nosso mapa simples e fácil de usar, existe um sistema inteligente 
              que trabalha silenciosamente para organizar, corrigir e cruzar milhares de registros oficiais. 
              Nossa tecnologia identifica e ajusta automaticamente inconsistências de endereços, 
              garantindo que cada alerta no mapa corresponda exatamente ao local correto onde 
              o evento ocorreu. O resultado é uma plataforma rápida, fluida e altamente confiável, 
              que atualiza as áreas de risco de forma inteligente conforme você navega pela sua cidade.
            </p>
          </div>
        </section>

        <section className="valores">
          <span>Nossos Pilares</span>
          <h2>A base sólida que garante a sua confiança</h2>

          <div className="cards">
            <div className="card">
              <i className="bi bi-shield-check"></i>
              <h3>Informação Confiável</h3>
              <p>Processamos e refinamos milhares de registros oficiais para entregar um mapa limpo e sem duplicações.</p>
            </div>

            <div className="card">
              <i className="bi bi-geo"></i>
              <h3>Precisão Geográfica</h3>
              <p>Cada alerta é posicionado no local exato, garantindo que você tenha um retrato fiel do que acontece ao seu redor.</p>
            </div>

            <div className="card">
              <i className="bi bi-graph-up"></i>
              <h3>Análise Inteligente</h3>
              <p>Cruzamos o volume de casos com o número de moradores de cada bairro para calcular o índice de risco real.</p>
            </div>

            <div className="cards-solitario">
                <div className="card">
                <i className="bi bi-cpu"></i>
                <h3>Plataforma Segura</h3>
                <p>Um sistema rápido, estável e construído com as melhores práticas de tecnologia para nunca te deixar na mão.</p>
                </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}