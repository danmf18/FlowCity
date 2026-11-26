import bcrypt from "bcrypt";
import { pool } from "../config/database.js";

export async function obterDashboard(request, response, next) {
  try {
    const [[relatos], [contas], [situacoes], [registrosOficiais], [recentes]] =
      await Promise.all([
        pool.execute(`
                SELECT COUNT(*) AS total
                FROM relatos
            `),

        pool.execute(`
                SELECT COUNT(*) AS total
                FROM contas
            `),

        pool.execute(`
                SELECT
                    COALESCE(SUM(situacao = 'Pendente'), 0) AS pendentes,
                    COALESCE(SUM(situacao = 'Aprovado'), 0) AS aprovados,
                    COALESCE(SUM(situacao = 'Rejeitado'), 0) AS rejeitados
                FROM relatos
            `),

        pool.execute(`
                SELECT COUNT(*) AS total
                FROM registro_oficial
            `),

        pool.execute(`
                SELECT
                    r.id_relato,
                    r.descricao,
                    r.situacao,
                    r.enviado_em,
                    c.nome AS categoria,
                    m.nome AS municipio,
                    COALESCE(
                        NULLIF(r.referencia_local, ''),
                        m.nome
                    ) AS localizacao
                FROM relatos r
                INNER JOIN categorias c
                    ON c.id_categoria = r.fk_id_categoria
                INNER JOIN municipios m
                    ON m.id_municipio = r.fk_id_municipio
                ORDER BY r.enviado_em DESC
                LIMIT 5
            `),
      ]);

    return response.status(200).json({
      indicadores: {
        totalRelatos: Number(relatos[0].total),
        totalContas: Number(contas[0].total),
        pendentes: Number(situacoes[0].pendentes),
        aprovados: Number(situacoes[0].aprovados),
        rejeitados: Number(situacoes[0].rejeitados),
        totalRegistrosOficiais: Number(registrosOficiais[0].total),
      },

      distribuicao: {
        pendentes: Number(situacoes[0].pendentes),
        aprovados: Number(situacoes[0].aprovados),
        rejeitados: Number(situacoes[0].rejeitados),
      },

      recentes,
    });
  } catch (error) {
    next(error);
  }
}


