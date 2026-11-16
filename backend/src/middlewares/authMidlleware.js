import jwt from "jsonwebtoken";

export function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ mensagem: "Token não fornecido. Faça login." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const dadosToken = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = dadosToken; // Guarda { id, perfil } dentro do req
        next();
    } catch (error) {
        return res.status(401).json({ mensagem: "Token inválido ou expirado." });
    }
}