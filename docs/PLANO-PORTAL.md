# Plano de melhorias do portal Finanças

**19/10/2026.** Este plano junta três propostas independentes num só e se apoia em sete levantamentos: domínio, páginas, segurança, onde está a fonte, pesquisa fiscal e de UX, e fotos do arnês.

**Escolhas de base:**
- **Espinha:** a proposta *Autonomia e operação*. Ela tem a gravação mais segura e mais simples de manter.
- **Modelo de dados e contas:** vêm de *Dados e cálculo primeiro*.
- **Sistema visual e didática:** vêm de *Clareza visual*.

O placar do julgamento está no fim.

Arquivos de apoio, todos na pasta `/tmp/claude-0/-home-user-ia-chat/9d78e2b9-d23d-50e2-bcf9-972b6bc79644/scratchpad/plano/`:
- `dados-primeiro-prototipo.mjs`: protótipo das funções puras. Todas as verificações passam.
- `plano-contas.mjs`: confere os exemplos numéricos deste plano em BigInt.
- `arnes/`: o portal local, sem senha, com estado fictício, fotos e o modo `?escrita=1`.
- `premissas-padrao-pesquisa.json`: semente de parâmetros fiscais com fonte e vigência.
- `descobrir-fonte-no-mac.sh`: só lê arquivos; localiza a fonte do AI Cask no Mac.
- `dominio-sonda.mjs` e `dominio-extensao-esboco.mjs`: as provas sobre o domain.js atual.

---

## 1. O que muda para as sócias

1. Qualquer sócia lança um gasto pelo celular em uns 10 segundos: valor, descrição, categoria e quem pagou. O gasto entra na hora no mês, no rateio e no acerto entre vocês, sem pedir nada a uma IA nem ao Mac.
2. O dólar, o spread do cartão, o IOF, os impostos e as taxas (Hotmart, Stripe, Apple) ficam numa página só, editável. Cada valor tem data de início, fonte e autora. Mudar o dólar hoje não mexe nos meses passados.
3. Errar não é problema. Dá para desfazer em 8 segundos, e nada se apaga: corrigir cria um registro novo. A página **Histórico** mostra quem mudou o quê, quando e por quê.
4. Cada página abre com uma frase do mês e poucos números grandes. Embaixo vêm gráficos com cores fixas (azul entrou, vinho saiu, ouro é a sua parte) e, por último, a tabela completa até o centavo. Todo número calculado tem um "Ver a conta" que mostra a fórmula com os valores reais.
5. Valores em dólar continuam aparecendo em dólar. Ao lado aparece "≈ R$" com a conta à mostra, marcado como **estimado** até a fatura chegar e como **efetivo** depois.
6. No fim do mês, um roteiro de 6 passos fecha o mês, congela os números com um selo e gera o arquivo para o contador.
7. Os botões que hoje deixam preencher e depois recusam ("Esta versão publicada é só de leitura") desaparecem. O portal só oferece o que você pode fazer.

---

## 2. Decisões que precisam do usuário

Há uma recomendação em cada item, mas a decisão é sua. As duas primeiras bloqueiam o resto.

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| **D1** | **Onde a fonte passa a viver**, para o `montar.mjs` não apagar as mudanças | Criar um repositório **privado** `Bauerfilho/ai-cask` a partir de `~/Projetos/ai-cask`, com no mínimo: a pasta web do Finanças, `montar.mjs`, `static-bridge.js`, `portal-crypto.js`, `core.py`, `Financeiro.swift` e `tests/`. O `.gitignore` deve tirar `build/`, `.build/`, o arquivo de estado, os usuários (CPF e scrypt) e as senhas. Antes, rodar `descobrir-fonte-no-mac.sh` para achar os caminhos. Depois, liberar o repositório nesta sessão. | Tudo o que for editado direto em `orquestrator-portal` é sobrescrito na publicação seguinte. Os commits 977589d e 4b45bab regeneraram o `app.js` inteiro. Hoje essa fonte existe **só no Mac** e fica fora do backup de 30/09, então perder o Mac é perder o sistema. Com o repositório, as IAs trabalham por PR, com testes, sem tocar no Mac. |
| **D2** | **Onde as gravações ficam** (o backend) | **Cloudflare Worker com um Durable Object (SQLite)**, plano Free. O Worker guarda só envelopes cifrados num diário em que só se acrescenta, sem apagar nem alterar. Você cria a conta e roda `wrangler deploy` uma vez do Mac. | Custa R$ 0: o plano Free dá 100 mil requisições por dia e não pausa por inatividade. O Durable Object tem um único escritor, então o compare-and-swap sai naturalmente. São umas 200 linhas sem dependências, e o servidor nunca lê os dados. Comparação com as outras opções: o Supabase SP tem latência menor, mas o plano grátis pausa após 7 dias sem uso e não tem backup automático. O GitHub como banco exige um token de escrita no navegador e tem limite de 80 escritas por minuto. O Vercel Hobby proíbe uso comercial. Há ainda a opção **D**: não gravar online, com só o AI Cask gravando no mesmo formato de diário num arquivo do Mac (ver §3.12). Pontos em aberto: medir a latência real (o Durable Object fica na América do Norte Leste, estimativa de 120 a 150 ms), confirmar os termos de uso comercial do plano Free e confirmar se a recuperação no tempo vale no Free. |
| D3 | Quem é a **responsável** (papel *owner*) | Você, com a opção de nomear uma segunda. | É a responsável quem fecha e reabre o mês, edita o gasto de outra sócia (com motivo visível) e aplica parâmetros fiscais sem esperar confirmação. |
| D4 | Política de **parâmetros** | Dólar e spread: qualquer sócia edita, porque são números operacionais e sempre registrados. Impostos, IOF, taxas e tetos funcionam com **quatro olhos**: uma sócia propõe, outra confirma, ou a responsável aplica direto. | Um imposto errado contamina todos os cálculos. A regra de quatro olhos, mais as faixas válidas e a prévia de impacto, barram tanto o erro quanto o vandalismo, e o dia a dia continua rápido. |
| D5 | Destino padrão de um **gasto pago do próprio bolso** | A empresa reembolsa o valor inteiro. Por gasto, também dá para escolher "dividir entre sócias" ou "conta como meu aporte". | É o caso mais comum e o mais simples de explicar ao contador. As outras duas opções cobrem as demais situações sem mudar o modelo. |
| D6 | Como estimar **gastos em dólar** | PTAX de venda do dia da compra (botão "Atualizar pela PTAX", do Banco Central) + spread do cartão de **4%** (editável e a conferir na primeira fatura) + IOF de **3,5%**. O valor da fatura substitui a estimativa quando chega. | Desde 2020 o cartão usa o câmbio do dia da compra (Circular BCB 3.918). O spread de cada emissor não vem separado na fatura. Por isso a estimativa tem de ser honesta e a fatura é a verdade. |
| D7 | **Transparência** entre sócias | Todas veem os lançamentos de todas. | Numa empresa de três sócias com custos rateados, o acerto só é confiável se cada uma conseguir conferir os gastos que entram na conta dela. |
| D8 | **Fechamento** do mês | A responsável fecha até o dia 5. Reabrir exige motivo, que fica no Histórico. | Sem fechamento, os números ficam "provisórios" para sempre e uma mudança de participação reescreve o passado. |
| D9 | **Regime tributário e contador** | Informar o regime atual (Simples Anexo III ou V, ou Lucro Presumido) e quem é o contador, que vai marcar os parâmetros como "conferido". | A semente de 42 parâmetros entra toda como "a confirmar". **Dois prazos próximos:** a opção do Simples por recolher IBS/CBS fora do DAS vai até **30/10/2026** (11 dias), e a NFS-e nacional fica obrigatória para ME/EPP do Simples em **01/11/2026**. Isso é informação, não conselho: vale falar com o contador **esta semana**, independente do portal. |
| D10 | **Senhas** | Trocar por frases-senha geradas pelo Criador (5 ou mais palavras aleatórias, cerca de 60 bits), **uma diferente por sócia**, antes de liberar a gravação. | O manifesto e o pacote são públicos e podem ser atacados por força bruta offline. Com gravação, quebrar uma senha deixa também escrever em nome daquela sócia. Além disso, duas sócias com a mesma senha viram a mesma pessoa, porque `unlock` para no primeiro membro que abre. |
| D11 | **Núcleo único** | Tudo o que é novo existe só em `domain.js`, que roda no navegador, no Node (`montar.mjs`) e na aba do AI Cask. O `core.py` fica preso por testes de equivalência no que já faz hoje, até ser aposentado. | Duas linguagens calculando a mesma conta acabam divergindo centavo a centavo. Ver §3.12. |
| D12 | **Receitas e pagantes** | Por enquanto, lançar à mão por mês e por canal, só com números agregados e sem nomes. A importação de CSV da Hotmart, Stripe ou Apple vem depois, também agregada no navegador. | Sem receita não há resultado nem fôlego. Nomes de pagantes no pacote seriam um problema de LGPD. |
| D13 | **Comprovantes** | Por enquanto, guardar só o número do documento e onde ele está (Drive, e-mail). O arquivo cifrado no R2 vem na fase P2. | O saneamento atual descarta `path` e links assinados. Guardar o arquivo exige armazenamento próprio e cifra. |
| D14 | **Domínio próprio** (cerca de R$ 40 a 60 por ano) | Deixar para a fase P2. | É ele que permite entrar com Face ID (passkey), guardar a fila de envio no aparelho e bloquear a moldura por cabeçalho. Também tira o portal da origem compartilhada `bauerfilho.github.io`. |
| D15 | **Categorias** (seis cores fixas mais "Outros") | Software e IA · Infraestrutura · Impostos e taxas · Contabilidade e jurídico · Marketing · Banco e câmbio. Pró-labore e Equipamento entram como categorias sem cor própria, em "Outros" nos gráficos. | Mais de seis cores deixa de ser legível e de passar no teste de daltonismo (§6). |

---

## 3. Arquitetura

### 3.1 Três princípios

1. **Um motor só, o `domain.js`.** Ele já usa centavos em BigInt, rateio pelo maior resto e compare-and-swap. Ganha as coleções novas e as funções puras, e o mesmo arquivo roda no navegador da sócia, no `montar.mjs` e na aba do AI Cask.
2. **Um caminho de escrita só, o diário.** Toda gravação é um evento cifrado no navegador, assinado pela sócia e acrescentado ao fim de um log em que nada se apaga. O estado em uso é `fold(checkpoint, eventos)`, ou seja, o último checkpoint com os eventos posteriores reaplicados por `applyEvent`. O diário serve ao mesmo tempo de banco, de trilha de auditoria e de fonte que o `montar.mjs` lê sem destruir.
3. **O Mac sai do dia a dia.** Ele continua dono de senhas, membros, participação, atlas, premissas de cenário e Laboratório, e publica o checkpoint como hoje. Lançar, corrigir e editar parâmetros não passa mais por ele.

### 3.2 Visão geral

```
 navegador da sócia (portal no GitHub Pages)                 Cloudflare (Worker + Durable Object)
 ┌───────────────────────────────────────────┐   HTTPS     ┌──────────────────────────────────────┐
 │ senha → PBKDF2 600k → KEK                  │  Bearer T_i │ events(seq, id, member_id, epoch,    │
 │   ├─ abre o pacote (checkpoint) do Pages   │◄──────────► │        prev_hash, hash, iv, ct, sig) │
 │   ├─ abre T_i (token) e a chave ECDSA      │ só envelopes│ members(token_sha256, pubkey, papel) │
 │   └─ recebe K_diario (dentro do pacote)    │  cifrados   │ CAS na cabeça · cotas · cron backup  │
 │ domain.js: applyEvent / fold / snapshot    │             └──────────────┬───────────────────────┘
 │ journal.js: cifra, assina, fila, 409       │                            │ cron diário (cifrado)
 └───────────────▲───────────────────────────┘                            ▼
                 │ pacote cifrado (checkpoint + journal_head)    repo privado de backup
 ┌───────────────┴───────────────────────────┐
 │ Mac: montar.mjs (determinístico, sem IA)   │  baixa o diário → confere cadeia e assinaturas →
 │ AI Cask: aba Finanças = mais um cliente    │  fold com o mesmo domain.js → publica checkpoint
 └───────────────────────────────────────────┘
```

### 3.3 Onde cada peça é implementada, sempre no repositório privado da D1

