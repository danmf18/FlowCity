// Importa a conexão do banco que fica em outro arquivo
import { pool } from "../config/database.js"; 

export async function criarRelato(req, res, next) {
    try {
        // 1. Pega os 3 campos que o React enviou no fetch
        const { categoria, endereco, confirmacao } = req.body;

        // 2. Confere se o usuário não mandou vazio
        if (!categoria || !endereco) {
            const erro = new Error("Preencha a categoria e o endereço.");
            erro.status = 400;
            throw erro; // Pula direto para o catch abaixo
        }

        if (!confirmacao) {
            const erro = new Error("Marque a caixa de confirmação.");
            erro.status = 400;
            throw erro;
        }

        // 3. Manda salvar no banco de dados (exemplo com SQL)
        await db.query(
            "INSERT INTO relatos (categoria, endereco, confirmacao) VALUES (?, ?, ?)",
            [categoria, endereco, confirmacao]
        );

        // 4. Avisa o React que deu tudo certo (status 201)
        return res.status(201).json({ mensagem: "Relato salvo com sucesso!" });

    } catch (error) {
        // Se deu qualquer erro acima (ou o banco caiu), entrega para o middleware de erro
        next(error);
    }
}