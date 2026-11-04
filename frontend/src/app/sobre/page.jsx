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
                   <svg xmlns="http://w3.org" width="24" height="24" fill="currentColor" className="bi bi-buildings" viewBox="0 0 16 16" style={{ minWidth: '24px' }}>
      <path d="M14.763.075A.5.5 0 0 1 15 .5v15a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V14h-1v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V10a.5.5 0 0 1 .342-.474L6 7.64V1.1a.5.5 0 0 1 .276-.447l8-4a.5.5 0 0 1 .487.022M6 8.694 1.458 10.21A.5.5 0 0 0 1 10.69V15h8V8.694zM7.5 1.772 14 5.022V15h-2v-1.5a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 0-.5.5V15H8V1.772z"/>
      <path d="M11 11h1v1h-1zm0-2h1v1h-1zm-2 2h1v1H9zm0-2h1v1H9zm2-2h1v1h-1zm-2 0h1v1H9zm-2 2h1v1H7zm0-2h1v1H7zm-2 2h1v1H5zm0-2h1v1H5zM3 11h1v1H3zm0-2h1v1H3zm2-2h1v1H5zm-2 0h1v1H3z"/>
    </svg>
                <div>
                  <h2>3 Cidades</h2>
                  <p>do ABC mapeadas</p>
                </div>
              </div>

              <div className="stat-box">
              <svg xmlns="http://w3.org" width="24" height="24" fill="currentColor" className="bi bi-clipboard-check" viewBox="0 0 16 16" style={{ minWidth: '24px' }}>
  <path fillRule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0"/>
  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
</svg>                <div>
                  <h2>Dados Oficiais</h2>
                  <p>100% integrados</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-img">
            <img src="imagens/sobre/Visão_Panorâmica_de_São_Bernardo_do_Campo.jpg" alt="Visão aérea de uma cidade iluminada" />
          </div>
        </section>

        <section className="historia">
          <div className="historia-img">
            <img src="imagens\sobre\1793815109003.jpg" alt="Dashboard com dados e estatísticas" />
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