| Peça | Arquivo | O que muda |
|---|---|---|
| Domínio | `domain.js` | Coleções novas, `PARAMETER_CATALOG`, funções puras (§4.4), `authorize()`, `applyEvent()`, `foldJournal()`, `explain()` e `DOMAIN_VERSION`. Correções de exatidão. |
| Diário | `journal.js` (novo, cerca de 250 linhas) | Cifra AES-GCM, assinatura ECDSA, cliente HTTP do Worker, fila de saída, rebase no 409, verificação da cadeia. |
| Ponte do portal | `static-bridge.js` (modelo injetado pelo `montar.mjs`) | Mutações passam por `applyEvent` local e depois por `journal.append`, no lugar do `read_only`. Troca `readOnly` por `capabilities` por ação. Modo treino. |
| Interface | `app.js`, `index.html`, `style.css`, `tema.css`, `graficos.js` (novo) | Páginas, formulários, kit de gráficos, tokens. A lista de ações em `app.js:6` ganha as ações novas. |
| Gráficos | `graficos.js` | Tem de entrar também na lista fechada `RecursosFinanceiros` do `Financeiro.swift` e na lista de cópia do `montar.mjs`. Sem isso, dá 404 num dos dois lugares. |
| Publicação | `montar.mjs` | Chave do diário por época, token e chave de assinatura por sócia, `journal_head` no pacote, CSP com o host exato, nomes de `app.js` e `domain.js` com hash, `minClientVersion`, recusa de senhas repetidas. |
| Servidor | `worker/` (no mesmo repositório privado) | `wrangler.toml` e cerca de 200 linhas. Implantação pelo Mac (`wrangler deploy`) ou por uma GitHub Action. |
| AI Cask | `Financeiro.swift` | A ação nativa `state` passa a devolver o estado canônico saneado, para a página montar o snapshot com o mesmo `domain.js`. A ação `journal_credentials` entrega ao AI Cask o token e a chave do diário guardados no Keychain. O CSP da aba libera o host do Worker. |

### 3.4 Chaves e identidade por membro

| Chave | Nasce em | Vive em | Serve para | Troca |
|---|---|---|---|---|
| Senha da sócia (frase-senha única) | Criador | Cabeça da sócia; Keychain do Mac | Derivar a KEK | Quando quiser: republicar |
| KEK_i = PBKDF2-SHA256(senha normalizada, salt_i, 600 000) | Navegador | Memória, como `CryptoKey` não extraível | Abrir os embrulhos da sócia i | Muda com o salt |
| Chave mestra do pacote | `montar.mjs` | Memória (trocar `masterRaw` em bytes por `CryptoKey` não extraível) | Abrir o checkpoint | Pode mudar a cada publicação, como hoje |
| **Chave do diário K_e** da época *e* | `montar.mjs`, **aleatória** de 256 bits | Keychain do Mac; dentro do pacote cifrado (`journal.epochs[]`) | Cifrar os eventos | **Só** quando alguém sai da sociedade (abre-se uma época nova) |
| **Token de escrita T_i** | `montar.mjs`, aleatório de 32 bytes | Keychain; embrulhado por KEK_i no manifesto (`members[i].write`); o Worker guarda **só o SHA-256** | Autenticar a sócia no Worker | Revogar = o Worker desativa o token e o Mac republica |
| **Par ECDSA P-256** da sócia | `montar.mjs` | Privada: Keychain + embrulhada por KEK_i (`members[i].sign`). Pública: roster no pacote e no Worker | Assinar cada evento (autoria) | Na troca de senha ou na saída da sócia |
| Segredo de administrador do Worker | Bauer | Só no Keychain do Mac | `POST /admin/members` (registrar tokens e chaves públicas) | Anual |

Três decisões técnicas deste quadro:

- **A chave do diário é aleatória, não derivada da mestra.** Duas propostas sugeriam derivá-la da mestra com HKDF. Foi rejeitado: se o `montar.mjs` sorteia uma chave mestra nova a cada publicação (o manifesto público troca salt, IV e embrulho a cada publicação), todos os eventos antigos ficariam ilegíveis.
- **A identidade vem do token e da assinatura, nunca do corpo do pedido.** O Worker tira o `member_id` do token. O AAD do evento amarra esse `member_id`: se uma sócia cifrar um evento "como Ana" e mandar com o próprio token, a decifração falha em todos os clientes. A assinatura ECDSA, conferida pelo Worker e por cada cliente, impede forjar autoria mesmo com o servidor comprometido.
- **Limite dito com franqueza.** Enquanto o Criador define as senhas e gera as chaves, ele consegue tecnicamente agir como qualquer sócia. A assinatura protege contra o servidor e entre as sócias, não contra o Criador. Passkeys, na fase P2, removem essa limitação.

### 3.5 O evento

O envelope é o que o Worker guarda e vê, tudo em claro menos `ct`:

```json
{ "seq": 128, "id": "01JAC0Z4R8T9W1X2Y3Z4A5B6C7", "member_id": "ana", "epoch": 1,
  "prev_hash": "b3f1…", "hash": "9a0c…", "iv": "<12 bytes base64>", "ct": "<base64>",
  "sig": "<ECDSA P-256 base64>", "ts": "2026-10-19T17:02:11Z" }
```

O conteúdo só é decifrado no navegador:

```json
{ "v": 1, "id": "01JAC0Z4R8T9W1X2Y3Z4A5B6C7", "action": "edit_expense",
  "target": { "collection": "expenses", "id": "01JABZ…", "version": 2 },
  "payload": { "values": { "amountMinor": 48000 } },
  "before": { "amountMinor": 45000 }, "after": { "amountMinor": 48000 },
  "reason": "valor da nota corrigido", "clientAt": "2026-10-19T14:02:09-03:00", "domainVersion": 2 }
```

- **Cifra:** AES-GCM-256 com IV aleatório de 96 bits. AAD = `orquestrator-portal/v2|diario|epoch|id|member_id|prev_hash`.
- **Assinatura:** ECDSA P-256 com SHA-256 sobre `v2|epoch|id|member_id|prev_hash|SHA-256(iv‖ct)`.
- **Cadeia:** `hash = SHA-256(prev_hash ‖ id ‖ member_id ‖ iv ‖ ct)`.
- **Consequências:** o servidor não lê nada; trocar autora, ordem ou conteúdo quebra a decifração, a assinatura ou a cadeia.
- **Tamanho:** cerca de 1 KB por evento e cerca de 100 eventos por mês, o que dá uns 1,2 MB por ano. O fold de anos leva milissegundos.

### 3.6 O servidor (Worker + Durable Object "empresa")

**Tabelas**
- `events(seq INTEGER PRIMARY KEY, id TEXT UNIQUE, member_id, epoch, prev_hash, hash, iv BLOB, ct BLOB, sig BLOB, ts)`
- `members(token_sha256 PRIMARY KEY, member_id, role, pubkey_jwk, epoch, active)`
- `meta(head, head_hash, last_backup)`

**Rotas.** Todas exigem `Authorization: Bearer T_i`, menos `/health`.
- `GET /head` responde `{seq, hash}`.
- `GET /events?after=N` devolve até 500 envelopes.
- `POST /append {id, epoch, iv, ct, sig, prevHash, expectedSeq}` responde de três formas:
  - 201 com `{seq, hash}` quando grava;
  - 409 com a cabeça e os envelopes que faltam;
  - se o `id` já existe com o mesmo `ct`, devolve o `seq` original (reenvio idempotente).
- `POST /admin/members` exige o segredo de administrador e é chamado só pelo `montar.mjs`.
- `GET /health` responde `{head, last_backup}`.

**Regras**
- Aceita a gravação só se `expectedSeq == head` e `prevHash == head_hash`.
- Confere a assinatura com a chave pública da sócia.
- Limites:
  - `ct` de até 8 KB (acima disso, 413);
  - até 300 eventos por dia por sócia (429);
  - até 60 requisições por minuto por token.
- CORS só para a origem do portal. Ele não distingue um repositório Pages de outro; a segurança vem do token e da assinatura.
- **Não existe rota de UPDATE nem de DELETE.**

**O que o servidor consegue fazer:** atrasar, negar serviço e esconder eventos recentes. Esconder eventos é detectado pelo piso `journal_head` (§3.10).
**O que não consegue:** ler, forjar, reordenar ou alterar eventos.

### 3.7 O fluxo de uma gravação

1. A sócia salva. `authorize()` e `applyEvent()` rodam sobre o estado atual, com a mesma validação e a mesma mensagem do domínio. Se houver erro, ele aparece **dentro do formulário**.
2. A tela mostra o resultado na hora com o selo "enviando". O evento espera 8 s na **fila de saída**: "Desfazer" nesse intervalo só cancela o envio.
3. O evento é cifrado, assinado e enviado com `POST /append`.
   - 201: o evento fica "aplicado" e entra no Histórico.
   - 409: o cliente baixa o que falta, refaz o fold e reaplica o evento (§3.8).
4. **Sem rede**, o evento continua na fila e o cabeçalho avisa: "1 lançamento na fila — nada se perdeu". Na origem compartilhada, a fila fica **só na memória**, e `beforeunload` avisa se a aba for fechada com itens pendentes. Com domínio próprio (P2), a fila passa a ficar cifrada em IndexedDB.
5. **Leitura**:
   - Na entrada, o portal carrega o pacote e faz `GET /events?after=journal_head`.
   - Depois, consulta `GET /head` a cada 20 s, só com a aba visível, e ao voltar o foco. Com três sócias, isso dá umas 5 mil requisições por dia, bem abaixo do teto do plano Free.
   - O snapshot local continua sendo refeito a cada 2 s, mas só redesenha a tela quando o `content_revision` muda e **nunca com formulário ou folha aberta**. Isso generaliza o `editingPlan` de `app.js:2247`.

### 3.8 Conflitos

O compare-and-swap global por `expected_revision`, que hoje dá `stale_source` a cada gravação concorrente, é trocado por **dois níveis**:

- **Cabeça do diário** (servidor). Inclusões (`add_*`, com ULID gerado no cliente) não dependem umas das outras: num 409 elas são reenviadas sozinhas, sem a sócia perceber.
- **Versão por registro** (domínio). Edição, anulação e parâmetros levam `target.version`. Se outra sócia mexeu antes no registro, abre um diálogo:

  > "Ana mudou este gasto às 14:02 (R$ 400,00 → R$ 450,00). Manter o seu, R$ 480,00, ou ficar com o dela?"

  O formulário não se perde.

As três mutações antigas (`toggle_step`, `edit_plan`, `set_subscription`) passam a endereçar o registro por **id + version**, não mais por posição na lista.

### 3.9 Validação e permissões

O servidor não lê o conteúdo, então **todo cliente e o `montar.mjs` reaplicam os eventos com o mesmo fold determinístico**. Um evento só conta se passar em seis checagens:
1. assinatura;
2. cadeia;
3. esquema;
4. faixa do parâmetro;
5. permissão, pelo papel que está em `state.members`. Isso corrige o achado de que hoje o papel declarado por quem chama não é conferido;
6. período aberto.

Um evento que falha aparece no Histórico como **recusado**, com o motivo, e nunca entra numa conta. Uma ação desconhecida **não é ignorada em silêncio**: aparece o aviso "há registros que esta versão não entende — recarregue". A matriz de permissões está em §4.5.

### 3.10 Auditoria

O diário **é** a trilha de auditoria. Cada evento traz quem, quando (hora do cliente e do servidor), o quê, antes → depois e motivo.

Além disso:
- `applyEvent` passa a registrar o valor anterior também em `edit_plan`, que hoje sobrescreve sem guardar.
- O snapshot passa a exportar `changedAt/changedBy`, que hoje são gravados e nunca mostrados.
- O checkpoint publicado traz `journal_head = {seq, hash}`, que funciona como **piso**. Se o servidor devolver uma cabeça anterior a esse piso, ou um hash que não bate, o cliente avisa "o servidor voltou no tempo".
- O cliente verifica a cadeia inteira e mostra "Íntegro até o registro 1.284".

### 3.11 CSP e origem

**Agora, no GitHub Pages**, o `index.html` gerado passa a ter:

`connect-src 'self' https://<host-exato-do-worker> https://olinda.bcb.gov.br`

O host do BCB serve para a PTAX. Ele foi testado e responde com CORS para `bauerfilho.github.io`.

Meta CSP não aceita `frame-ancestors`. Por isso o `app.js` passa a **bloquear a moldura por script**: se `top !== self`, ele esvazia o documento e para. Isso é obrigatório porque agora há botões que gravam.

Regras que continuam: nada sensível vai para `localStorage` ou IndexedDB, porque `bauerfilho.github.io` é compartilhado por todos os seus sites Pages. O único dado em `localStorage` continua sendo o tema, mais o "tour visto".

