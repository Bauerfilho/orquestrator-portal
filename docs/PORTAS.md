# As portas do diário

O diário das sócias (`diario.js`) cifra, assina e confere tudo no navegador. Para **guardar** e **buscar**, ele fala
com o armazenamento por uma **porta**: um objeto com seis operações. Trocar de armazenamento é escrever outra porta.
O resto do portal (razão, telas, cifra, assinatura, cadeia) não muda.

```
razao.js · livro.js ──► diario.js ─────────► PORTA ───────► armazenamento
                        cifra, assina e      6 operações    o servidor Netlify hoje,
                        confere a cadeia     assíncronas    o que você quiser amanhã
```

A porta só vê dados cifrados. Ela não precisa de chave nenhuma e não consegue ler nada.

## As portas que já existem

| Porta | Para quê |
|---|---|
| `portaHttp(url, fetch?)` | O servidor do diário na Netlify (`servidor/nucleo.mjs`). O protocolo é o de sempre: `/api/estado`, `/api/chaves`, `/api/iniciar`, `/api/eventos`. |
| `portaMemoria({limitePagina?})` | Tudo num `Map` da própria aba, com as mesmas regras do servidor. Serve para testes e treino; some ao recarregar. Um `limitePagina` pequeno ajuda a testar a paginação. |
| `portaSobreChaveValor(armazem, {nome, duravel, limitePagina}?)` | Uma porta inteira sobre qualquer armazém chave-valor que saiba ler, gravar sem sobrescrever e listar. É o atalho para uma porta nova (veja o exemplo abaixo). |

Todas são exportadas por `diario.js`.

## Como abrir o diário com uma porta

```js
import {abrirDiario, portaHttp, portaMemoria} from './diario.js';

abrirDiario({url, membroId, senha, masterRaw});                 // o mesmo que a linha de baixo
abrirDiario({porta: portaHttp(url), membroId, senha, masterRaw});
abrirDiario({porta: portaMemoria(), membroId, senha, masterRaw}); // tudo na aba
abrirDiario({membroId, senha, masterRaw});                      // sem porta: modo treino, como hoje
```

Se vierem `url` e `porta` juntas, vale a `porta`. O diário aberto informa `d.porta` (`'http'`, `'memoria'`…) e
`d.url` (só na `portaHttp`).

Uma porta sem alguma das seis operações não derruba nada: o diário fica `indisponivel`, diz o que falta e cai no
treino.

## As regras que toda porta cumpre

1. **Só dados cifrados.** Tudo o que entra na porta já saiu cifrado do navegador, ou é público: identificadores
   (`m-ana`), chaves públicas e o SHA-256 do token. A porta nunca recebe texto aberto nem a senha.
2. **Só acréscimo.** Nenhuma operação altera ou apaga. Chaves e assinaturas: o primeiro registro vale, e gravar de novo
   não sobrescreve (responde `criados: []`). Não existe operação de apagar.
3. **Compare-and-swap pela posição (`seq`).** Um evento só entra na posição `cabeça + 1`. Se outra sócia gravou
   antes, a resposta é `conflito`, com a cabeça atual; o diário busca o que entrou e tenta de novo.
4. **O token.** Ler os eventos e escrever exigem o token do diário. Quem guarda, guarda só o SHA-256 dele (o
   `tokenHash` que chega em `iniciar`) e compara: o token em si não fica guardado em lugar nenhum.
5. **Respostas.** Toda operação é assíncrona e responde `{ok: true, ...}` ou `{ok: false, motivo, mensagem}`. A porta
   só **lança erro** quando não consegue falar com o armazenamento (sem rede, fora do ar, erro 5xx). Aí o diário fica
   `indisponivel` e os lançamentos vão para o treino.
6. **Cópias.** O que a porta devolve é uma cópia: o diário pode mexer no objeto sem mudar o que está guardado.
7. **Ordem e páginas.** `lerEventos` devolve os eventos em ordem crescente de `seq`, a partir de `depois + 1`, sem
   buracos, até o limite da porta (500 no servidor). O diário pede a página seguinte até alcançar a cabeça antes de
   dizer "íntegro até o registro N". Por isso uma porta pode devolver páginas de qualquer tamanho, desde 1.

### Motivos de recusa

| `motivo` | Quando |
|---|---|
| `conflito` | A posição já foi ocupada, ou pulou uma posição; ou o diário já foi iniciado. Vem com `cabeca` quando é de evento. |
| `nao_autorizado` | Sem token, ou token que não confere. |
| `invalido` | Pedido malformado: identificador fora do padrão, base64 inválido, posição que não é inteiro ≥ 1. |
| `grande_demais` | O evento passa de 16 KB. |
| `inexistente` | Não há nada ali (a rota não existe, ou o anexo não foi guardado). |
| `recusado` | Qualquer outra recusa do armazenamento (por exemplo, limite de pedidos). |

## O contrato, operação por operação

Formatos usados abaixo:

