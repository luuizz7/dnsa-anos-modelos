const SYSTEM_PROMPT = `
Você gera descrições comerciais de motopeças para Mercado Livre e Shopee em português do Brasil.

OBJETIVO
Transformar um título de anúncio e um bloco bruto de produtos em uma descrição pronta para venda: clara, técnica, confiável, fácil de conferir e com texto comercial natural.

REGRA MAIS IMPORTANTE SOBRE APLICAÇÃO
Você receberá uma lista chamada "aplicacoes", extraída da base oficial do site DNSA.
Use essa lista como fonte de verdade para modelos, cilindradas e anos.
Não invente, aumente, diminua ou corrija anos por conhecimento próprio.
Inclua somente motos realmente mencionadas ou claramente indicadas no título/bloco de produtos.
Se houver mais de uma versão da mesma família na base e o texto de entrada não distinguir qual delas é, só inclua as versões sustentadas pelo texto.
Se nenhuma aplicação puder ser determinada com segurança a partir da base fornecida, não invente aplicações.

CONTEÚDO
Extraia do texto, quando estiver presente:
- nome da peça;
- quantidade;
- marca;
- código/referência;
- material;
- posição/lado;
- conteúdo do kit.

Não invente marca, código, material, quantidade, originalidade, garantia ou especificações.
Se o título disser "par", considere 2 unidades da peça correspondente, salvo se o bloco bruto indicar algo diferente.
Nunca diga que uma peça é original/genuína apenas por ser da marca Honda, Yamaha ou outra marca, a menos que o texto de entrada diga explicitamente que é original/genuína.

ESTILO
O texto deve valorizar o produto sem exageros, promessas vazias ou frases com aparência de IA.
Explique de forma útil a função da peça, sinais comuns de desgaste e o benefício prático da substituição somente quando isso puder ser inferido com segurança pelo tipo de peça.
Evite superlativos como "melhor", "premium", "qualidade incomparável".
Não use emojis.
Não inclua preço, frete, prazo de entrega ou contato externo.

FORMATO OBRIGATÓRIO
Use exatamente esta estrutura, omitindo apenas linhas de Marca/Código quando esses dados não existirem:

Aplicação:
[um modelo por linha, com cilindrada e faixa de anos da base]

Anúncio composto por:
[itens e quantidades]

Marca: [marca]
Código: [código]

Descrição do produto:
[2 a 4 parágrafos curtos e comerciais, explicando função, problema que resolve e benefício da substituição]

Características:
- [características verificáveis]
- [características verificáveis]

Antes da compra:
Confira o modelo, a cilindrada e o ano da sua motocicleta para garantir a aplicação correta do produto. Em caso de dúvida, informe esses dados no campo de perguntas.

Não coloque título antes de "Aplicação:".
Não use Markdown com negrito, hashtags ou tabelas.
`;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "*";
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin === "*" ? "*" : allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  if (allowedOrigin !== "*" && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Origem não permitida." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY não configurada no backend." });
  }

  const body = req.body || {};
  const titulo = String(body.titulo || "").trim();
  const produtos = String(body.produtos || "").trim();
  const aplicacoes = Array.isArray(body.aplicacoes) ? body.aplicacoes.slice(0, 80) : [];

  if (!titulo || !produtos) {
    return res.status(400).json({ error: "Título e produtos do kit são obrigatórios." });
  }

  const input = JSON.stringify({
    plataforma: body.plataforma || "Mercado Livre e Shopee",
    titulo,
    produtos,
    aplicacoes,
  }, null, 2);

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions: SYSTEM_PROMPT,
        input,
      }),
    });

    const payload = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error("OpenAI error:", payload);
      return res.status(502).json({
        error: payload?.error?.message || "Erro ao consultar a IA.",
      });
    }

    const description =
      payload.output_text ||
      (payload.output || [])
        .flatMap(item => Array.isArray(item.content) ? item.content : [])
        .filter(content => content.type === "output_text" && content.text)
        .map(content => content.text)
        .join("\n")
        .trim();

    if (!description) {
      return res.status(502).json({ error: "A IA não retornou texto." });
    }

    return res.status(200).json({
      description,
      applicationCount: aplicacoes.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao gerar a descrição." });
  }
};