**Fase P2:** domínio próprio (Cloudflare Pages com o mesmo Worker), com CSP por cabeçalho incluindo `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.

### 3.12 Compatibilidade com o estado atual e com o AI Cask

**Estado**
- O `schemaVersion` **continua 1**. Tudo o que é novo é **opcional**, com padrão `?? []`.
  - Já testado: o `assertState` atual aceita e preserva coleções desconhecidas.
  - Já testado: um estado sem uma chave obrigatória, como `charges`, é rejeitado. Por isso nenhuma chave nova pode ser obrigatória.
- Entram `state.features` (por exemplo `["expenses@1","parameters@1",…]`) e `DOMAIN_VERSION`. Uma versão antiga da tela, diante de dados que não conhece, mostra um aviso em vez de totais diferentes.
- As regras novas viram **erro só nas coleções novas**: id único, valor ≥ 0, moeda conhecida, competência válida.

**Cache.** O `montar.mjs` passa a publicar `app.js` e `domain.js` com hash no nome, junto com o pacote. O manifesto ganha `minClientVersion`. Assim um app em cache (max-age 600) nunca convive com dados mais novos que ele.

**Quem é dono de cada dado**

| Dado | Dono | Como muda |
|---|---|---|
| membros, participação, papéis, senhas | Mac (`montar.mjs`) | Republicar. A participação ganha `participationHistory` com vigência. |
| expenses, parameters, settlements, closings, income, balances, obligations | **diário** | Eventos |
| plans e selling.steps | Base do Mac + eventos por **id + version** no diário | O evento vale se a versão bate. Senão, "recusado: o plano mudou no Mac". |
| atlas, premissas de cenário do Med Painel, Laboratório | Mac | Como hoje |
| bloco `cash` estático do exportador | Mac | Rotulado "registro importado" e aposentado quando o mês calculado cobrir tudo |

**O `montar.mjs` continua sendo código determinístico, sem IA.** A cada publicação ele:
1. baixa o diário;
2. confere a cadeia e as assinaturas;
3. faz o fold com o **mesmo `domain.js`**;
4. publica o checkpoint com `journal_head`;
5. guarda uma cópia local do diário cifrado no Mac.

Ele nunca descarta um evento aceito.

**AI Cask.** A aba Finanças é um WKWebView que roda o mesmo `app.js`. Ela vira **mais um cliente do diário** pela mesma `journal.js`. Assim não existem dois caminhos de escrita, e nenhuma regra nova precisa ser reescrita em Swift ou Python.

**Plano B, se a D2 for "não gravar online":** o `NativeStore` usa o mesmo formato de evento. A ponte nativa ganha a ação `journal_append`, que acrescenta uma linha a um arquivo JSONL no Mac, com conferência do `seq`, e o `montar.mjs` lê esse arquivo. Só o Mac grava, mas sem IA, e migrar depois para o Worker é só trocar o armazenamento.

> A confirmar no Mac com `descobrir-fonte-no-mac.sh`: se o snapshot da aba Finanças vem do `core.py`. Se vier, a ação `state` em §3.3 é o que permite a página usar o `domain.js`.

### 3.13 Backup e restauração

Três cópias:
- **Cron diário do Worker**, às 03:00 UTC: grava o diário **cifrado** num repositório privado separado (`Bauerfilho/financas-diario-backup`), com um token fine-grained limitado a esse repositório (só `contents:write`). Se o token vazar, expõe só texto cifrado.
- **Cópia local** no Mac, gravada pelo `montar.mjs` a cada publicação.
- **Recuperação no tempo do Durable Object**, de 30 dias. Falta confirmar se vale no plano Free.

A interface oferece "Baixar cópia cifrada", "Baixar cópia legível (JSON)" com aviso, e CSV. **Uma vez por trimestre**, faz-se um teste de restauração no arnês: restaurar e conferir que o `content_revision` é o mesmo.

### 3.14 Custo e manutenção

- **Custo:** R$ 0 por mês. O domínio próprio é opcional, a partir da fase P2.
- **Banco:** nenhum para migrar. O esquema mora no `domain.js` e o servidor guarda só envelopes.
- **Dependências:** nenhuma dependência npm no Worker. Um `wrangler deploy` só é necessário quando o Worker mudar, o que é raro.
- **Se a Cloudflare sair do ar:** o portal volta a ser só leitura, sem perder nada, e o diário está no backup.

---

## 4. Modelo de dados novo e fórmulas

### 4.1 Regras comuns às coleções novas

- **Dinheiro:** sempre `amountMinor` inteiro seguro e ≥ 0, mais uma `currency` presente em `MINOR_DIGITS`. Estorno é anulação, nunca valor negativo. Nenhuma soma mistura moedas sem uma conversão explícita.
- **Decimais exatos:** `{ "num": "54123", "scale": 4 }` representa 5,4123. Percentuais: `{ "num": "35", "scale": 1 }` representa 3,5%.
- **Pesos de rateio:** inteiros na escala do `percent()` atual, em que 100% = 10 000 000 000. Assim 40% = `4000000000` e 33,33333333% = `3333333333`.
- **Datas:** `AAAA-MM-DD` para dias e `AAAA-MM` para competência. O fuso é o de `America/Sao_Paulo`, como em `civilDate`.
- **Identificação:** id em ULID gerado no cliente, `version` inteiro a partir de 1, `createdAt/By`, `changedAt/By`. Nada se apaga: anular grava `voidedAt/By/reason`.
- **Textos:** passam por `safeText`, com uma correção. Uma sequência de 11 dígitos só é mascarada como CPF se os **dígitos verificadores** fecharem: `NF 12345678901` deixa de virar "[dado pessoal omitido]", enquanto 123.456.789-09, um CPF válido, continua mascarado. `docRef` é um campo próprio no formato `[A-Za-z0-9./-]{1,40}`.

### 4.2 Coleções

**`members[].participationHistory`**, mantido pelo `montar.mjs`:

```json
{ "id": "ph-2026-01", "memberId": "bauer", "weight": 4000000000, "validFrom": "2026-01-01",
  "reason": "contrato social", "createdAt": "2026-01-02T12:00:00Z", "createdBy": "bauer" }
```

**`categories`**: um padrão vem embutido no código, e a coleção é opcional.

```json
{ "id": "software_ia", "label": "Software e IA", "group": "custo_fixo", "slot": 1, "active": true }
```

Os slots ficam assim: 1 = Software e IA · 2 = Infraestrutura · 3 = Impostos e taxas · 4 = Contabilidade e jurídico · 5 = Marketing · 6 = Banco e câmbio · 0 = Outros (Pró-labore, Equipamento, Outros). A cor acompanha o slot, não a posição no ranking.

**`expenses`**:

```json
{
  "id": "01JAB3K9Q8M6V2T4X7Z0C1D2E3", "version": 1,
  "date": "2026-10-14", "competence": "2026-10",
  "description": "Anthropic API — créditos", "docRef": "INV-2026-1014",
  "category": "software_ia", "projectId": null,
  "amountMinor": 10000, "currency": "USD",
  "method": "cartao_pj",
  "payer": "empresa", "paidBy": null,
  "reimbursement": { "mode": "nao_aplica", "status": "nao_aplica", "settlementId": null },
  "split": { "mode": "participacao", "weights": null },
  "allocationFrozen": [ { "memberId": "bauer", "weight": 4000000000 },
                        { "memberId": "ana", "weight": 3000000000 },
                        { "memberId": "beatriz", "weight": 3000000000 } ],
  "fx": { "rateParamId": "p-fx-2026-10-16", "spreadParamId": "p-spread-2026-10", "iofParamId": "p-iof-2025-05-23",
          "components": { "principalMinor": 50826, "spreadMinor": 2033, "iofMinor": 1850 },
          "estimatedBrlMinor": 54709, "statementBrlMinor": null, "statementDate": null, "kind": "estimado" },
  "links": { "subscriptionId": null, "chargeId": null },
  "receipt": null,
  "status": "lancado",
  "createdAt": "2026-10-14T15:20:00Z", "createdBy": "ana",
  "changedAt": null, "changedBy": null, "checkedAt": null, "checkedBy": null,
  "voidedAt": null, "voidedBy": null, "voidReason": null
}
```

Valores aceitos em cada campo enumerado:
- `method`: `cartao_pj`, `conta_pj`, `pix_pj`, `boleto_pj`, `cartao_pessoal`, `pix_pessoal`, `dinheiro`.
- `payer`: `empresa` ou `socia`. Com `socia`, `paidBy` é obrigatório.
- `reimbursement.mode`: `empresa_reembolsa`, `dividir_entre_socias`, `aporte`, `nao_aplica`.
- `reimbursement.status`: `pendente`, `reembolsado`, `compensado`, `convertido`, `nao_aplica`.
- `split.mode`: `participacao`, `igual` ou `personalizado`. Os dois últimos usam pesos inteiros.
- `status`: `importado`, `lancado`, `conferido`, `anulado`.
- `receipt`: `{ref, sha256, mime, bytes}`. Nunca `path` nem link assinado.

**`parameters`**: só recebem acréscimos.

```json
{ "id": "p-fx-2026-10-16", "key": "fx.USD_BRL", "value": { "num": "50826", "scale": 4 },
  "validFrom": "2026-10-16", "supersedes": null, "status": "vigente", "legal": null,
  "source": { "label": "PTAX venda BCB 16/10/2026 13:04", "url": "https://olinda.bcb.gov.br/…", "fetchedAt": "2026-10-19T12:00:00Z" },
  "checked": null, "note": "", "createdAt": "2026-10-19T12:00:01Z", "createdBy": "ana",
  "proposedBy": null, "confirmedAt": null, "confirmedBy": null }
```

- `status`: `vigente`, `proposto`, `a_confirmar` ou `substituido`.
- `legal`: `null` ou `{ "status": "sub_judice", "nota": "ADC 96, mérito pendente no STF" }`.
- `checked`: `{ "by": "contador", "at": "2026-10-25" }` quando o contador conferir.
- `value` também aceita `{amountMinor, currency}`, `{enum}` e `{table: [faixas]}`.

**`PARAMETER_CATALOG`**: fica no código, não no estado, e é fechado. Cada chave define unidade, escala, faixa dura (recusa), faixa macia (pede confirmação digitada), salto máximo sem alerta, política de edição, onde é usada e uma explicação em pt-BR.

| Chave | Unidade | Dura / macia | Política | Semente (a confirmar) |
|---|---|---|---|---|
| `fx.USD_BRL`, `fx.EUR_BRL` | R$/moeda, 4 casas | 0,5–50 / 3–10; salto > 20% alerta | qualquer | PTAX venda pelo botão; ex.: 5,0826 em 16/10/2026 |
| `cartao.spread_pct` | % | 0–10 / 0–6 | qualquer | 4,00 (conferir na fatura) |
| `iof.cartao_internacional_pct` | % | 0–10 / 0–6 | quatro olhos | 3,5 desde 23/05/2025, `sub_judice` (ADC 96) |
| `iof.cambio_importacao_servicos_pct` | % | 0–10 | quatro olhos | 0,38 |
| `iof.cambio_ingresso_exportacao_pct` | % | 0–10 | quatro olhos | 0 |
| `imposto.regime` | enum | `simples_III`, `simples_V`, `presumido` | responsável | a informar (D9) |
| `imposto.base` | enum | `bruto`, `liquido_plataforma` | responsável | `bruto` (conferir com o contador) |
| `imposto.simples_efetiva_pct` | % | 0–33 | quatro olhos | 6,0 até existir o cálculo da P2 |
| `simples.anexo_III`, `simples.anexo_V` | tabela | — | responsável | LC 155/2016 (vigência até 31/12/2026) |
| `simples.fator_r_limite_pct` | % | — | responsável | 28 |
| `imposto.iss_pct` | % | 2–5 | quatro olhos | fora do Simples |
| `taxa.hotmart_pct`, `taxa.hotmart_fixa` | %, R$ | 0–30 / 0–R$ 20 | quatro olhos | 9,9% + R$ 2,49 desde 21/09/2026 |
| `taxa.stripe_pct`, `taxa.stripe_fixa`, `taxa.stripe_internacional_pct` | %, R$ | — | quatro olhos | 3,99% + R$ 0,39; +2% |
| `taxa.apple_pct`, `taxa.google_pct` | % | 0–35 | quatro olhos | 21 / 10 (+5 IAP) desde 18/06/2026; Google 15 |
| `custo.contador_mensal`, `custo.servidor_usd_mensal`, `custo.apple_dev_usd_anual` | dinheiro | — | quatro olhos | 0; US$ 11; US$ 99 |
| `teto.<categoria>.<moeda>` | dinheiro | — | quatro olhos | a definir |

**Parâmetro × premissa.** *Parâmetro* é um fato com fonte. *Premissa* é uma aposta de cenário e continua no Med Painel. Os valores padrão fixos hoje em `app.js:1688-1711` (câmbio 5,3; taxa 4,69% + R$ 0,50; imposto 6%; servidor; Apple; contador) passam a ler o parâmetro vigente. Quando um valor cair no padrão do código, ele aparece com o selo **"padrão do código"**.

**`income`**: só agregados, sem nomes.

```json
{ "id": "01JAD…", "version": 1, "competence": "2026-10", "channel": "hotmart", "productId": "med-painel",
  "grossMinor": 239600, "currency": "BRL", "transactions": 40, "feesMinor": null,
  "payersActive": 40, "payersNew": 12, "payersLost": 2, "signups": 85, "status": "lancado",
  "createdAt": "…", "createdBy": "bauer" }
