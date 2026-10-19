# Checklist da noite de 19/10/2026: portal Finanças v2

Plano aprovado: `docs/PLANO-PORTAL.md`. Este arquivo é riscado a cada checkpoint (commit e push na branch
`claude/portal-financas-v2`). Backup do estado anterior: branch `backup/antes-do-plano-2026-10-19`.

## Decisões tomadas pelo Claude (com o porquê)

- **D1, onde fica a fonte.** O próprio `orquestrator-portal`, porque o Bauer disse que "o aplicativo do GitHub é o
  atualizado". O README passa a dizer isso. O `montar.mjs` continua sendo a origem do pacote cifrado de dados (`.bin`),
  mas, se for rodado sobre o repositório, não pode sobrescrever a interface.
- **D2, onde as gravações ficam.** Uma função Netlify com Netlify Blobs, na conta do Bauer, no projeto
  `orquestrator-diario`, que já foi criado.
  - **Por que não o Cloudflare do plano:** ele exige conta nova e um `wrangler deploy` no Mac.
  - **Por que a Netlify:** a conta já existe, o plano gratuito permite uso comercial e o Blobs tem gravação
    condicional (`onlyIfNew`), o que dá um diário só-acréscimo com compare-and-swap sem banco.
  - **O que falta:** publicar foi bloqueado pelo modo automático (deploy em produção pede o Bauer). Fica como a ação
    da manhã.
- **Chaves sem o `montar.mjs`.** O plano gerava as chaves do diário no Mac. Aqui elas nascem no navegador:
  - **Chave do diário:** a primeira sócia a entrar cria uma chave aleatória e a guarda no servidor embrulhada duas
    vezes. Uma pela chave derivada da senha dela (PBKDF2 com 600 mil iterações). Outra pela chave da publicação atual
    do pacote, para que as outras sócias a abram no primeiro acesso.
  - **Quem assina:** cada sócia tem um par ECDSA próprio, registrado no primeiro uso. Ele assina cada evento.
  - **O que o servidor vê:** só texto cifrado.
- **D5, gasto pago do bolso.** O padrão é "a empresa reembolsa". Também dá para escolher "dividir entre as sócias" ou
  "conta como meu aporte".
- **D6, gasto em dólar.** PTAX de venda, mais 4% de spread no cartão (a conferir na fatura), mais 3,5% de IOF. O valor da
  fatura, quando informado, substitui a estimativa.
- **D7, transparência.** Todas veem todos os lançamentos.
- **D15, categorias.** Seis cores mais "Outros".
- **Fica para o Bauer.**
  - D4: quatro olhos para impostos. Hoje qualquer sócia edita, e tudo fica registrado com autora.
  - D8: fechamento mensal.
  - D9: regime tributário e contador. Os prazos de 30/10 e 01/11 estão no plano.
  - D10: frases-senha distintas por sócia.

## Checklist

- [x] Backup do estado anterior (branch `backup/antes-do-plano-2026-10-19`).
- [x] Branch de trabalho, plano e checklist no repositório.
- [x] Núcleo do livro-razão `razao.js`:
  - parâmetros com vigência;
  - conversão com spread e IOF;
  - lançamentos, edição e anulação com motivo;
  - livro do mês (realizado, previsto e total);
  - categorias, rateio e acerto entre sócias;
  - CSV para o contador;
  - "Ver a conta".
- [x] Testes do núcleo (`node --test testes/*.test.mjs`) com os vetores do plano e o exemplo de outubro, centavo a
  centavo.
- [x] Servidor do diário (`servidor/`): função Netlify com Blobs, só-acréscimo e CAS. Testes com armazenamento em
  memória (5 testes).
- [x] Cliente do diário (`diario.js`), com 3 testes: duas sócias, conflito, republicação, servidor que não vê nada
  em claro e adulteração detectada.
  - cifra AES-GCM e assinatura ECDSA;
  - embrulho de chaves por sócia e por publicação;
  - modo treino quando o servidor não está configurado.
- [x] Interface:
  - kit de gráficos;
  - páginas Livro do mês, Lançamentos, Parâmetros (com PTAX do Banco Central) e Histórico;
  - botão "+ Lançar";
  - estado da gravação no cabeçalho;
  - resumo do mês no Meu painel.
- [x] Arnês local com o portal novo (sem senha) e fotos em claro e escuro, no desktop e no celular, sem erro de
  script nem de CSP: 72 fotos, 0 erros. Fluxo ponta a ponta no navegador, com gravação cifrada real: 11 de 11 passos.
- [x] CSP liberando o servidor do diário e a PTAX do BCB. Bloqueio de moldura (`app.js`).
- [x] README do portal: o GitHub é a fonte, e como publicar o servidor. CI com `node --test`.
- [x] Controles honestos: na versão online, "Editar cobrança" vira "Lançar pagamento" (já preenchido), e o
  estado da assinatura e os passos de venda ficam desabilitados, com o motivo.
- [x] Menu em grupos (Dinheiro · Planejar · Empresa · Registro). Botão flutuante de lançar no celular.
- [x] PR em rascunho (#1) e relatório da manhã.

## O que só o Bauer pode fazer (quando acordar)

1. Publicar o servidor do diário: um comando ou um clique, descrito no README (`servidor/LEIA.md`).
2. Revisar e fazer o merge do PR do portal. O merge publica no GitHub Pages, ou seja, em produção.
3. Primeiro acesso depois do merge: entrar no portal. A chave do diário nasce no navegador dele.

## Ficou para as próximas fases (do plano)

- **P1:** fechamento do mês com selo e pacote do contador, receitas por canal, saldos bancários e fôlego (runway),
  conciliação da fatura item a item, e as assinaturas editáveis pelo diário (nova, confirmar, encerrar).
- **P2:** impostos calculados (Simples, fator R, DAS), comprovantes cifrados, domínio próprio com Face ID, e o Med
  Painel ligado aos parâmetros.
- **Quatro olhos para impostos (D4):** hoje qualquer sócia muda qualquer parâmetro, sempre com autora, data e fonte
  registradas, e com a prévia de impacto antes de salvar.
