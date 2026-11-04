
'use client';

import { useState } from 'react';
import Header from '../components/Header';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e) {
    e.preventDefault();

    setMensagem('');
    setErro(false);

    if (!email.trim()) {
      setErro(true);
      setMensagem('Informe seu endereço de e-mail.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/auth/recuperar-senha`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Não foi possível processar a solicitação.'
        );
      }

      setEnviado(true);

      setMensagem(
        data.message ||
        'Se esse e-mail estiver cadastrado, você receberá instruções para recuperar sua senha.'
      );

    } catch (error) {
      setErro(true);

      setMensagem(
        error.message === 'Failed to fetch'
          ? 'Não foi possível conectar ao servidor. Tente novamente mais tarde.'
          : error.message
      );

    } finally {
      setLoading(false);
    }
  }

  function voltar() {
    setEmail('');
    setMensagem('');
    setErro(false);
    setEnviado(false);
  }

  return (
    <>
      <Header />

      <main className="recovery-page container-fluid d-flex align-items-center justify-content-center py-5">

        <section className="recovery-card card border-0 shadow-sm p-4 p-md-5">

          <div className="recovery-icon mx-auto mb-4 d-flex align-items-center justify-content-center">
            {enviado ? '✓' : '✉'}
          </div>

          {!enviado ? (
            <>
              <h1 className="text-center fw-bold mb-3">
                Esqueceu sua senha?
              </h1>

              <p className="recovery-description text-center mb-4">
                Não se preocupe! Informe o e-mail associado
                à sua conta e enviaremos instruções para
                recuperar seu acesso ao AlertABC.
              </p>

              <form onSubmit={enviar}>

                <div className="mb-3">
                  <label
                    htmlFor="email"
                    className="form-label fw-semibold"
                  >
                    Endereço de e-mail
                  </label>

                  <input
                    id="email"
                    type="email"
                    className="form-control recovery-input"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {mensagem && (
                  <div className="alert alert-danger py-2" role="alert">
                    {mensagem}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn recovery-button w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      />
                      Enviando solicitação...
                    </>
                  ) : (
                    'Recuperar senha'
                  )}
                </button>

              </form>

              <div className="text-center mt-4">
                <a href="/login" className="recovery-back">
                  ← Voltar para o login
                </a>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-center fw-bold mb-3">
                Verifique seu e-mail
              </h1>

              <p className="recovery-description text-center mb-4">
                {mensagem}
              </p>

              <div className="recovery-email mb-4 text-center">
                {email}
              </div>

              <a
                href="/login"
                className="btn recovery-button w-100"
              >
                Voltar para o login
              </a>

              <button
                type="button"
                className="btn recovery-resend w-100 mt-3"
                onClick={voltar}
              >
                Utilizar outro e-mail
              </button>
            </>
          )}

          <div className="recovery-footer text-center mt-4 pt-3">
            AlertABC — Informação e transparência.
          </div>

        </section>
      </main>
    </>
  );
}