```

**`balances`** guarda o saldo bancário informado pelas sócias e alimenta o fôlego:

```json
{ "id": "01JAE…", "account": "conta_pj_principal", "date": "2026-10-18", "amountMinor": 2176500,
  "currency": "BRL", "source": "extrato", "createdAt": "…", "createdBy": "ana" }
```

**`settlements`** registra reembolsos, acertos e aportes:

```json
{ "id": "01JAF…", "date": "2026-10-20", "kind": "acerto_entre_socias", "from": "ana", "to": "bauer",
  "amountMinor": 13500, "currency": "BRL", "method": "pix", "expenseIds": ["01JAB…"],
  "createdAt": "…", "createdBy": "ana", "confirmedAt": null, "confirmedBy": null }
```

`kind` pode ser `reembolso_empresa`, `acerto_entre_socias`, `aporte` ou `retirada`.

**`closings`**:

```json
{ "month": "2026-10", "status": "fechado", "journalSeq": 412,
  "totals": { "native_by_currency": { "BRL": 50990, "USD": 12000 }, "realized_brl": 116641, "forecast_brl": 22206,
              "income_net_brl": 191544, "result_brl": 52697, "fx_variance_brl": 271,
              "by_category": { "software_ia": 87857, "contabilidade": 45000, "infra": 5990 },
              "by_member_share": { "bauer": 55539, "ana": 41654, "beatriz": 41654 } },
  "allocationFrozen": [ … ], "paramIds": [ "p-fx-2026-10-16", "p-spread-2026-10", "p-iof-2025-05-23" ],
  "expenseVersions": [ { "id": "01JAB…", "version": 2 } ], "incomeVersions": [ … ],
  "hash": "sha256:81babb05df4d…", "closedAt": "2026-11-03T13:00:00Z", "closedBy": "bauer", "reopened": [] }
