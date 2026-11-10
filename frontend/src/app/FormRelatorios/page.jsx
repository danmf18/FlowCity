"use client";
import "@/app/FormRelatorios/FormRelatorios.css";
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@/app/globals.css';

export default function FormRelatorios() {


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

                    <form action="">
                            <div className="camp1">
                                <label htmlFor="categoria">Categoria</label>

                                <select name="categoria" id="categoria" required>
                                    <option value="">Selecione uma categoria</option>
                                    <option value="Apreensão de Entorpecentes">Apreensão de Entorpecentes</option>
                                    <option value="Estupro">Estupro</option>
                                    <option value="Estupro de Vulnerável">Estupro de Vulnerável</option>
                                    <option value="Extorsão Mediante Sequestro">Extorsão Mediante Sequestro</option>
                                    <option value="Furto - Outros">Furto - Outros</option>
                                    <option value="Furto de Carga">Furto de Carga</option>
                                    <option value="Furto de Veículo">Furto de Veículo</option>
                                    <option value="Homicídio Culposo Outros">Homicídio Culposo Outros</option>
                                    <option value="Homicídio Culposo por Acidente de Trânsito">Homicídio Culposo por Acidente de Trânsito</option>
                                    <option value="Homicídio Doloso">Homicídio Doloso</option>
                                    <option value="Homicídio Doloso por Acidente de Trânsito">Homicídio Doloso por Acidente de Trânsito</option>
                                    <option value="Latrocínio">Latrocínio</option>
                                    <option value="Lesão Corporal Culposa - Outras">Lesão Corporal Culposa - Outras</option>
                                    <option value="Lesão Corporal Culposa por Acidente de Trânsito">Lesão Corporal Culposa por Acidente de Trânsito</option>
                                    <option value="Lesão Corporal Dolosa">Lesão Corporal Dolosa</option>
                                    <option value="Lesão Corporal Seguida de Morte">Lesão Corporal Seguida de Morte</option>
                                    <option value="Porte de Arma">Porte de Arma</option>
                                    <option value="Porte de Entorpecentes">Porte de Entorpecentes</option>
                                    <option value="Roubo - Outros">Roubo - Outros</option>
                                    <option value="Roubo de Carga">Roubo de Carga</option>
                                    <option value="Roubo de Veículo">Roubo de Veículo</option>
                                    <option value="Tentativa de Homicídio">Tentativa de Homicídio</option>
                                    <option value="Tráfico de Entorpecentes">Tráfico de Entorpecentes</option>
                                </select>
                            </div>

                            <div className="campo2">
                                <div className="sub-campo2">
                                    <p>Endereço ou referência</p>
                                    <input type="text" placeholder="Ex: Próximo ao senai armando de arruda, avenida..." />
                                </div>
                                <div className="sub2-campo2">
                                    <button> Abrir Mapa</button>
                                </div>
                                <div className="sub3-campo2">
                                    <p>Confirmo que as informações fornecidas são verdadeiras, <span>conforme meu conhecimento.</span></p>
                                    <input type="checkbox" name="" id="" />
                                </div>
                                <div className="sub4-campo2">
                                    <i class="bi bi-send-fill"></i>
                                    <a href="#">Enviar relato</a>
                                </div>
                            </div>

                    </form>
                </div>
            </section>
        </>
    );
}