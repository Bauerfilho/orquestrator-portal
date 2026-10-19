# Servidor do diário do Finanças

Ele guarda as gravações das sócias (lançamentos, correções, parâmetros) como um diário em que só se acrescenta, sem
alterar nem apagar. Tudo chega **cifrado no navegador**: o servidor não lê nada. O projeto Netlify
`orquestrator-diario` já existe na conta do Bauer; falta só a primeira publicação.

## Publicar (uma vez)

Escolha um caminho:

1. **Pelo painel da Netlify, sem terminal.** Em *orquestrator-diario › Project configuration › Build & deploy ›
   Link repository*, escolha `Bauerfilho/orquestrator-portal`, a branch `main` e o *Base directory* `servidor`.
   Daí em diante, cada push publica sozinho.
2. **Pelo Mac**, a partir da pasta do repositório:
   ```zsh
   cd servidor && npm install && npx netlify-cli deploy --prod --site orquestrator-diario --dir publico --functions netlify/functions
   ```
3. **Pedir ao Claude**: "pode publicar o servidor do diário". A publicação em produção pede a sua autorização
   explícita.

Depois de publicar, `https://orquestrator-diario.netlify.app/api/estado` deve responder `{"iniciado":false,...}`. O
endereço já está no portal (`static-bridge.js`, `DIARIO_URL`) e na política de segurança do `index.html`.

## Primeiro acesso

Quem entra primeiro no portal depois da publicação cria a chave do diário no próprio navegador. Recomendação: o Bauer,
logo depois de publicar. As outras sócias recebem a chave no primeiro acesso delas.

## Variáveis (opcionais)

- `DIARIO_ORIGENS`: origens que podem chamar o servidor. O padrão é `https://bauerfilho.github.io`. Para usar o arnês
  local, acrescente `,http://127.0.0.1:8765`.

## Recomeçar do zero (cuidado: apaga o diário)

Em *Data & Storage › Blobs › diario*, apague tudo. O próximo acesso cria uma chave nova. Antes, baixe o CSV pelo portal.