```

O `hash` é SHA-256 do JSON canônico, com as chaves em ordem. Já foi testado que ele não depende da ordem em que as chaves aparecem.

**`plans`**, que já existe, ganha `version`, `category` e `archivedAt/By`. Passa a ser endereçado por id.

**`obligations`** (P2), para prazos: `{id, title, rule: "mensal:20" | "data:2026-10-30", source, note}`.

### 4.3 Snapshot

O `buildSnapshot` ganha estes blocos:

- `blocks.expenses = {entries[], summary{by_category, by_payer, by_currency, incomplete}}`. Cada entrada traz `personal_amount_minor`, `brl_minor`, `brl_kind`, `paid_by_nome`, `category_label`, `issues[]`, `permissions`.
- `blocks.parameters = {current[], history{key:[]}, missing[], proposals[], uses{}}`.
- `blocks.month`:
  - `competence` e `state`;
  - `headline{realized, committed, cash, runway, my_share, attention}`;
  - `committed[]` e `realized[]` por moeda, com `brl_minor` e `fx_ref`;
  - `by_category[{id,label,slot,brl_minor,pct_permil}]`;
  - `by_payer`;
  - `by_member[{id,nome,share_minor,advanced_minor,balance_minor}]` e `transfers[]`;
  - `series12m[{mes, in_brl_minor, out_brl_minor, end_brl_minor, closed, projected}]`;
  - `runway{cash_brl_minor, burn_brl_minor, months_tenths, base_months}`;
  - `budget[]`, `incomplete[]`, `fx_used[]`;
  - **`explain{}`**, com a conta de cada total (§4.4).
- `blocks.settlement`, `blocks.income`, `blocks.closing{months[], checklist}`.
- `blocks.history{entries, rejected, integrity}`.
- `blocks.permissions{role, can, reasons}`.
- `blocks.ops{domainVersion, checkpointSeq, head, queue, lastBackup}`.
- `blocks.user.summary` ganha `personal_expenses_month`, `reimbursement_due` e `settlement_balance`.
- `blocks.user.plans[]` passa a exportar `changedAt/By`.
- `blocks.medpainel` passa a receber `fixed_monthly`, `incomplete_costs` e `parametros`.

Tudo isso fica coberto automaticamente pelo `content_revision`.

### 4.4 Funções puras novas (em `domain.js`, testadas em `dados-primeiro-prototipo.mjs`)

| Função | Faz |
|---|---|
| `parseMoneyBR(texto, moeda)` | Em BRL, vírgula é o separador decimal e ponto seguido de exatamente 3 dígitos é separador de milhar. `'1.500'` dá 150000. `'1.50'` dá erro "use vírgula para centavos". `'12,345'` dá erro "no máximo 2 casas". Em USD vale o formato americano. Na interface, o caminho principal é a **máscara em centavos**, que envia `amount_minor` inteiro; o parser fica só para colagem. |
| `paramAt(chave, data)` | Devolve a entrada vigente de maior `validFrom ≤ data` que não foi substituída. |
| `convertMinor(A, de, para, câmbio, spread, iof)` | Em BigInt, arredonda **uma** vez e devolve `{principal, spread, iof, total}`. |
| `allocateByWeights(total, pesos)` | Maior resto com desempate pelo índice. A soma é exata (2000 casos). O `allocateMinor` continua para o legado. |
| `monthlyLedger(state, mês, hoje)` | Gera `blocks.month`. |
| `settle(expenses)` | Devolve os saldos de acerto e as transferências sugeridas. |
| `runway(state, hoje)` | Calcula o fôlego. |
| `closingHash(fechamento)` | SHA-256 do JSON canônico. |
| `explain(...)` | Gera `{formula_texto, termos[{rotulo, amount_minor, moeda, op, ref{tipo,id,data,autor}}], resultado, excluidos[{id,motivo}]}`. É produzida **pela mesma função que calcula o total**, então nunca diverge do número. |
| `authorize(ação, payload, autoraId, state)` | Usa o papel que está no estado, nunca o declarado. |
| `applyEvent`, `foldJournal` | Puras e determinísticas. `foldJournal` devolve `{state, rejected[]}`. |

### 4.5 Mutações e permissões

| Ação | Quem pode | Efeito |
|---|---|---|
| `add_expense` | Qualquer sócia, em nome próprio. A responsável pode lançar por outra. | Novo gasto, idempotente pelo id. Congela `allocationFrozen` e os parâmetros de câmbio. |
| `edit_expense` | A autora, enquanto o gasto estiver `lancado` e o mês aberto. A responsável em qualquer gasto de mês aberto, com motivo visível à autora. | Nova versão, com antes e depois registrados. |
| `void_expense` | Igual a `edit_expense`. O motivo é obrigatório. | Status `anulado`. O gasto sai dos totais e continua visível. |
| `check_expense` | Qualquer sócia que não seja a autora. | Status `conferido`. |
| `set_statement_value` | A autora ou a responsável. | Grava o valor efetivo da fatura. |
| `set_parameter` em `fx.*` ou `cartao.spread_pct` | Qualquer sócia. | Nova vigência. |
| `propose_parameter` / `confirm_parameter` nas demais chaves | Qualquer sócia propõe. Outra sócia confirma, ou a responsável aplica direto. | A proposta só passa a valer depois de confirmada. |
| `correct_parameter` | Mesma política da chave. | Nova entrada com `supersedes`. |
| `add_plan`, `confirm_plan`, `archive_plan`, `edit_plan` (agora com período e dia de vencimento) | Qualquer sócia propõe. A responsável aplica. | Acaba a edição manual do arquivo de planos. |
| `record_payment` (marcar como paga) | Qualquer sócia. | Cria um gasto ligado pelo `subscriptionId` e marca a cobrança como paga. |
| `add_income`, `edit_income`, `void_income` | A responsável (ver D3). | Receitas agregadas. |
| `set_balance` | Qualquer sócia. | Novo saldo informado de uma conta. |
| `record_settlement` / `confirm_settlement` | Quem paga registra. Quem recebe confirma. | Marca os gastos como `reembolsado` ou `compensado`. |
| `convert_to_contribution` | A autora do gasto. | O gasto pago do bolso passa a contar como aporte dela. |
| `close_month` / `reopen_month` | A responsável. | Fechar congela o mês. Reabrir exige motivo. |
| `toggle_step`, `set_subscription` | Qualquer sócia, como hoje. | Agora por id + version. |
| Participação, membros, senhas | Só o Mac. | Republicação. |

### 4.6 Fórmulas

Todo arredondamento é feito **uma vez**, meio para longe do zero, como o `roundedRatio` atual.

- **F1. Equivalente mensal de um plano.** `mensal = arred(valor × a ÷ b)`, pela tabela `PERIODS` atual. Exemplo: anual de US$ 99 ÷ 12 = US$ 8,25 por mês.
- **F2. Parâmetro vigente.** `paramAt(k, d)` devolve a entrada com status `vigente`, não substituída e de maior `validFrom ≤ d`. Cada lançamento usa os parâmetros **da data dele**.
- **F3. Conversão.**
  - `total = arred(A × c × (1 + s) × (1 + i))`, `principal = arred(A × c)`, `spread = arred(A × c × s)` e `IOF = total − principal − spread`. Os três componentes sempre fecham com o total; isso foi testado em 714 valores.
  - **Cartão:** c = PTAX de venda do dia da compra, s = spread do emissor, i = 3,5%.
  - **Câmbio para pagar serviço importado** (remessa ou boleto de câmbio): s = 0 e i = 0,38%.
  - Vetores de teste:
    - US$ 100,00 a 5,4123, sem spread, IOF 3,5%: **R$ 560,17** = 541,23 + 18,94.
    - US$ 100,00 a 5,41, spread 4%, IOF 3,5%: **R$ 582,33** = 541,00 + 21,64 + 19,69.
    - Remessa de US$ 1.000,00 a 5,41 com IOF de 0,38%: **R$ 5.430,56**.
- **F4. Reais de um gasto.** Usa o valor **efetivo** (fatura); na falta, o **estimado** (F3); na falta dos dois, marca "sem câmbio". Nesse caso o gasto vai para `incomplete`, **nunca entra como zero**. Variação cambial = efetivo − estimado.
- **F5. Realizado(m).** Soma, em reais (F4), dos gastos com `competence = m` e status diferente de `anulado`.
- **F6. Previsto(m).** Soma do mensal (F1) convertido (F3) dos planos **ativos e confirmados** que **não têm** gasto ligado pelo `subscriptionId` em m. Quando o gasto existe, ele substitui a previsão, para não contar duas vezes. **Custo do mês = realizado + previsto.** Assinatura inativa não entra e não tem "sua parte" (corrige `domain.js:191-201`).
- **F7. Taxa de plataforma.** `arred(bruto × pct) + n × fixa`, com os parâmetros do canal vigentes na competência. Se o valor do extrato for informado, ele vale.
- **F8. Imposto no Simples.**
  - `imposto = arred(base × efetiva)`, com `efetiva = (RBT12 × nominal − dedução) ÷ RBT12`.
  - **RBT12** é a receita bruta dos 12 meses fechados anteriores.
  - Anexo III se o **fator R** (folha de 12 meses ÷ RBT12) for de pelo menos 28%; senão, Anexo V.
  - Exemplos com RBT12 de R$ 300.000:
    - folha de R$ 90.000: fator R de 30%, Anexo III faixa 2 (11,2% − R$ 9.360), efetiva **8,08%**;
    - folha de R$ 60.000: fator R de 20%, Anexo V faixa 2 (18% − R$ 4.500), efetiva **16,50%**.
  - Até a fase P2, vale `imposto.simples_efetiva_pct`, informado à mão.
- **F9. Resultado.** Receita líquida = bruto − taxas − imposto. Resultado = receita líquida − custo do mês.
- **F10. Parte da sócia.** `allocateByWeights(total, pesos)`, com os pesos congelados no lançamento ou no fechamento.
- **F11. Acerto entre sócias.**
  - `saldo_i` = soma do que i pagou em gastos `dividir_entre_socias` pendentes − soma da parte de i nesses gastos.
  - **A soma dos saldos é 0.**
  - Transferências sugeridas: o maior devedor paga o maior credor, repetindo até zerar; no máximo n−1 transferências.
- **F12. A receber da empresa.** `devido_i` = soma, em reais, dos gastos de i com `empresa_reembolsa` pendentes − soma dos reembolsos recebidos por i.
- **F13. Fôlego.**
  - `caixa_BRL ÷ queima média`.
  - `caixa_BRL` = soma do último saldo de cada conta, convertido com o parâmetro da data do saldo.
  - `queima média` = média de (saídas − entradas) dos últimos min(3, N) meses **fechados**, com o rótulo "média de N meses".
  - Queima ≤ 0 mostra "sem queima de caixa". N = 0 mostra "precisa de 1 mês fechado"; o portal nunca inventa o número.
  - Exemplo: R$ 21.765,00 ÷ R$ 2.366,00 por mês = **9,2 meses**.
- **F14. Teto.** `pct_bp = real × 10000 ÷ teto`, na mesma moeda. Faixas em 80% (aviso) e 100% (estouro).
- **F15. Percentuais de composição.** `allocateByWeights(1000, valores)`, em milésimos, para que os percentuais exibidos somem exatamente 100,0%.
- **F16. Selo do mês.** SHA-256 do JSON canônico de `{month, totals, allocationFrozen, paramIds, expenseVersions, incomeVersions, journalSeq}`.

**Exemplo trabalhado: outubro de 2026.** Os dados são fictícios e as sócias são as do arnês (Bauer 40%, Ana 30%, Beatriz 30%). O câmbio é a PTAX de venda real de 16/10/2026, R$ 5,0826, com spread de 4% e IOF de 3,5%. Todos os números foram conferidos por `plano-contas.mjs`.

| Item | Original | Em reais | Observação |
|---|---|---|---|
| Anthropic API, cartão PJ, 14/10 | US$ 100,00 | R$ 547,09 = 508,26 + 20,33 + 18,50 | estimado; a fatura veio R$ 549,80, variação **+R$ 2,71** |
| Vercel Pro, cartão PJ, 05/10, ligado ao plano | US$ 20,00 | R$ 109,42 | substitui a previsão do plano |
| Contador, pago pelo Bauer do bolso, dividir entre sócias | R$ 450,00 | R$ 450,00 | entra no acerto |
| Domínio, pago pela Ana por Pix pessoal, empresa reembolsa | R$ 59,90 | R$ 59,90 | a empresa deve R$ 59,90 à Ana |
| Figma lançado em duplicidade (anulado) | — | — | fora dos totais, visível no Histórico |
| **Realizado** | BRL 509,90 + US$ 120,00 | **R$ 1.166,41** | |
| Previsto: Figma (US$ 15,00) + Google Workspace (R$ 140,00) | | **R$ 222,06** | planos ainda não pagos no mês |
| **Custo do mês** | | **R$ 1.388,47** | Software e IA 878,57 · Contabilidade 450,00 · Infraestrutura 59,90 |
| Parte de cada sócia (40/30/30, maior resto) | | Bauer 555,39 · Ana 416,54 · Beatriz 416,54 | soma exata |
| Receita Hotmart: 40 × R$ 59,90 | | R$ 2.396,00 | taxa 9,9% + 40 × R$ 2,49 = R$ 336,80; Simples 6% = R$ 143,76 |
| **Resultado** | | **R$ 1.915,44 − 1.388,47 = R$ 526,97** | partes 210,79 / 158,09 / 158,09 |
| Acerto do contador | | Bauer +270,00 · Ana −135,00 · Beatriz −135,00 | sugestão: Ana → Bauer 135 e Beatriz → Bauer 135 |

---

## 5. Funcionalidades por página

**P0** é o pedido de ponta a ponta: lançar, editar parâmetros, ver o mês calculado, gráficos e cores, e registro de tudo. **P1** é a rotina e a profundidade. **P2** é o fiscal fino, as simulações e o conforto. Esforço: **P** até uns 3 dias, **M** até 2 semanas, **G** mais que isso.

| Página | O que entra | Dados | Visual | Didática | Prio. | Esforço |
|---|---|---|---|---|---|---|
| **Correções de exatidão** (transversal) | `parseMoneyBR`; `mpRepartir` em inteiros (hoje 41.088 trios de uma casa falham); `fixed_monthly` e `incomplete_costs` injetados no Med Painel (hoje aparece "empresa R$ 0"); inativas sem "sua parte"; dia 31 vira fim de mês; `nextDate` pago avança; o `source` estático deixa de sobrescrever o calculado; CPF só mascarado com dígito verificador; plural "1 cobrança vencida" | `domain.js`, `app.js` | Estouro do teto vermelho também no claro (`tema.css:104` ganha `.over-budget`); indicador da entrada (`style.css:3` → `>span:first-child`); data do alerta do Caixa no canto | Cada correção vira uma linha datada no Histórico: "1.500 agora é mil e quinhentos" | P0 | P |
| **Controles honestos** (Assinaturas, Vender primeiro, Portfólio) | Sem `capabilities`, controles desabilitados com motivo; com gravação, liberados ação por ação; mensagem de saída verdadeira | `blocks.permissions`, `financeHost.capabilities` | Contorno, cadeado de 14px, nota de 12px; sem vermelho, porque não é erro | "Para mudar agora: aba Finanças do AI Cask", até a gravação chegar | P0 | P |
| **Cabeçalho** (global) | Indicador de sincronia no lugar de "Dados compartilhados"; botão **+ Lançar**; o "?" ganha "Como ler as cores"; bloqueio de moldura | cabeça e fila do diário, `blocks.ops` | Ponto com texto: verde "Sincronizado 14:02" · ouro "1 na fila" · cinza "Sem conexão" · vermelho "2 recusados" | O estado sempre por extenso; o clique abre Estado do portal | P0 | P |
| **+ Lançar** (folha: botão no desktop, topo da gaveta, botão flutuante de 56px até 620px; rota `#lancar`) | Valor primeiro, com máscara em centavos e teclado numérico; descrição com autocompletar (escolher "Vercel" preenche categoria, moeda, forma e plano ligado); 8 chips de categoria; Hoje / Ontem / Outra data; quem pagou ("eu" por padrão); Como (cartão PJ · Pix/boleto PJ · do meu bolso, reembolsar · do meu bolso, aporte · dividir); moeda; "mais opções" (competência, nº do documento, projeto, nota); **Salvar** e **Salvar e lançar outro** | `add_expense`, `convertMinor`, `paramAt` | Valor em serifa de 40px com tabular-nums; folha que sobe de baixo no celular, diálogo de 520px no desktop; prévia ao vivo: "US$ 100,00 × 5,0826 = R$ 508,26 · spread 4% R$ 20,33 · IOF 3,5% R$ 18,50 · ≈ R$ 547,09 estimado"; "Sua parte R$ 218,83 · entra em outubro · Software e IA" | Valor também por extenso ("mil e quinhentos reais"); aviso de duplicata ("Ana lançou algo igual em 17/10"); um exemplo de uma linha para reembolso, divisão e aporte | P0 | M |
| **Lançamentos** (nova; `#lancamentos?mes=2026-10&socia=ana`) | Extrato por mês com filtros (sócia, categoria, moeda, forma, estado) e o atalho "Só os meus"; ficha com histórico; editar, anular com motivo, conferir, ligar a assinatura, informar fatura; totais por moeda e ≈ R$ | `blocks.expenses` | Tabela com números à direita no desktop; cartões de duas linhas no celular; pílulas Lançado (contorno), Conferido ✓, Reembolso pendente (ouro), Anulado (riscado) | "Cada moeda aparece separada; o R$ usa o câmbio do dia do gasto"; estado vazio que convida a lançar | P0 | M |
| **Parâmetros** (nova; `#parametros/fx.USD_BRL`) | Grupos Câmbio · IOF · Impostos · Taxas de venda · Custos de referência · Tetos. Cada linha: valor e unidade, "vale desde", autora, fonte, estado (vigente / proposto / sub judice / a confirmar / conferido pelo contador em dd/mm) e "onde é usado". Ações: Nova vigência, Corrigir, **Atualizar pela PTAX**, Confirmar proposta, **Testar sem salvar** (funciona até no portal só de leitura) | `parameters`, catálogo, `monthlyLedger` com o valor candidato | Valor em serifa de 26px; histórico em degraus (SVG) com a autora de cada degrau; proposta com borda ouro tracejada; Δ com sinal tipográfico e ▲▼ | Cada parâmetro diz o que é, onde entra e quem define; prévia antes de salvar: "outubro sobe R$ 41,20; meses fechados não mudam"; frase-guia: parâmetro × premissa | P0 | G |
| **Histórico** (nova) e **Desfazer** (global) | Aviso de 8 s "Lançado: R$ 450,00 · Contador — Desfazer"; depois disso, o evento inverso; linha do tempo com filtros por sócia e tipo; "Reverter", quando a pessoa pode; seção **Recusados** com o motivo; "Íntegro até o registro N" | diário, `blocks.history` | Agrupado por dia (data em serifa); inicial da sócia; verbo em português; valor antigo riscado → novo | "Corrigir nunca apaga: cria um registro novo" | P0 | M |
| **Meu painel** | **Manchete do mês**: frase gerada por modelo de texto fixo, sem IA. 4 números: Saiu este mês · Comprometido por mês · Caixa · Fôlego. O herói fica (sua parte × empresa) e ganha "≈ R$ 1.388,47 no mês · estimado". **Para onde vai o dinheiro**: ranking por serviço com a sua parte marcada. Régua do mês com vencimentos. Contadores com valor ("2 cobranças em 7 dias · US$ 35,00") que filtram Assinaturas. "O que você adiantou" e "Seu saldo no acerto". "Mudanças recentes" das outras sócias | Fase P0: `summary.*`, `plans[].monthly_amount_minor`, `billing.charges`; depois `blocks.month.headline` | Ouro só para "sua parte"; cifras em serifa de 40px; moeda original em 13px embaixo; vencido ! em perigo, ≤ 7 dias ◷ em aviso; minigráfico de 12 meses (fechados sólidos, mês aberto hachurado) | Cada trecho da manchete é um link para o gráfico; "Fôlego" tem glossário; sem dado, aparece "precisa de 1 mês fechado" | P0 (com os dados atuais) → P1 (com o mês calculado) | M |
| **Caixa = o mês calculado** (`#caixa/2026-10`) | Seletor de mês; resumo por moeda (entrou, saiu, saldo) com ≈ R$ opcional; custo do mês = realizado + previsto; composição por categoria; Razão; incompletos; o bloco estático vira "registro importado". Na fase P1: fluxo de 12 meses, cascata, fôlego, saldos informados | `monthlyLedger` → `blocks.month`, `balances` | Barra 100% por categoria; **bullet** de teto no lugar do `<progress>`; P1: barras divergentes (entrou ↑ azul, saiu ↓ vinho, linha de saldo ouro, futuro hachurado) e cascata (receita → taxas → impostos → custos → resultado → sócias); grade com alturas naturais | Legenda única: sólido = pago, contorno = estimado, hachura = previsto; frase do mês ("Outubro: R$ 1.388 de custos, 84% já pagos; Software e IA é 63%") | P0 (composição e razão) · P1 (fluxo, cascata, fôlego) | G |
| **Fechamento** (aba do Caixa; `#caixa/2026-10/fechar`) | Roteiro de 6 passos: todas lançaram? (com "Lembrar", que copia uma mensagem pronta) · conciliar faturas em moeda estrangeira · conferir pendentes · reembolsos · revisar parâmetros usados · **Fechar e exportar**. Reabrir só a responsável, com motivo | `closings`, `closingHash` | Etapas 01–06 em serifa com barra de progresso; selo "Outubro fechado por Bauer em 03/11 · 81babb05" com cadeado; cadeado no eixo do gráfico de 12 meses | "Fechar é assinar o livro do mês: os números não mudam mais, nem se o dólar mudar"; cerca de 10 minutos no total | P1 | M |
| **Assinaturas** | Cabeçalho com total mensal e anual da empresa e seu; ranking pelo equivalente em R$; alternância cartões ↔ tabela ordenável; o custo mensal **da empresa** por plano (já vem no snapshot e não aparece); inativas recolhidas e sem sua parte; "Alterado por X em dd/mm". P1: **Nova**, **Confirmar**, **Encerrar**, **Marcar como paga** (separada do Status livre) | `plans`, `record_payment`, `add_plan`, `confirm_plan`, `archive_plan` | Barras horizontais com cor por categoria e número na ponta; o cartão vencido ganha filete de 3px **e** selo "! Vencida" nos dois temas; pílulas com a mesma forma nos dois temas | "Anual de US$ 99 ÷ 12 = US$ 8,25 por mês"; "Confirmar = os dados batem com a fatura" | P0 (resumo, ranking, correções) · P1 (ações) | M |
| **Conciliação e PTAX** (Parâmetros + Lançamentos) | "Atualizar pela PTAX" (último dia útil, com a data à vista; no EUR, filtra o boletim de fechamento); "Conciliar fatura" por mês e cartão: valor cobrado de cada item, ou o total rateado pelo maior resto | `set_statement_value`, API Olinda | Estimado em itálico com contorno, efetivo sólido; Δ cambial com sinal | "Por que o banco cobrou diferente? Spread do emissor + IOF; a PTAX é a referência" | P1 | M |
| **Sociedade** (acerto) | Barra de participação com vigência; quadro adiantou · parte · saldo por sócia; "quem paga quem"; "Reembolsar" (responsável) e "Recebi" (sócia); aportes acumulados; aviso quando a participação não fecha 100% (`allocation_balanced` já chega e não é usado); histórico importado (hoje nunca aparece); conteúdo de "Minha equipe" com os papéis | `settle()`, `settlements`, `participationHistory` | Barras divergentes: a receber em azul, a pagar em vinho, sempre com sinal; participação em tons neutros | Exemplo: "Bauer pagou o contador (R$ 450). A parte dele é 40% (R$ 180); Ana e Beatriz devem R$ 135 cada" | P1 | M |
| **Receitas** (no Caixa) | Lançamento mensal por canal e produto: bruto, transações, pagantes ativos, novos e perdidos, cadastros; taxas pelos parâmetros ou pelo extrato | `income` | Receita acima do zero no fluxo; cascata "para onde vão R$ 100 de receita" | Taxa e imposto com "Ver a conta" | P1 | M |
| **Exportar** (Lançamentos, Parâmetros, Fechamento, Histórico) | CSV gerado no navegador: lançamentos do filtro · parâmetros com histórico · **pacote do contador** do mês fechado · histórico | — | Menu "Exportar ▾" | "O contador abre no Excel; vêm os centavos exatos e o valor formatado lado a lado". Separador `;`, vírgula decimal, UTF-8 com BOM, `valor_centavos` inteiro, células começando com `= + - @` levam apóstrofo | P0 (lançamentos e parâmetros) · P1 (pacote do contador) | M |
| **Ver a conta** e **glossário** (transversal) | "Ver a conta" em todo número calculado (amplia o `sourceWhy` de `app.js:210`, hoje só em 2 números); glossário clicável (rateio, equivalente mensal, competência, comprometido × realizado, PTAX, spread, IOF, fôlego, queima, RBT12, fator R, alíquota efetiva, churn, CAC, aporte, teto) | `explain{}` | Popover no desktop, folha no celular; termos em grade rótulo / operador / valor; total com fio duplo; termos são links para o gasto ou parâmetro | Exemplo: "US$ 100,00 × 5,0826 (PTAX 16/10, BCB, atualizada por Ana) = R$ 508,26; + spread 4% R$ 20,33; + IOF 3,5% R$ 18,50; = R$ 547,09" | P0 (campos atuais) · P1 (blocos novos) | M |
| **Navegação** (gaveta e rotas) | Grupos DINHEIRO (Meu painel, Caixa, Lançamentos, Assinaturas, Parâmetros) · PLANEJAR (Med Painel, Projeção, Vender primeiro) · EMPRESA (Sociedade, Portfólio, Usuários e pagantes, Laboratório) · AJUDA (Histórico, Como fazer, Estado do portal); rotas por hash com `pushState` (Voltar funciona; o link direto abre a página certa depois da senha); atalhos do PWA "Lançar gasto" e "Lançamentos"; um registro único de páginas no lugar dos 5 pontos atuais | `location.hash` guarda só filtros | Eyebrow por grupo, numeração mantida, "+ Lançar" no topo | O agrupamento ensina o mapa do portal | P1 | P |
| **Como fazer**, **modo treino** e **primeiro acesso** | Treino: tudo funciona sobre uma cópia em memória, com a faixa "Treino — nada é salvo" (vem do `?escrita=1` do arnês). Primeiro acesso em 4 telas que podem ser puladas. Tarefas: Lancei errado · Paguei do meu bolso · O dólar mudou · Chegou a fatura · Fechar o mês · Mandar ao contador · Assinatura nova · Esqueci a senha | `financeHost.treino` | Faixa com hachura ouro; diálogos de 520px com diagramas SVG | Frases curtas em "você", cada uma terminando num botão que faz a coisa | P1 | M |
| **Estado do portal** | Versão do app e do domínio, checkpoint e `journal_head`, eventos desde então, fila, recusados, último backup, parâmetros desatualizados (dólar com mais de 7 dias), aviso de versão antiga; corrige o `stale` sempre falso | `blocks.ops`, `/health` | Lista com ponto e texto | Cada item vermelho traz o passo seguinte, sem precisar do Mac | P1 | P |
| **Vender primeiro** | Fim do corte em 3 produtos; barra de progresso por produto; "marcado por X em dd/mm"; caixinhas pelo diário | `selling.steps` por id | `.budget-progress` reaproveitado | — | P1 | P |
| **Med Painel** | P0: correções (custo fixo, `mpRepartir`, eixo X proporcional, um tab stop por gráfico, a mesa de teste deixa de ser recriada, ajuda sem caminhos do Mac). P2: câmbio, imposto e taxas vindos dos Parâmetros; selo "padrão do código"; **simulador "e se"** sem salvar (Δ assinantes no mês 12, Δ mês da meta, Δ aporte); área por canal (`linhas[].canais`, hoje descartado); aporte acumulado com o vale do caixa; cascata dos R$ 59,90; LTV/CAC | `blocks.medpainel.parametros`, `projetarMedPainel(block, cenário, overrides)` | Cenário escolhido em ouro, os outros em contexto; aporte em vinho | "Precisamos aportar no total R$ X; o caixa fica positivo no mês N" | P0 (correções) · P2 | G |
| **Impostos** (Parâmetros + Caixa) | Alíquota efetiva calculada (F8), fator R, DAS estimado; calendário fiscal (30/10/2026, 01/11/2026, 01/01/2027 com novos anexos e CBS cheia) com .ics gerado no navegador; comparador Simples III × V × Presumido | `income`, categoria pró-labore, tabelas com vigência, `obligations` | Termômetro do fator R com marca em 28%; faixa atual destacada | Tudo com "confirmar com o contador"; "o portal informa, não aconselha" | P2 | M |
| **Projeção** | Uma só projeção, com o motor do Med Painel; a base são os meses fechados | médias de 3 meses fechados | Real sólido, projeção hachurada | Diz de quais meses fechados a base saiu | P2 | M |
| **Usuários e pagantes** (nova) | Funil cadastro → teste → pagante por produto; MRR; churn; só agregados | `income` | Funil em barras horizontais | — | P2 | M |
| **Portfólio** e **Laboratório** | Distribuição por destino e prontidão; "quanto este projeto custa" (`expenses.projectId`); decisão de destino pelo diário (responsável); catálogo nativo do Laboratório com o chip gratuito/pago antes do iframe | atlas, `expenses` | Reaproveita `.asset-destino` | — | P2 | M |
| **Comprovantes cifrados** | Foto ou PDF cifrado no navegador (AES-GCM, chave derivada da chave do diário com HKDF, rótulo "anexos"), até 5 MB, no R2 | `receipt{ref, sha256, mime, bytes}` | Miniatura de 48px; clipe na lista | Selo "comprovante íntegro" quando o sha256 confere | P2 | M |
| **Entrar com Face ID** (domínio próprio) | Passkey com a extensão PRF desembrulha as chaves; "Sair de todos os aparelhos" revoga o token | WebAuthn PRF → HKDF | Opção discreta abaixo da senha | "Seu rosto destrava só este aparelho" | P2 | G |