export async function listarUsuarios(request, response, next) {
    try {
        const busca = String(request.query.busca || "").trim();
        const perfil = String(request.query.perfil || "").trim();

        const pagina = Math.max(
            1,
            Number.parseInt(request.query.pagina, 10) || 1
        );

        const limite = Math.min(
            50,
            Math.max(1, Number.parseInt(request.query.limite, 10) || 10)
        );

        const offset = (pagina - 1) * limite;

        const perfisPermitidos = [
            "cidadao",
            "admin_municipal",
            "admin_geral"
        ];

        if (perfil && !perfisPermitidos.includes(perfil)) {
            return response.status(400).json({
                mensagem: "Perfil informado inválido."
            });
        }

        const condicoes = [];
        const parametros = [];

        if (busca) {
            condicoes.push("(c.nome LIKE ? OR c.email LIKE ?)");
            parametros.push(`%${busca}%`, `%${busca}%`);
        }

        if (perfil) {
            condicoes.push("c.perfil = ?");
            parametros.push(perfil);
        }

        const where = condicoes.length
            ? `WHERE ${condicoes.join(" AND ")}`
            : "";

        const [resultadoTotal] = await pool.execute(
            `
                SELECT COUNT(*) AS total
                FROM contas c
                ${where}
            `,
            parametros
        );

        const total = Number(resultadoTotal[0].total);

        const [usuarios] = await pool.execute(
            `
                SELECT
                    c.id_conta,
                    c.nome,
                    c.email,
                    c.perfil,
                    c.fk_id_municipio,
                    m.nome AS municipio
                FROM contas c
                LEFT JOIN municipios m
                    ON m.id_municipio = c.fk_id_municipio
                ${where}
                ORDER BY c.id_conta DESC
                LIMIT ${limite} OFFSET ${offset}
            `,
            parametros
        );

        return response.status(200).json({
            usuarios,
            paginacao: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        next(error);
    }
}


export async function criarUsuario(request, response, next) {
  try {
    const { nome, email, senha, perfil, fk_id_municipio } = request.body;

    const nomeLimpo = String(nome || "").trim();
    const emailLimpo = String(email || "")
      .trim()
      .toLowerCase();
    const senhaLimpa = String(senha || "");

    const perfisPermitidos = ["cidadao", "admin_municipal", "admin_geral"];

    if (!nomeLimpo || !emailLimpo || !senhaLimpa || !perfil) {
      return response.status(400).json({
        mensagem: "Preencha todos os campos obrigatórios.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      return response.status(400).json({
        mensagem: "Informe um e-mail válido.",
      });
    }

    if (senhaLimpa.length < 8) {
      return response.status(400).json({
        mensagem: "A senha deve ter pelo menos 8 caracteres.",
      });
    }

    if (!perfisPermitidos.includes(perfil)) {
      return response.status(400).json({
        mensagem: "Perfil inválido.",
      });
    }

    let municipioId = null;

    // Cidadãos e administradores municipais precisam estar vinculados a um município.
    if (perfil === "cidadao" || perfil === "admin_municipal") {
      municipioId = Number(fk_id_municipio);

      if (!Number.isInteger(municipioId) || municipioId <= 0) {
        return response.status(400).json({
          mensagem: "Selecione um município para este usuário.",
        });
      }

      const [municipios] = await pool.execute(
        "SELECT id_municipio FROM municipios WHERE id_municipio = ?",
        [municipioId]
      );

      if (municipios.length === 0) {
        return response.status(400).json({
          mensagem: "O município selecionado não existe.",
        });
      }
    }

    const [emailExistente] = await pool.execute(
      "SELECT id_conta FROM contas WHERE email = ?",
      [emailLimpo]
    );

    if (emailExistente.length > 0) {
      return response.status(409).json({
        mensagem: "Já existe uma conta cadastrada com este e-mail.",
      });
    }

    const senhaHash = await bcrypt.hash(senhaLimpa, 12);

    const [resultado] = await pool.execute(
      `INSERT INTO contas
                (nome, email, senha_hash, perfil, fk_id_municipio)
             VALUES (?, ?, ?, ?, ?)`,
      [nomeLimpo, emailLimpo, senhaHash, perfil, municipioId]
    );

    return response.status(201).json({
      mensagem: "Conta criada com sucesso.",
      usuario: {
        id_conta: resultado.insertId,
        nome: nomeLimpo,
        email: emailLimpo,
        perfil,
        fk_id_municipio: municipioId,
      },
    });
  } catch (error) {
    next(error);
  }
}


export async function atualizarUsuario(request, response, next) {
    let conexao;

    try {
        const idUsuario = Number(request.params.id);
        const idResponsavel = Number(
            request.usuario.id_conta ?? request.usuario.id
        );

        if (!Number.isInteger(idResponsavel) || idResponsavel <= 0) {
            return response.status(401).json({
                mensagem: "Não foi possível identificar o administrador responsável."
            });
        }

        const {
            nome,
            email,
            perfil,
            fk_id_municipio,
            senha
        } = request.body;

        const nomeLimpo = String(nome || "").trim();
        const emailLimpo = String(email || "").trim().toLowerCase();
        const senhaLimpa = String(senha || "");

        const perfisPermitidos = [
            "cidadao",
            "admin_municipal",
            "admin_geral"
        ];

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return response.status(400).json({
                mensagem: "ID do usuário inválido."
            });
        }

        if (!nomeLimpo || !emailLimpo || !perfil) {
            return response.status(400).json({
                mensagem: "Preencha o nome, e-mail e perfil."
            });
        }

        if (nomeLimpo.length > 150) {
            return response.status(400).json({
                mensagem: "O nome deve ter no máximo 150 caracteres."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
            return response.status(400).json({
                mensagem: "Informe um e-mail válido."
            });
        }

        if (!perfisPermitidos.includes(perfil)) {
            return response.status(400).json({
                mensagem: "Perfil informado inválido."
            });
        }

        if (senhaLimpa && senhaLimpa.length < 8) {
            return response.status(400).json({
                mensagem: "A senha deve ter pelo menos 8 caracteres."
            });
        }

        // Não permite alterar o próprio perfil de administrador geral.
        if (
            idUsuario === idResponsavel &&
            perfil !== "admin_geral"
        ) {
            return response.status(403).json({
                mensagem: "Você não pode alterar seu próprio perfil."
            });
        }

        let municipioId = null;

        // Cidadãos e administradores municipais precisam estar vinculados a um município.
        if (perfil === "cidadao" || perfil === "admin_municipal") {
            municipioId = Number(fk_id_municipio);

            if (!Number.isInteger(municipioId) || municipioId <= 0) {
                return response.status(400).json({
                    mensagem: "Selecione um município para este usuário."
                });
            }
        }

        conexao = await pool.getConnection();
        await conexao.beginTransaction();

        // Verifica se a conta existe.
        const [usuarios] = await conexao.execute(
            `SELECT id_conta, nome, email, perfil, fk_id_municipio
             FROM contas
             WHERE id_conta = ?
             FOR UPDATE`,
            [idUsuario]
        );

        if (!usuarios.length) {
            await conexao.rollback();

            return response.status(404).json({
                mensagem: "Usuário não encontrado."
            });
        }

        const usuarioAtual = usuarios[0];

        // Verifica se o e-mail pertence a outra conta.
        const [emailExistente] = await conexao.execute(
            `SELECT id_conta
             FROM contas
             WHERE email = ? AND id_conta <> ?
             LIMIT 1`,
            [emailLimpo, idUsuario]
        );

        if (emailExistente.length) {
            await conexao.rollback();

            return response.status(409).json({
                mensagem: "Este e-mail já está sendo utilizado por outra conta."
            });
        }

        // Confere se o município existe.
        if (municipioId !== null) {
            const [municipios] = await conexao.execute(
                `SELECT id_municipio
                 FROM municipios
                 WHERE id_municipio = ?`,
                [municipioId]
            );

            if (!municipios.length) {
                await conexao.rollback();

                return response.status(400).json({
                    mensagem: "O município selecionado não existe."
                });
            }
        }

        const alteracoes = [];

        if (usuarioAtual.nome !== nomeLimpo) {
            alteracoes.push("Nome alterado");
        }

        if (usuarioAtual.email !== emailLimpo) {
            alteracoes.push("E-mail alterado");
        }

        if (usuarioAtual.perfil !== perfil) {
            alteracoes.push(
                `Perfil alterado de ${usuarioAtual.perfil} para ${perfil}`
            );
        }

        if (
            Number(usuarioAtual.fk_id_municipio || 0) !==
            Number(municipioId || 0)
        ) {
            alteracoes.push("Município alterado");
        }

        const dadosAtualizacao = [
            nomeLimpo,
            emailLimpo,
            perfil,
            municipioId
        ];

        let sql = `
            UPDATE contas
            SET nome = ?,
                email = ?,
                perfil = ?,
                fk_id_municipio = ?
        `;

        // Atualiza a senha somente se uma nova senha for informada.
        if (senhaLimpa) {
            const senhaHash = await bcrypt.hash(senhaLimpa, 12);

            sql += ", senha_hash = ?";
            dadosAtualizacao.push(senhaHash);

            alteracoes.push("Senha redefinida");
        }

        sql += " WHERE id_conta = ?";
        dadosAtualizacao.push(idUsuario);

        await conexao.execute(sql, dadosAtualizacao);

        // Registra a alteração administrativa.
        const detalhes = alteracoes.length
            ? alteracoes.join("; ")
            : "Dados do usuário revisados, sem alterações.";

        await conexao.execute(
            `INSERT INTO acoes_administrativas
                (tipo, detalhes, fk_id_conta_responsavel,
                 fk_id_conta_afetada, fk_id_importacao)
             VALUES (?, ?, ?, ?, NULL)`,
            [
                "Editar usuário",
                detalhes,
                idResponsavel,
                idUsuario
            ]
        );

        await conexao.commit();

        return response.status(200).json({
            mensagem: "Usuário atualizado com sucesso.",
            usuario: {
                id_conta: idUsuario,
                nome: nomeLimpo,
                email: emailLimpo,
                perfil,
                fk_id_municipio: municipioId
            }
        });

    } catch (error) {
        if (conexao) {
            await conexao.rollback();
        }

        next(error);

    } finally {
        if (conexao) {
            conexao.release();
        }
    }
}

export async function listarMunicipios(request, response, next) {
  try {
    const [municipios] = await pool.execute(
      `SELECT id_municipio, nome
             FROM municipios
             ORDER BY nome ASC`
    );

    return response.status(200).json({ municipios });
  } catch (error) {
    next(error);
  }
}

function montarFiltrosRelatos(request) {
  const busca = String(request.query.busca || "").trim();
  const situacao = String(request.query.situacao || "").trim();
  const categoria = String(request.query.categoria || "").trim();

  const condicoes = ["r.latitude IS NOT NULL", "r.longitude IS NOT NULL"];

  const parametros = [];

  if (busca) {
    condicoes.push(`(
            r.descricao LIKE ?
            OR r.referencia_local LIKE ?
            OR c.nome LIKE ?
            OR m.nome LIKE ?
        )`);

    const termo = `%${busca}%`;

    parametros.push(termo, termo, termo, termo);
  }

  const situacoesPermitidas = ["Pendente", "Aprovado", "Rejeitado"];

  if (situacao) {
    if (!situacoesPermitidas.includes(situacao)) {
      throw new Error("Situação informada inválida.");
    }

    condicoes.push("r.situacao = ?");
    parametros.push(situacao);
  }

  if (categoria) {
    const categoriaId = Number(categoria);

    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      throw new Error("Categoria informada inválida.");
    }

    condicoes.push("r.fk_id_categoria = ?");
    parametros.push(categoriaId);
  }

  return {
    where: `WHERE ${condicoes.join(" AND ")}`,
    parametros,
  };
}


export async function listarRelatos(request, response, next) {
    try {
        const pagina = Math.max(
            1,
            Number.parseInt(request.query.pagina, 10) || 1
        );

        const limite = Math.min(
            50,
            Math.max(1, Number.parseInt(request.query.limite, 10) || 10)
        );

        const offset = (pagina - 1) * limite;

        const { where, parametros } = montarFiltrosRelatos(request);

        const [
            [resultadoTotal],
            [relatos],
            [categorias],
            [indicadores]
        ] = await Promise.all([
            pool.execute(
                `
                    SELECT COUNT(*) AS total
                    FROM relatos r
                    INNER JOIN categorias c
                        ON c.id_categoria = r.fk_id_categoria
                    INNER JOIN municipios m
                        ON m.id_municipio = r.fk_id_municipio
                    ${where}
                `,
                parametros
            ),

            pool.execute(
                `
                    SELECT
                        r.id_relato,
                        r.descricao,
                        r.data_fato,
                        r.hora_fato,
                        r.latitude,
                        r.longitude,
                        r.referencia_local,
                        r.enviado_em,
                        r.situacao,
                        r.fk_id_categoria,
                        r.fk_id_municipio,
                        c.nome AS categoria,
                        m.nome AS municipio
                    FROM relatos r
                    INNER JOIN categorias c
                        ON c.id_categoria = r.fk_id_categoria
                    INNER JOIN municipios m
                        ON m.id_municipio = r.fk_id_municipio
                    ${where}
                    ORDER BY r.enviado_em DESC
                    LIMIT ${limite} OFFSET ${offset}
                `,
                parametros
            ),

            pool.execute(`
                SELECT id_categoria, nome
                FROM categorias
                ORDER BY nome ASC
            `),

            pool.execute(`
                SELECT
                    COUNT(*) AS total,
                    COALESCE(SUM(situacao = 'Pendente'), 0) AS pendentes,
                    COALESCE(SUM(situacao = 'Aprovado'), 0) AS aprovados,
                    COALESCE(SUM(situacao = 'Rejeitado'), 0) AS rejeitados
                FROM relatos
            `)
        ]);

        const total = Number(resultadoTotal[0].total);

        return response.status(200).json({
            relatos,
            categorias,
            indicadores: {
                total: Number(indicadores[0].total),
                pendentes: Number(indicadores[0].pendentes),
                aprovados: Number(indicadores[0].aprovados),
                rejeitados: Number(indicadores[0].rejeitados)
            },
            paginacao: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        if (
            error.message === "Situação informada inválida." ||
            error.message === "Categoria informada inválida."
        ) {
            return response.status(400).json({
                mensagem: error.message
            });
        }

        next(error);
    }
}

export async function listarRelatosMapa(request, response, next) {
  try {
    const { where, parametros } = montarFiltrosRelatos(request);

    const [relatos] = await pool.execute(
      `
                SELECT
                    r.id_relato,
                    r.descricao,
                    r.data_fato,
                    r.hora_fato,
                    r.latitude,
                    r.longitude,
                    r.referencia_local,
                    r.enviado_em,
                    r.situacao,
                    c.nome AS categoria,
                    m.nome AS municipio
                FROM relatos r
                INNER JOIN categorias c
                    ON c.id_categoria = r.fk_id_categoria
                INNER JOIN municipios m
                    ON m.id_municipio = r.fk_id_municipio
                ${where}
                ORDER BY r.enviado_em DESC
            `,
      parametros
    );

    return response.status(200).json({ relatos });
  } catch (error) {
    if (
      error.message === "Situação informada inválida." ||
      error.message === "Categoria informada inválida."
    ) {
      return response.status(400).json({
        mensagem: error.message,
      });
    }

    next(error);
  }
}
export async function obterConfiguracoesConta(request, response) {
  try {
    const id = request.usuario.id;

    const [usuarios] = await pool.execute(
      `SELECT id_conta, nome, email, perfil
             FROM contas
             WHERE id_conta = ?
             LIMIT 1`,
      [id]
    );

    if (!usuarios.length) {
      return response.status(404).json({
        mensagem: "Conta não encontrada.",
      });
    }

    return response.json({ usuario: usuarios[0] });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);

    return response.status(500).json({
      mensagem: "Erro ao carregar os dados da conta.",
    });
  }
}

// Atualizar nome e e-mail
export async function atualizarDadosConta(request, response) {
  try {
    const id = request.usuario.id;

    const nome = String(request.body.nome || "").trim();
    const email = String(request.body.email || "")
      .trim()
      .toLowerCase();

    if (!nome || !email) {
      return response.status(400).json({
        mensagem: "Preencha o nome e o e-mail.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({
        mensagem: "Informe um e-mail válido.",
      });
    }

    const [duplicados] = await pool.execute(
      `SELECT id_conta
             FROM contas
             WHERE email = ? AND id_conta <> ?
             LIMIT 1`,
      [email, id]
    );

    if (duplicados.length) {
      return response.status(409).json({
        mensagem: "Este e-mail já está sendo utilizado.",
      });
    }

    const [resultado] = await pool.execute(
      `UPDATE contas
             SET nome = ?, email = ?
             WHERE id_conta = ? AND perfil = 'admin_geral'`,
      [nome, email, id]
    );

    if (!resultado.affectedRows) {
      return response.status(404).json({
        mensagem: "Conta não encontrada ou não autorizada.",
      });
    }

    return response.json({
      mensagem: "Dados atualizados com sucesso.",
      usuario: {
        id,
        nome,
        email,
        perfil: "admin_geral",
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);

    return response.status(500).json({
      mensagem: "Erro ao atualizar os dados da conta.",
    });
  }
}

// Alterar senha
export async function alterarSenhaConta(request, response) {
  try {
    const id = request.usuario.id;

    const senhaAtual = request.body.senhaAtual;
    const novaSenha = request.body.novaSenha;

    if (!senhaAtual || !novaSenha) {
      return response.status(400).json({
        mensagem: "Preencha a senha atual e a nova senha.",
      });
    }

    if (novaSenha.length < 8) {
      return response.status(400).json({
        mensagem: "A nova senha deve ter pelo menos 8 caracteres.",
      });
    }

    const [usuarios] = await pool.execute(
      `SELECT senha_hash
             FROM contas
             WHERE id_conta = ? AND perfil = 'admin_geral'
             LIMIT 1`,
      [id]
    );

    if (!usuarios.length) {
      return response.status(404).json({
        mensagem: "Conta não encontrada.",
      });
    }

    const senhaCorreta = await bcrypt.compare(
      senhaAtual,
      usuarios[0].senha_hash
    );

    if (!senhaCorreta) {
      return response.status(400).json({
        mensagem: "A senha atual está incorreta.",
      });
    }

    const novoHash = await bcrypt.hash(novaSenha, 10);

    await pool.execute(
      `UPDATE contas
             SET senha_hash = ?
             WHERE id_conta = ?`,
      [novoHash, id]
    );

    return response.json({
      mensagem: "Senha alterada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);

    return response.status(500).json({
      mensagem: "Erro ao alterar a senha.",
    });
  }
}


async function decidirRelato(request, response, next, resultado) {
    const idRelato = Number(request.params.id);
    const idResponsavel = Number(request.usuario.id);
    const motivo = String(request.body.motivo || "").trim();

    if (!Number.isInteger(idRelato) || idRelato <= 0) {
        return response.status(400).json({
            mensagem: "ID do relato inválido."
        });
    }

    if (resultado === "Rejeitado" && !motivo) {
        return response.status(400).json({
            mensagem: "Informe o motivo da rejeição."
        });
    }

    let conexao;

    try {
        conexao = await pool.getConnection();
        await conexao.beginTransaction();

        // Bloqueia o relato durante a decisão.
        const [relatos] = await conexao.execute(
            `SELECT id_relato, situacao
             FROM relatos
             WHERE id_relato = ?
             FOR UPDATE`,
            [idRelato]
        );

        if (!relatos.length) {
            await conexao.rollback();

            return response.status(404).json({
                mensagem: "Relato não encontrado."
            });
        }

        if (relatos[0].situacao !== "Pendente") {
            await conexao.rollback();

            return response.status(409).json({
                mensagem: "Este relato já foi analisado."
            });
        }

        const tipoAcao = resultado === "Aprovado"
            ? "Aprovar relato"
            : "Rejeitar relato";

        // Registra a ação administrativa.
        const [acao] = await conexao.execute(
            `INSERT INTO acoes_administrativas
                (tipo, detalhes, fk_id_conta_responsavel,
                 fk_id_conta_afetada, fk_id_importacao)
             VALUES (?, ?, ?, NULL, NULL)`,
            [
                tipoAcao,
                resultado === "Rejeitado" ? motivo : null,
                idResponsavel
            ]
        );

        // Registra a decisão vinculada à ação e ao relato.
        await conexao.execute(
            `INSERT INTO decisoes
                (resultado, motivo_rejeicao, fk_id_acao, fk_id_relato)
             VALUES (?, ?, ?, ?)`,
            [
                resultado,
                resultado === "Rejeitado" ? motivo : null,
                acao.insertId,
                idRelato
            ]
        );

        // Atualiza a situação do relato.
        await conexao.execute(
            `UPDATE relatos
             SET situacao = ?
             WHERE id_relato = ?`,
            [resultado, idRelato]
        );

        await conexao.commit();

        return response.status(200).json({
            mensagem: resultado === "Aprovado"
                ? "Relato aprovado com sucesso."
                : "Relato rejeitado com sucesso.",
            situacao: resultado
        });

    } catch (error) {
        if (conexao) {
            await conexao.rollback();
        }

        next(error);
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
}

export async function aprovarRelato(request, response, next) {
    return decidirRelato(request, response, next, "Aprovado");
}

export async function rejeitarRelato(request, response, next) {
    return decidirRelato(request, response, next, "Rejeitado");
}