- **embrulho**: `{iv, ct}` em base64 (às vezes com `sal`). É uma chave cifrada.
- **envelope**: `{id, membro, iv, ct, sig, anterior, hash}`. É um evento cifrado e assinado no navegador.
- **registro**: o envelope guardado, com mais dois campos postos por quem guarda: `seq` (a posição) e `ts` (a hora do
  armazenamento, ISO 8601).
- **identificador**: letras, números, `.`, `_` e `-`, de 1 a 80 caracteres.

### `estado()`

- **Entrada:** nada.
- **Saída:** `{ok: true, iniciado, cabeca, criadoEm}`. `cabeca` é a maior posição ocupada (0 se vazio); `criadoEm` é
  a data de início ou `null`.
- **Erros:** lança se o armazenamento não responde.

### `iniciar({tokenHash, por, membro, pub})`

A primeira sócia a entrar cria o diário.

- **Entrada:** `tokenHash` (SHA-256 do token, 64 letras hexadecimais); `por` (identificador de quem iniciou);
  `membro: {id, embrulho}` (a chave do diário cifrada pela senha dela); `pub: {id, embrulho}` (a chave do diário
  cifrada pela publicação atual do pacote).
- **Saída:** `{ok: true, criados: ['membro', 'pub']}`.
- **Recusas:** `invalido` (tokenHash fora do formato, chave malformada) · `conflito` (já iniciado).
- **Garantia:** acontece uma vez só, mesmo com duas sócias ao mesmo tempo.

### `chaves({membro?, pub?})`

Leitura livre: tudo aqui está cifrado ou é público.

- **Entrada:** `membro` e `pub` são identificadores, os dois opcionais.
- **Saída:** `{ok: true, membro, pub, assinaturaPropria, assinaturas}`. `membro` e `pub` são os embrulhos guardados
  (ou `null`). `assinaturaPropria` é a chave privada de assinatura da sócia, cifrada pela senha dela (ou `null`).
  `assinaturas` é `{idDaSocia: chavePública}`, de todas.
- **Recusas:** `invalido` (identificador fora do padrão).

### `registrarChaves({token, membro?, pub?, assinatura?})`

- **Entrada:** o token; `membro: {id, embrulho}`; `pub: {id, embrulho}`; `assinatura: {membro, pub, privada}`, onde
  `pub` é a chave pública ECDSA P-256 (`{kty: 'EC', crv: 'P-256', x, y}`) e `privada` é um embrulho.
- **Saída:** `{ok: true, criados}`, com o que era novo, na ordem `membro`, `pub`, `assinatura`.
- **Recusas:** `nao_autorizado` · `invalido`.
- **Garantia:** o primeiro registro vale. Trocar uma assinatura exige o Criador apagar à mão, fora do portal.

### `lerEventos({token, depois})`

- **Entrada:** o token e `depois`, a última posição que o navegador já tem (0 no começo).
- **Saída:** `{ok: true, eventos, cabeca}`. `eventos` são registros com `seq > depois`, em ordem, sem buracos, até o
  limite da porta. `cabeca` é a maior posição ocupada.
- **Recusas:** `nao_autorizado`.

### `acrescentar({token, seq, envelope})`

- **Entrada:** o token; `seq`, a posição pedida (a cabeça que o navegador conhece + 1); o envelope.
- **Saída:** `{ok: true, seq, ts}`.
- **Recusas:** `nao_autorizado` · `grande_demais` (mais de 16 KB) · `invalido` · `conflito` (com `cabeca`).
- **Garantia:** compare-and-swap. De duas gravações na mesma posição, uma entra e a outra recebe `conflito`.

### Campos informativos (opcionais)

`nome` (aparece em `d.porta`), `duravel` (`false` se some ao recarregar), `limitePagina` e `url`.

## Exemplo mínimo de porta nova

O caminho curto é `portaSobreChaveValor`: ela já cumpre as regras e só precisa de um armazém com três funções. Este é
o molde que `testes/portas.test.mjs` testa. Troque o `Map` pelo seu armazenamento:

```js
import {portaSobreChaveValor} from './diario.js';

function meuArmazem() {
  const guardado = new Map();
  return {
    async ler(chave) { return guardado.has(chave) ? JSON.parse(guardado.get(chave)) : null; },
    // grava só se a chave ainda não existe; devolve true se gravou e false se já existia. NUNCA sobrescreve.
    async gravarSeNova(chave, valor) { if (guardado.has(chave)) return false; guardado.set(chave, JSON.stringify(valor)); return true; },
    async listar(prefixo) { return [...guardado.keys()].filter(k => k.startsWith(prefixo)); },
  };
}

export const minhaPorta = () => portaSobreChaveValor(meuArmazem(), {nome: 'minha', duravel: true});
```

`gravarSeNova` precisa ser **atômica**: entre ver que a chave não existe e gravar, ninguém mais pode gravar nela. É
isso que dá o compare-and-swap. As chaves usadas são as do servidor: `config/token`, `chaves/membro/<id>`,
`chaves/pub/<id>`, `assinaturas/<id>` e `ev/000000001` (posição com 9 dígitos).