---

## 6. Sistema visual

### 6.1 Identidade mantida

Fica tudo o que já define o portal:
- serifa (Iowan, Palatino, Georgia) em títulos e cifras, sans (Avenir) no texto;
- tema claro creme `#f4f3ee` com cartões brancos e sombra (o padrão), tema escuro verde-floresta `#0c1913` / `#14271d`, ouro como acento;
- numeração da gaveta e raios de 18 / 14 / 10 / 999px;
- só fontes do sistema (`font-src 'none'`) e **nenhuma biblioteca externa**, porque o CSP proíbe CDN.

O **ouro fica reservado ao destaque**: sua parte, resultado, cenário escolhido e linha de saldo.

### 6.2 Tokens semânticos

Os tokens do tema escuro ficam em `:root`, depois de `style.css:41`. Os do claro ficam em `:root[data-tema=claro]` em `tema.css` (o atributo é `data-tema`). Os `--mp-*` saem de `.mp-root` e passam a ser globais. `--tinta-suave`, `--line-strong` e `--sombra` passam a existir também no tema escuro. O contraste foi medido sobre `#ffffff` no claro e `#14271d` no escuro.

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| `--fin-entrada` | `#2f6db0` (5,34:1) | `#4f86c9` (4,18:1) | Entrou, receita, a receber |
| `--fin-saida` | `#9e3d5c` vinho (6,41:1) | `#c9607f` (4,08:1) | Saiu, aporte, a pagar, excesso (com sinal −, ▼ e hachura) |
| `--fin-destaque` | `#b07c10` (3,66:1) | `#bd8a24` (5,10:1) | Sua parte, resultado, cenário escolhido. **Só marca de gráfico, nunca texto** (no texto, `--gold` `#8d6d26` / `#cfac69`) |
| `--fin-contexto` | `#858a84` (3,52:1; antes 2,26) | `#7f8a80` (4,37:1; antes 2,95) | Séries de contexto, "Outros". A proposta 2 sugeria `#8f948e`, que dá 3,09 no branco mas só 2,78 no creme da página. `#858a84` passa nos dois (3,17 no creme) |
| `--fin-ok` ✓ | `#2f6b3f` (6,37:1) | `#a2cd83` (8,67:1) | Pago, conferido. Unifica o verde escrito à mão em `.subscription-state` |
| `--fin-aviso` ◷ | `#8a5a00` (5,93:1) | `#e3b65c` (8,31:1) | Vence em até 7 dias, faixa de 80% |
| `--fin-perigo` ! | `#a63a28` (6,45:1) | `#edb4a7` (8,74:1) | Vencido, estouro, recusado. **Só selo e texto, nunca preenchimento de gráfico** |
| Categorias 1–6 | `#2f6db0` `#c4572e` `#1f8a70` `#6a5acd` `#7a6a00` `#a8478c` | `#4f86c9` `#cf6a40` `#2e9a7e` `#8a7be0` `#a08a12` `#c25aa3` | Azul, terracota, petróleo, violeta, oliva, ameixa; "Outros" usa `--fin-contexto` |

**Regras que nascem das medições** (validador `validate_palette.js` da skill de visualização, com simulação de daltonismo):
- **Laranja ou terracota nunca significa "saída".** Com deuteranopia, ficam a ΔE 3,7 do ouro. A saída é vinho.
- **`--fin-perigo` nunca preenche gráfico.** Vinho e perigo ficam a ΔE 7,0 entre si.
- **Os três estados (ok, aviso, perigo) colidem entre si em daltonismo** (ΔE de 0,8 a 1,9). Por isso **ícone e palavra são obrigatórios** em todo estado.
- **Categorias só passam quando vizinhas** (barra 100%, empilhadas em ordem fixa). Ficam proibidos gráficos de dispersão com 6 cores, e há 2px da cor do fundo entre segmentos. Categorias nunca dividem um gráfico com entrada, saída ou destaque.
- **A cor nunca trabalha sozinha** (WCAG 1.4.1). Toda marca de gráfico tem contraste de pelo menos 3:1 (1.4.11) e todo texto de pelo menos 4,5:1, nos dois temas. As medições foram refeitas para este plano sobre o cartão e sobre o fundo da página. Com o contexto `#858a84`, todas as marcas passam de 3:1 também no creme `#f4f3ee` (o destaque fica no limite, 3,29) e no fundo escuro `#0c1913`.
- **O cenário escolhido não depende só da cor.** Ouro e cinza de contexto têm luminância parecida (cerca de 1,04:1), então a série em destaque também é mais grossa (2,5px), fica por cima e leva rótulo direto.

### 6.3 Gramática dos traços (adaptada do IBCS)

| Situação | Como aparece |
|---|---|
| Realizado ou efetivo | Sólido |
| Estimado ou comprometido | Contorno de 1,5px, rótulo em itálico |
| Previsto ou projeção | Hachura de 45° na cor da série (`<pattern>` SVG) |
| A confirmar | Contorno tracejado em `--fin-contexto` |
| Mês fechado | Cadeado no eixo |
| Variação | Sinal + ou − (U+2212) e ▲▼; cor só na variação. Aumento de custo é variação desfavorável |
| Valor estimado | "≈" antes do número, sempre com link para a conta |

### 6.4 Três níveis de leitura (padrão de página)

1. **Manchete, para ler em 10 segundos:** uma frase em serifa de 22px e até 4 números.
2. **Gráficos, para 1 minuto de leitura:** no máximo 2 por página; os outros ficam atrás de "Ver mais".
3. **Livro, para chegar ao centavo:** a tabela completa com filtros, origem e autora.

O clique numa barra, segmento ou contador abre o nível 3 já filtrado. A revelação nunca passa de 2 níveis, como recomenda a NN/g.

