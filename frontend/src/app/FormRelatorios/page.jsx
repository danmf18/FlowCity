"use client";
import "@/app/FormRelatorios/FormRelatorios.css";
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@/app/globals.css';
import { useState } from "react";

export default function FormRelatorios() {

    const [aviso, setAviso] = useState({ texto: "", tipo: "" });

    async function handleSubmit(event) {
        event.preventDefault();
        setAviso({ texto: "", tipo: "" }); // Limpa avisos antigos ao clicar de novo

        // Esse event vai ter cada coisa do formulário que tem um name
        const formulario = event.target;

        // Vai montar o objeto com essas informações
        const dadosDoRelato = {
            categoria: formulario.categoria.value,
            endereco: formulario.endereco.value,
            confirmacao: formulario.confirmacao.checked,
        };

        const resposta = await fetch("http://localhost:8080/api/relatos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(dadosDoRelato),
        });

        const dadosDaResposta = await resposta.json();

        // Aqui tem que ser true para passar, então se o resultado vier com um erro o ! vai mudar para true e vai dar a mensagem de aviso
        if (!resposta.ok) {
            // 3. Manda o React redesenhar a tela com a mensagem e classe de erro
            setAviso({ texto: dadosDaResposta.erro, tipo: "erro" });
            return;
        }

        // 4. Limpa o form e manda o React redesenhar com a mensagem de sucesso
        formulario.reset();
        setAviso({ texto: "Relato enviado com sucesso!", tipo: "sucesso" });
    }




    return(
        <>
            <section className="fundoForm">
                {/* Parte direita do texto onde tem os textos e etc */}
                <div className="text">

                    {/* Texto da parte esquerda falando sobre o espaço */}
                    <div className="text-apresentacao">
                        <p className="text-principal">FAÇA UM RELATO</p>
                        <h1>Ajude a tornar <span>sua cidade mais segura.</span></h1>
                        <p>Compartilhe informações sobre ocorrências na sua região <span>de forma rápida e simples.</span></p>
                    </div>
                   
                    <div className="container-icons">

                        
                        <div className="icons">
                            <i className="bi bi-shield-check"></i>
                            <div className="div-icons-text">
                                <p><b>Sua contribuição importa</b></p>
                                <p>Ajude a comunidade e as autoridades <span>a agirem mais rapido.</span></p>
                            </div>
                        </div>

                        <div className="icons">
                            <i className="bi bi-geo-alt-fill"></i>
                            <div className="div-icons-text">
                                <p><b>Informe com detalhes</b></p>
                                <p>Adicione informações precisas para<span>um relato mais útil.</span></p>
                            </div>
                        </div>

                        <div className="icons">
                            <i className="bi bi-lock"></i>
                            <div className="div-icons-text">
                                <p><b>Seus dados são seguros</b></p>
                                <p>Mantemos sua privacidade e proteção<span>em primeiro lugar.</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="aviso-esquerda">
                        <i className="bi bi-exclamation-circle"></i>
                        <p>Em caso de emergência, entre em contato <span>com as autoridades locais.</span></p>
                    </div>
                </div>
                {/* Parte esquerda do site onde vai ter onde o cliente vai colocar os dados dele */}
                <div className="formes">
                    <div className="text-form">
                        <h1>Novo Relato</h1>
                        <p>Preencha as informações abaixo para compartilhar o ocorrido.</p>
                    </div>
                    <strong></strong>

                    {/* Formulario */}

                    <form onSubmit={handleSubmit}>
                            <div className="camp1">
                                <label htmlFor="categoria">Categoria</label>

                                <select name="categoria" id="categoria" required>
                                    <option value="">Selecione uma categoria</option>
                                    <option value="Apreensão_de_Entorpecentes">Apreensão de Entorpecentes</option>
                                    <option value="Estupro">Estupro</option>
                                    <option value="Estupro_Mediante_Sequestro">Estupro Mediante Sequestro</option>
                                    <option value="Furto_Outros">Furto - Outros</option>
                                    <option value="Furto_de_Carga">Furto de Carga</option>
                                    <option value="Furto_de_Veículo">Furto de Veículo</option>
                                    <option value="Homicídio_Culposo_Outros">Homicídio Culposo Outros</option>
                                    <option value="Homicídio_Culposo_por_Acidente_de_Trânsito">Homicídio Culposo por Acidente de Trânsito</option>
                                    <option value="Homicídio_Doloso">Homicídio Doloso</option>
                                    <option value="Homicídio_Doloso_por_Acidente_de_Trânsito">Homicídio Doloso por Acidente de Trânsito</option>
                                    <option value="Latrocínio">Latrocínio</option>
                                    <option value="Lesão_Corporal_Culposa_Outras">Lesão Corporal Culposa - Outras</option>
                                    <option value="Lesão_Corporal_Culposa_por_Acidente_de_Trânsito">Lesão Corporal Culposa por Acidente de Trânsito</option>
                                    <option value="Lesão_Corporal_Dolosa">Lesão Corporal Dolosa</option>
                                    <option value="Lesão_Corporal_Seguida_de_Morte">Lesão Corporal Seguida de Morte</option>
                                    <option value="Porte_de_Arma">Porte de Arma</option>
                                    <option value="Porte_de_Entorpecentes">Porte de Entorpecentes</option>
                                    <option value="Roubo_Outros">Roubo - Outros</option>
                                    <option value="Roubo_de_Carga">Roubo de Carga</option>
                                    <option value="Roubo_de_Veículo">Roubo de Veículo</option>
                                    <option value="Tentativa_de_Homicídio">Tentativa de Homicídio</option>
                                    <option value="Tráfico_de_Entorpecentes">Tráfico de Entorpecentes</option>
                                </select>
                            </div>

                            <div className="campo2">
                                <div className="sub-campo2">
                                    <p>Endereço ou referência</p>
                                    <input type="text" name="endereco" placeholder="Ex: Próximo ao senai armando de arruda, avenida..." />
                                </div>
                                <div className="sub2-campo2">
                                    <button> Abrir Mapa</button>
                                </div>
                                <div className="sub3-campo2">
                                    <p>Confirmo que as informações fornecidas são verdadeiras, <span>conforme meu conhecimento.</span></p>
                                    <input type="checkbox" name="confirmacao" id="" />
                                </div>

                                {aviso.texto && <p className={`aviso-form ${aviso.tipo}`}>{aviso.texto}</p>}

                                <div className="sub4-campo2">
                                    <i class="bi bi-send-fill"></i>
                                    <button type="submit">Enviar relato</button>
                                </div>
                            </div>

                    </form>
                </div>
            </section>
        </>
    );
}