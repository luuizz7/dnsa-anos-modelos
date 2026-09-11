# DNSA — Descrição Pro com IA

## Já implementado
- Duas abas no topo: "Anos & Modelos" e "Descrição Pro".
- A aba existente foi preservada.
- Título + Produtos do kit em bloco seco.
- Cruzamento com a base `data.js`.
- Geração por IA para Mercado Livre e Shopee.
- Botão para copiar a descrição.

## Para a IA funcionar
A chave da OpenAI deve ficar no backend, nunca no navegador.

### Jeito mais simples: Vercel
1. Publique este projeto na Vercel.
2. Em Environment Variables, crie `OPENAI_API_KEY`.
3. Opcional: `OPENAI_MODEL=gpt-5.6-luna`.
4. Opcional: `ALLOWED_ORIGIN=https://SEU-SITE.vercel.app`.
5. Faça o deploy.

O endpoint já está pronto em `/api/descricao`.

### Se mantiver o site no GitHub Pages
Hospede a pasta `api` em um backend, por exemplo Vercel, e adicione antes de `descricao-pro.js`:

<script>
  window.DNSA_AI_ENDPOINT = "https://SEU-BACKEND.vercel.app/api/descricao";
</script>

Nunca coloque a OPENAI_API_KEY no index.html, data.js, app.js ou descricao-pro.js.