### 6.5 Tipografia

- **Escala:** 12 / 13 / 15 / 18 / 22 / 28 / 40px, mais o `clamp(42–72px)` do h1, no lugar dos 36 tamanhos atuais. **O mínimo é 12px**; hoje 116 das 272 declarações ficam em 11px ou menos.
- **Cifras:** `.fin-num` em serifa com `font-variant-numeric: lining-nums tabular-nums`. Isso é necessário porque a Georgia, fonte de reserva, usa algarismos de texto por padrão. Nas tabelas, alinhadas à direita.
- **Moeda original:** `.fin-moeda-original` em 13px `--muted`, embaixo do equivalente.
- **Abreviação** ("R$ 12,3 mil"): só nos eixos, com o valor inteiro na dica.
- **Formatação única:** `money()` e `dateLabel()` (Intl pt-BR). `mpReais` e `mpCompacto` seguem as mesmas regras.

### 6.6 Kit de gráficos `graficos.js`, sem dependência externa

O kit nasce de `mpSvg`, `mpPassoBonito`, `mpDica`, `mpMostrarDica` e `mpLegenda` (`app.js:1730-1886`), promovidos a uma biblioteca comum. São oito formas:

| Forma | Onde |
|---|---|
| Ranking em barras horizontais | Meu painel, Assinaturas, Portfólio |
| Barra 100% de composição | Meu painel, Caixa, Sociedade (participação) |
| Fluxo: barras divergentes com linha de saldo | Caixa (12 meses) |
| Cascata | Caixa (mês), Med Painel (R$ 59,90), Receitas |
| Bullet (orçado × real com faixas de 80% e 100%) | Caixa (teto), Lançamentos |
| Degraus | Histórico de cada parâmetro |
| Área empilhada | Med Painel (canais) |
| Régua do mês e minigráfico | Meu painel |

**Contrato de entrada.** Cada função recebe `{linhas, unidade, moeda, conta, fonte, rotuloAcessivel}` e devolve o SVG **com a tabela equivalente**.
- Os valores entram como `amount_minor` inteiros. `Number` só é usado na geometria; rótulos e dicas passam por `money()` a partir do inteiro.
- **Nenhuma soma acontece dentro do gráfico.**
- O kit **recusa misturar moedas** numa série. Ou faz um gráfico por moeda, ou usa o equivalente em reais com `fx_ref`; sem ele, mostra "falta câmbio para converter".

**Marcas.**
- Linhas de 2px (o destaque com 2,5px) e marcadores de pelo menos 8px com anel da superfície.
- Barras ancoradas na base, com 2px de folga e cantos de 4px só na ponta.
- Grade em `--line` e base em `--line-strong`.
- Rótulo direto no fim da série e eixo X proporcional (hoje é fixo em 1, 12, 24, 36, 48).
- Ajuste para que rótulos não se sobreponham a 390px.

**Interação e acessibilidade.**
- Um **único tab stop** por gráfico, com ←/→, Home e End (hoje há até 120).
- A dica mostra o valor ao centavo na moeda original.
- `aria-label` com a conclusão, não com a forma.
- Botões "Ver tabela" e "Ver a conta", e uma linha "Como ler" embaixo de cada gráfico.
- Suporte a `prefers-reduced-motion` e a `forced-colors`; neste último, a hachura vira o canal principal.

### 6.7 Componentes novos

Todos derivam dos existentes (`.button-primary`, `.field` de 44px, `.plan-edit-grid`, `.page-help-dialog`, `.asset-chip`, `.source-popover`):

- **Lançar e editar:**
  - `.button-launch`, o ouro com "+ Lançar", e `.fab`, o botão flutuante de 56px com safe-area;
  - `.sheet`, que vira folha de baixo no celular e diálogo de 520px no desktop;
  - `.amount-input`, com máscara em centavos, serifa de 40px e o valor por extenso;
  - `.chip-group`, um rádio com cara de chip.
- **Avisos e estado:**
  - `.toast` com `role=status`, "Desfazer" e anel de contagem;
  - `.sync-dot`, o ponto de sincronia com texto;
  - `.training-banner`;
  - `.lock-note`, com cadeado e motivo.
- **Registro e auditoria:**
  - `.autoria` ("por Ana · 17/10 14:02") e `.diff` (antes riscado → depois);
  - `.status-pill[data-status]` e a pílula de proveniência: efetivo · estimado · importado · padrão do código · sub judice · a confirmar · conferido;
  - `.conflict-dialog`, com as duas versões lado a lado.
- **Números e explicação:**
  - `.fin-manchete`, `.fin-num`, `.fin-delta`, `.fin-aprox`;
  - `.ver-conta` e `.ver-tabela` (alternância com `aria-pressed`, no estilo de `.mp-cenarios`).
- **Parâmetros, fechamento e acerto:**
  - `.param-row` e `.impact-panel`;
  - `.stepper` (fechamento numerado em serifa) e `.seal` (selo de mês fechado com hash curto);
  - cartão de saldo de acerto e setas "quem paga quem";
  - `.export-menu`.

### 6.8 Celular

- Tabelas largas (Lançamentos, Parâmetros, Premissas, Metas) viram listas de rótulo e valor, ou ganham sombra lateral com dica de rolagem; colunas não são mais cortadas sem aviso.
- O título do cabeçalho quebra em duas linhas, sem reticências, e sai o h2 que repete o título (cerca de 120px).
- Números-chave em grade 2×2.
- Filtros e cobertura do Portfólio ficam atrás de um botão "Filtrar".

---

## 7. Fases de implementação

Cada fase é entregável e verificável sozinha. As durações são ordem de grandeza para trabalho de agentes com revisão.

### P0.0 Preparar a casa (você, cerca de 1 hora, mais as decisões)
- Rodar `descobrir-fonte-no-mac.sh` e criar `Bauerfilho/ai-cask` privado com o `.gitignore` da D1. Liberar o repositório nesta sessão. Incluir `~/Projetos/ai-cask` no backup.
- Decidir D2 a D4 e D9 a D10. Os prazos fiscais de 30/10 e 01/11 vão ao contador agora, independente do portal.
- **Pronto quando:** um PR de teste no repositório privado roda `node --test` no CI.

### P0.1 Corrigir e ler melhor (1 a 2 semanas, sem backend)
- Todas as correções de exatidão e visuais confirmadas.
- Controles honestos.
- Tokens `--fin-*` e o kit `graficos.js`, registrado em `RecursosFinanceiros` e no `montar.mjs`.
- Meu painel: manchete parcial, composição por serviço, régua do mês, contadores com valor.
- Assinaturas: resumo e ranking.
- Bullet de teto, glossário, "Ver a conta" nos campos atuais e escala tipográfica.
- A suíte do arnês e o protótipo viram CI.
- **Entrega:** o portal publicado fica mais correto e mais legível, ainda sem gravar.
- **Pronto quando:**
  - toda a lista "reprova hoje" de §8.1 passa;
  - nenhum controle do portal falha depois de preenchido;
  - fotos antes e depois nos 4 cortes com 0 erros de script e 0 violações de CSP.

### P0.2 Domínio novo e modo treino (cerca de 2 semanas, sem backend)
- Coleções, catálogo, funções puras, `authorize`, `applyEvent`, `foldJournal` e `explain`.
- Semente de parâmetros como "a confirmar".
- Páginas **Lançamentos**, **Parâmetros** (com "Testar sem salvar" e PTAX), **Caixa calculado** (composição e razão) e **Histórico**, todas funcionando em **modo treino** (cópia em memória) e no arnês.
- Se a D2 for "não gravar online", entra aqui o `NativeStore` no AI Cask.
- **Entrega:** as sócias experimentam tudo no treino, e a simulação de parâmetros já funciona no portal só de leitura.
- **Pronto quando:**
  - os testes de domínio e de propriedade de §8.2 e §8.3 passam;
  - o exemplo de outubro de §4.6 bate centavo a centavo no arnês.

### P0.3 Gravação (2 a 3 semanas)
- Worker + Durable Object com testes.
- No `montar.mjs`: chave do diário por época, tokens, chaves ECDSA, `journal_head`, CSP com o host exato, nomes com hash, `minClientVersion` e recusa de senhas repetidas.
- `journal.js`: fila, rebase e diálogo de conflito.
- Bloqueio de moldura.
- **+ Lançar**, Desfazer, Recusados e CSV de lançamentos e parâmetros.
- Backup diário cifrado.
- A aba do AI Cask passa a ser cliente do diário.
- **Entrega:** cada sócia lança, corrige e edita parâmetros pelo celular, tudo registrado e cifrado.
- **Pronto quando:**
  - as provas de cifra e de conflito de §8.4 e §8.5 passam;
  - um teste de restauração foi feito;
  - as 3 sócias lançam sem ajuda em até 10 s, medido.

### P1.1 Rotina do mês (cerca de 2 semanas)
- Fechamento guiado com selo e pacote do contador.
- Acerto, reembolso e aporte na Sociedade e no Meu painel.
- Conciliação de fatura e PTAX.
- Assinaturas sem arquivo: nova, confirmar, encerrar, marcar paga.
- Saldos informados.
- **Pronto quando:** outubro de 2026 é fechado inteiro pelas sócias, sem IA e sem o Mac, e o contador aceita o CSV.

### P1.2 Profundidade de leitura (cerca de 2 semanas)
- Receitas, fluxo de 12 meses, cascata, fôlego e manchete completa.
- Navegação agrupada e rotas.
- Como fazer e primeiro acesso.
- Estado do portal.
- Vender primeiro sem o corte em 3.
- **Pronto quando:**
  - no teste de 10 segundos de §8.8, as 4 respostas vêm em até 10 s;
  - "De onde vem este número?" chega ao lançamento ou parâmetro, com autora e data, em até 3 cliques.

### P2 Fiscal, simulação e conforto (contínuo, em entregas independentes)
1. Impostos: Simples, fator R, DAS estimado, calendário e .ics, comparador de regime.
2. Med Painel ligado aos parâmetros, com o simulador e os gráficos novos.
3. Projeção unificada.
4. Comprovantes cifrados no R2.
5. Usuários e pagantes, Portfólio e catálogo do Laboratório.
6. Domínio próprio com CSP por cabeçalho, passkey PRF e fila em IndexedDB.

Cada item tem a própria bateria de testes e as próprias fotos no arnês.

---

## 8. Verificação

### 8.1 Testes de domínio que **reprovam hoje** (escritos antes da correção)

| Caso | Hoje | Esperado |
|---|---|---|
| `parseAmountMinor('1.500','BRL')` | 150 (R$ 1,50) | 150000 |
| `parse('1.50','BRL')` | 150 | erro "use vírgula para centavos" |
| `parse('12,345','BRL')` | 1235 (arredonda sem avisar) | erro "no máximo 2 casas" |
| `mpRepartir` com 0,1 / 64,1 / 35,8 | `[]` ("não soma 100%") | partes que somam o lucro ao centavo |
| `blocks.medpainel.fixed_monthly` | `undefined` → "empresa R$ 0" | igual a `cash.fixed_monthly` |
| Plano `inactive` | tem `personal_amount` e próxima data | `null` nos dois |
| `monthlyDay 31` em novembro | `due null` + issue | 30/11 |
| `nextDate` vencido em plano mensal pago | vencido para sempre | próximo ciclo |
| Bloco estático com `source.status = 'forjado'` | sobrescreve o calculado | o calculado prevalece |
| Membro com papel declarado `owner` faz mutação restrita | aceito | papel lido do estado → recusado |
| `safeText('NF 12345678901')` | "[dado pessoal omitido]" | mantém (dígito verificador inválido); `12345678909` continua mascarado |
| `add_expense` com `amountMinor: -500` | (não existe) | recusado só na coleção nova |
| CSS do teto a 103% no tema claro | dourado | `--fin-perigo` |
| Sociedade com linhas e `text` | o texto some | aparece "Histórico importado" |

### 8.2 Propriedades e vetores

Testados com laço determinístico ou fast-check:
- **Rateio:** a soma das partes é igual ao total para quaisquer pesos (`allocateByWeights`).
- **Conversão:** os componentes fecham com o total (`convertMinor`), com os vetores de F3.
- **Livro do mês:**
  - a soma por categoria, a soma por pagador e o total coincidem;
  - plano e gasto com o mesmo `subscriptionId` não contam duas vezes;
  - um anulado fica fora;
  - total = realizado + previsto.
- **Acerto:** os saldos somam 0.
- **Composição:** os `pct_permil` somam 1000.
- **Moedas:** nenhum campo `*_brl_*` sem `fx_ref`.
- **Vigência:** `paramAt` respeita a vigência e as correções; mudar um parâmetro não altera um mês fechado.
- **Selo:** `closingHash` não depende da ordem das chaves.