**Atenção à segurança.** Se esse armazém fica do outro lado da rede e o navegador fala direto com ele, quem garante
"só acréscimo" e "só escreve quem tem o token" é o **armazém**: o navegador só traduz. Ele precisa recusar sobrescrever
e apagar, e pedir uma credencial para escrever. A cifra e a assinatura continuam valendo de qualquer jeito: um
armazém desonesto pode atrasar ou esconder eventos, mas não ler nem forjar. Se ele tirar ou trocar um evento do meio,
o diário aponta o problema. Se esconder os últimos, só percebe quem já os tinha visto (o piso publicado do plano,
§3.10, ainda não existe).

Uma porta escrita do zero (outro servidor, outro protocolo) é um objeto com as seis funções do contrato acima. Veja
`portaHttp` em `diario.js`: ela traduz cada operação num pedido HTTP, transforma 4xx em recusa e lança no 5xx.

## Como testar uma porta nova

`testes/portas.test.mjs` faz a mesma bateria de perguntas a cada porta: `portaMemoria`, `portaHttp` (com o servidor
de verdade, em memória) e o molde chave-valor. Para a sua, acrescente no fim do arquivo:

```js
bateria('a minha', () => minhaPorta());
```

A função tem de devolver uma porta **vazia** a cada chamada, porque cada teste começa do zero. Depois:

```zsh
node --test testes/portas.test.mjs
```

A bateria confere:

- as seis operações existem e nenhuma altera ou apaga;
- iniciar acontece uma vez só;
- nas chaves, o primeiro registro vale, e escrever pede o token;
- acrescentar respeita o compare-and-swap;
- 1.200 eventos voltam em ordem e por páginas, inclusive a partir do meio;
- pedido malformado ou grande demais é recusado sem gravar nada;
- a porta devolve cópias;
- o diário inteiro funciona sobre ela (duas sócias gravando e lendo);
- nada em claro passa por ela.

Se a sua porta passar, o diário funciona sobre ela. `testes/diario.test.mjs` mostra o diário com 1.200 eventos abrindo
inteiro numa sincronização, e o mesmo roteiro de duas sócias dando o mesmo resultado por `{url}` e por
`{porta: portaMemoria()}`.

## Onde ligar no portal

- **Portal publicado:** `static-bridge.js`, no `login`. Hoje a constante `DIARIO_URL` vai para
  `abrirDiario({url: DIARIO_URL, ...})`. Para outra porta, troque por `abrirDiario({porta: minhaPorta(), ...})`.
  Se o armazenamento novo estiver em outro endereço, acrescente esse endereço ao `connect-src` da política de
  segurança no `index.html`; sem isso, o navegador bloqueia a conexão.
- **Arnês local:** `ferramentas/arnes/ponte-simulada.js`, na função `abrirDiarioDoArnes`. Ali `?diario=local` usa o
  servidor em memória do arnês.

## Outro lugar para trocar: o armazém do servidor

Se o armazenamento novo fica **atrás de um servidor**, muitas vezes basta trocar o armazém do servidor e manter a
`portaHttp`. Em `servidor/nucleo.mjs`, `criarDiario(store)` recebe um objeto com `get(chave, {type: 'json'})`,
`setJSON(chave, valor, {onlyIfNew})` (que devolve `{modified}`) e `list({prefix})` (que devolve `{blobs: [{key}]}`).
Hoje esse objeto é o Netlify Blobs; nos testes, `armazemEmMemoria()`. O protocolo e o navegador ficam iguais.

## A porta dos anexos (comprovantes, F3-5): só a interface

Os comprovantes vão pela mesma porta, com mais duas operações. **Ainda não estão implementadas em nenhuma porta**: isso
é a fatia F3-5. Enquanto a porta não as tiver, `portaTemAnexos(porta)` responde `false` e o comprovante fica só na aba.

### `guardarAnexo({token, ref, corpo})`

- **Entrada:** o token; `corpo` (`Uint8Array`), o arquivo **já cifrado** no navegador (`iv‖ct`); `ref`, o SHA-256
  hexadecimal desse corpo cifrado.
- **Saída:** `{ok: true, novo}`. `novo` é `false` quando aquele `ref` já estava guardado: guardar de novo não duplica.
- **Recusas:** `nao_autorizado` · `invalido` (o SHA-256 do corpo não bate com `ref`) · `grande_demais` (acima de
  4,5 MB).
- **Garantia:** só acréscimo. Nunca sobrescreve e não há como apagar. Anular um gasto desliga o comprovante do
  gasto, mas não apaga o arquivo; isso será dito com franqueza na tela.

### `lerAnexo({token, ref})`

- **Entrada:** o token e o `ref`.
- **Saída:** `{ok: true, corpo}`, com o mesmo corpo cifrado que foi guardado.
- **Recusas:** `nao_autorizado` · `inexistente`.

Na `portaHttp`, elas vão virar `PUT` e `GET` em `/api/anexos/<ref>`; na `portaMemoria`, um `Map`. A bateria de
contrato ganha os testes delas na F3-5.