### 8.3 Determinismo e compatibilidade

- `fold(checkpoint, eventos)` dá o mesmo `content_revision` em 3 execuções, no navegador e no Node (`montar.mjs`).
- Reaplicar o mesmo evento não muda nada (idempotência pelo ULID).
- O `montar.mjs` nunca descarta evento aceito: um teste de contrato confere que eventos aplicados + recusados = cabeça.
- O estado do backup de 30/09 e o do pacote atual passam no novo `validateState`. O pacote atual é verificado **no Mac**, com senha.
- O `domain.js` publicado hoje aceita o estado estendido (já verificado em `dominio-extensao-esboco.mjs`).
- Sem coleções novas, o snapshot sai igual ao de antes, com as diferenças restritas à lista de §8.1.
- Bateria de equivalência `domain.js` × `core.py` no CI, no que o `core.py` ainda calcula.

### 8.4 Prova de cifra

1. **Servidor cego:** despejar o SQLite do Worker de teste e procurar textos conhecidos ("Contador", "450", nomes das sócias). Resultado esperado: **zero ocorrências**.
2. **AAD:** trocar o `member_id` de um envelope deve fazer a decifração falhar e o evento aparecer como "recusado: autoria não confere".
3. **Token trocado:** um evento cifrado com AAD "Ana" e enviado com o token da Beatriz é gravado pelo Worker como `beatriz`; todos os clientes recusam.
4. **Assinatura:** alterar 1 byte de `sig` leva a 401 no Worker e a recusa no cliente.
5. **Cadeia:** remover um evento do meio no servidor de teste leva a "cadeia quebrada no registro N".
6. **Rollback:** o servidor devolve uma cabeça anterior ao `journal_head` do checkpoint, e o cliente mostra o alerta "voltou no tempo".
7. **Chave estável:** publicar 2 vezes com chave mestra nova não impede que os eventos antigos continuem legíveis.
8. **Época:** remover uma sócia faz o token dela receber 401, e a chave da época nova não está nos pacotes antigos dela.
9. **Vetores conhecidos:** AES-GCM e ECDSA dão o mesmo resultado no WebCrypto do navegador e no Node.
10. **Anti-moldura:** o portal dentro de um iframe de outra origem não renderiza.

### 8.5 Prova de conflito (arnês com duas ou três abas e um Worker local)

1. Duas inclusões simultâneas: ambas aceitas, com `seq` consecutivos e sem diálogo.
2. Duas edições do mesmo gasto: a segunda aba vê o diálogo com nome, hora e os dois valores, e o formulário continua preenchido.
3. Reenvio depois de a rede cair após o 201: mesmo `seq`, sem duplicata.
4. Duas propostas na mesma chave de parâmetro: a segunda vê o conflito.
5. Um `version` antigo é recusado com motivo.
6. O ciclo de 2 s não redesenha a tela com formulário aberto.
7. Sem rede: a fila e o aviso aparecem, o envio acontece ao voltar, e `beforeunload` avisa.
8. Desfazer em até 8 s não envia nada. Depois disso, gera uma anulação visível no Histórico.

### 8.6 Worker (Miniflare / `wrangler dev`)

- Token inválido dá 401. `expectedSeq` velho dá 409 com os envelopes que faltam.
- Corpo acima de 8 KB dá 413. O 301º evento do dia dá 429.
- **Não existe** rota que altere ou apague.
- O `member_id` vem do token mesmo que o corpo diga outro.
- O cron de backup grava só texto cifrado.

### 8.7 Fotos no arnês

- Estender `arnes/site/estado-ficticio.js` com o exemplo de outubro: gastos em BRL e USD, um anulado, parâmetros com duas vigências e uma correção, receitas, um acerto, um mês fechado e um evento recusado.
- Rodar `node fotografar.mjs --site <pasta>` nos 4 cortes: claro e escuro, a 1280×860 e a 390×844.
- Fotografar as 8 páginas atuais e as novas (Lançamentos, Parâmetros, Histórico, Fechamento), mais os estados vazio, treino, conflito, sem rede e mês fechado.
- Exigir:
  - **0 erros de script**, **0 violações de CSP** e nenhuma rolagem horizontal a 390px;
  - nenhum rótulo de gráfico sobreposto, conferido no olho.

### 8.8 Acessibilidade, usabilidade e conta à mão

- **Contraste:** o validador roda em CI sobre os tokens (marcas ≥ 3:1, texto ≥ 4,5:1, nos dois temas e também sobre `#f4f3ee` e `#0c1913`). Um grep no CSS garante que não sobrou texto abaixo de 12px.
- **Teclado e leitores de tela:** a folha "+ Lançar" e o Histórico funcionam só pelo teclado. O VoiceOver anuncia o aviso de desfazer e os erros de formulário.
- **Teste de 10 segundos:** no Meu painel, perguntar "quanto a empresa gasta por mês?", "qual é a sua parte?", "quanto tempo o caixa dura?" e "tem algo atrasado?". As quatro respostas precisam vir em até 10 s.
- **Tarefas cronometradas no celular de cada sócia, sem explicação:**
  - lançar "Contador R$ 450,00 pago do bolso" em até 10 s;
  - atualizar o dólar pela PTAX e ver o impacto em até 30 s;
  - desfazer um lançamento errado em até 10 s.
- **Ponta a ponta:** um mês calculado à mão numa planilha, com as mesmas entradas, tem de bater centavo a centavo com `blocks.month`, com o "Ver a conta" e com o CSV. As três sócias conferem o mesmo hash no selo e no CSV.

---

## 9. Riscos e o que fica fora

### 9.1 Riscos

| Risco | Mitigação |
|---|---|
| A fonte existe só no Mac e fora do backup | D1 antes de tudo; nada se implementa no `orquestrator-portal` |
| O `montar.mjs` filtra campos novos ou regenera o estado sem consumir o diário | Teste de contrato; `journal_head` obrigatório; as coleções novas são do diário, não do Mac |
| A chave mestra muda a cada publicação | A chave do diário é aleatória e estável por época, guardada no Keychain (§3.4) |
| Senha fraca: com escrita, quebrar uma senha deixa escrever como aquela sócia | Frases-senha únicas (D10), limites no Worker, assinatura por sócia, passkey na P2 |
| O Criador consegue agir como qualquer sócia | Dito com franqueza (§3.4); passkeys na P2 removem isso |
| Origem compartilhada `bauerfilho.github.io` e falta de `frame-ancestors` | Nada sensível em storage, fila só em memória, anti-moldura por script; domínio próprio na P2 |
| O servidor esconde eventos recentes ou volta no tempo | Piso `journal_head` no checkpoint, verificação da cadeia, aviso na tela |
| Validação só no cliente | Fold determinístico em todos os clientes e no `montar.mjs`; um evento inválido aparece como recusado e não conta. O custo é um Histórico mais poluído se alguém adulterar o próprio `app.js` |
| Dois escritores (arquivos de planos no Mac × eventos de plano) | Regra de dono por coleção; conflito vira "recusado: o plano mudou no Mac"; a aba do AI Cask vira cliente do diário |
| Núcleo duplicado (`domain.js`, `core.py`, Swift) | Tudo o que é novo só no `domain.js` (D11); testes de equivalência no legado |
| App em cache com dados novos | Nomes com hash, `minClientVersion`, `features`, aviso de versão |
| Contar o mesmo custo duas vezes (plano + fatura) | Dedupe por `subscriptionId`, sugestão de vínculo no autocompletar, aviso de "gasto parecido" (mesmo serviço, ±5%) |
| Rateio retroativo quando a participação muda | `allocationFrozen` em cada lançamento, `participationHistory` e fechamento |
| Erro de digitação de 1000 vezes | Máscara em centavos, valor por extenso, conferência por outra sócia |
| Parâmetro errado ou vandalizado | Faixas dura e macia, alerta de salto, quatro olhos, prévia de impacto, meses fechados imunes |
| Precisão falsa do "≈ R$" | Sinal ≈ obrigatório, câmbio e IOF datados com autora, original sempre visível, efetivo substitui estimado |
| Gráfico sem história (o snapshot de hoje só traz o mês) | A série começa no primeiro mês com dado ("histórico desde out/2026"); o fôlego pede um mês fechado; nada é inventado |
| Excesso de enfeite | No máximo 2 gráficos no nível 2; ouro só no destaque; 6 categorias + Outros |
| Cloudflare: latência não medida, termos do plano Free, recuperação no tempo no Free | Medir com um Worker de teste antes; confirmar os termos; o backup no GitHub independe disso |
| Regras fiscais mudam ou estão em disputa (IOF na ADC 96, LC 224/2025, Lei 15.270/2025) | Vigência, situação jurídica, "conferido pelo contador"; o portal informa, não aconselha |
| O saneamento apaga números de documento | `docRef` próprio; CPF só com dígito verificador |
| Limite de 10 000 linhas por coleção | O diário é paginado; arquivamento anual pelo `montar.mjs` |
| Ninguém fecha o mês | Roteiro de 6 passos, prazo até o dia 5 (D8), lembrete em .ics na P2 |

### 9.2 O que fica fora deste plano

- **Aconselhamento fiscal ou contábil.** O portal guarda parâmetros com fonte e vigência; quem decide é o contador.
- **Integração bancária ou Open Finance** e importação automática de faturas. A conciliação é manual, assistida.
- **Integração ao vivo com Hotmart, Stripe ou Apple.** Na P2 entra no máximo a importação de CSV agregada no navegador.
- **Lista nominal de pagantes ou cadastrados no pacote**, por causa da LGPD. Ficam só os agregados.
- **Mudar participação, entrar ou sair de sócia e trocar senha pelo portal.** Continua no Mac, pelo `montar.mjs`.
- **Aplicativo nativo de celular.** Ficam o PWA, os atalhos e "Adicionar à Tela de Início".
- **Fila de envio persistente e "lembrar neste aparelho"** antes do domínio próprio.
- **Notificações por e-mail ou push.** Só .ics gerado no navegador.
- **Garantia de autoria contra o próprio Criador** antes das passkeys.

---

## Placar do julgamento

| Critério (1–10) | 1 · Dados e cálculo primeiro | 2 · Clareza visual e didática | 3 · Autonomia e operação |
|---|---|---|---|
| Atende o pedido | 8 | 8 | **9** |
| Exatidão financeira | **10** | 8 | 8 |
| Clareza e didática | 7 | **10** | 7 |
| Autonomia das sócias | 8 | 6 | **10** |
| Segurança | 7 | 6 | **9** |
| Viabilidade nesta base de código | 6 | 8 | 8 |
| **Total (máx. 60)** | **46** | **46** | **51** |

**Espinha escolhida: proposta 3.** Ela é a única que trata a autonomia como operação, não como tela: desfazer, fila, treino, "Como fazer", Estado do portal, CSV protegido contra injeção e backup com teste de restauração. Também é a única que percebeu que a chave do diário **não pode** ser derivada da chave mestra, porque o `montar.mjs` sorteia uma mestra nova a cada publicação. O servidor dela é mínimo (envelopes cifrados, compare-and-swap, sem UPDATE nem DELETE), e ela é honesta sobre os limites: validação só no cliente, origem compartilhada, moldura.

**Enxertos da proposta 1.**
- O modelo de dados completo: `allocationFrozen`, `participationHistory`, `fx` com estimado e efetivo, `closings` com hash, `settlements` e `income`.
- As funções puras já provadas no protótipo.
- O recibo "Ver a conta" gerado pela mesma função que calcula.
- A lista de correções de exatidão.
- A distinção parâmetro × premissa e a versão por registro.

**Rejeitados da proposta 1.**
- Derivar a chave do diário da mestra com HKDF, pelo mesmo erro já explicado.
- Rodar o `domain.js` dentro do Swift via JavaScriptCore. É mais simples fazer da aba do AI Cask um cliente do diário.
- Terracota como cor de "saída", que colide com o ouro em daltonismo.

**Enxertos da proposta 2.**
- O sistema de cores validado com números e as regras que saíram das medições. Um ajuste: o cinza de contexto `#8f948e` reprovava no creme da página (2,78:1) e foi trocado por `#858a84`.
- A gramática IBCS dos traços.
- Os três níveis de leitura e a manchete do mês.
- O kit único de gráficos derivado do Med Painel.
- A escala tipográfica com algarismos alinhados.
- O fôlego mostrado já com um mês fechado e rotulado "média de N meses".

**Rejeitado da proposta 2:** o mesmo HKDF a partir da chave mestra.

**Ajustes ao enxerto da proposta 3.**
- A assinatura ECDSA por sócia sai da fase 3 e entra **junto com a gravação**. Acrescentá-la depois deixaria os primeiros eventos sem assinatura.
- Os parâmetros fiscais ganham o catálogo completo, a situação jurídica e o selo "conferido pelo contador" da pesquisa.
