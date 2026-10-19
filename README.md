# Portal Orquestrator · Finanças

O portal da empresa: finanças, assinaturas, projetos, sociedade e o Laboratório de maquetes. Ele é publicado pelo
GitHub Pages a partir da branch `main`.

**Este repositório é a fonte da interface** (decisão do Bauer em 19/10/2026). O `montar.mjs` do AI Cask continua
gerando o **pacote cifrado de dados** (`bundle-*.bin`, `manifest.json`, `painel/`). Ele não deve sobrescrever a
interface: `app.js`, `domain.js`, `razao.js`, `diario.js`, `livro.js`, `graficos.js`, os `.css` e o `index.html`.

Os dados da empresa são cifrados no navegador: sem a senha, não há nada legível deles aqui. A exceção são as
maquetes do Laboratório (`galeria/` e `apps/`), que são públicas e só têm dados fictícios.

**Lembrar deste aparelho.** Marcada na entrada, a caixa guarda neste navegador (no IndexedDB do site) a chave do pacote,
cifrada com uma chave do aparelho, e a chave do diário; a senha nunca é guardada. Nenhum script copia os bytes da chave do
aparelho, mas qualquer página da mesma origem consegue USÁ-LA e abrir o pacote. Por isso a caixa só aparece numa origem
que seja só do portal: no GitHub Pages (`bauerfilho.github.io`, a mesma origem de todo repositório Pages do dono e das
telas cheias públicas das maquetes) ela não aparece e nada vai para o aparelho, até o portal ter endereço próprio (F3-8
do plano). Sair esquece o aparelho (entrar sem marcar também). No iPhone, pelo Safari, o próprio sistema pode apagar isso
depois de uns 7 dias sem abrir o portal (é só entrar de novo); no app da Tela de Início, não.

## O que há em cada arquivo

| Arquivo | O que faz |
|---|---|
| `index.html` | A página, com a política de segurança (CSP). Só fala com o próprio site, com o servidor do diário e com a PTAX do BCB. |
| `static-bridge.js` · `portal-crypto.js` · `lembrar.js` | Abrem o pacote cifrado com a senha e abrem o diário. `lembrar.js` é o "Lembrar deste aparelho". |
| `domain.js` | O domínio que já existia: assinaturas, cobranças e rateio, em centavos inteiros. |
| `razao.js` | O livro-razão:<br>· parâmetros com vigência (câmbio, spread, IOF, impostos, taxas);<br>· lançamentos das sócias, conferência e conciliação da fatura;<br>· assinaturas, passos de venda, acertos, saldos e receitas;<br>· fechar e reabrir o mês, com a trava do que forma os números;<br>· o mês calculado, o acerto entre sócias e o CSV para o contador. |
| `diario.js` | O diário cifrado: cada gravação é cifrada (AES-GCM) e assinada (ECDSA) no navegador, e o servidor só guarda texto cifrado. Fala com o armazenamento por uma **porta** (`portaHttp`, `portaMemoria` ou uma sua): o contrato está em `docs/PORTAS.md`. |
| `livro.js` · `graficos.js` · `livro.css` | As páginas Livro do mês, Lançamentos, Parâmetros e Histórico, o botão "+ Lançar", os gráficos e os ganchos das páginas novas (`registrarPagina`, `abrirFolha`, `campoDinheiro`, `gravar`). |
| `rotina.js` e `assinaturas.js` · `acerto.js` · `caixa.js` · `conciliacao.js` · `fechamento.js` · `ajuda.js` | As páginas da rotina do mês (fase 2), cada uma com o seu `.css`. |
| `fiscal.js` | O núcleo fiscal puro: Simples (anexos III e V, com a 6ª faixa da lei), fator R, DAS estimado, Presumido e o calendário fiscal com `.ics`. Tudo informa, nada aconselha: confirmar com o contador. |
| `app.js` · `style.css` · `tema.css` | A interface que já existia. |
| `galeria.js` | O Laboratório: lê o catálogo e as maquetes de `galeria/` (mesma origem) e junta os documentos antigos do pacote cifrado como "Sem stand". Quando o mesmo arquivo existe nos dois, vence o do repositório. |
| `galeria/` | O catálogo (`index.html`) e as maquetes com stand (`apps/<id>.html`) que o item Laboratório mostra numa moldura isolada. **Não se edita aqui**: vem do ia-chat, com `python3 laboratorio/publicar.py <pasta do portal>`. |
| `apps/<id>/` | A versão **tela cheia** de cada maquete, para abrir numa aba à parte e pôr na Tela de Início do iPhone: o app sozinho (`index.html`), `manifest.webmanifest` e os ícones 180, 192 e 512. Também vem do publicador do ia-chat. Endereço: `https://bauerfilho.github.io/orquestrator-portal/apps/<id>/`. |
| `servidor/` | O servidor do diário (função Netlify com Blobs). Como publicar: `servidor/LEIA.md`. |
| `docs/` | `PLANO-PORTAL.md` (o plano aprovado), `PLANO-FASES-2-3.md` (as fases 2 e 3 fatiadas), `PORTAS.md` (como plugar outro armazenamento no diário) e `CHECKLIST.md` (o que foi feito e o que falta). |

## Laboratório: maquetes e tela cheia

As sócias entram com a senha e abrem o **Laboratório**. Ali está o catálogo; cada maquete abre no stand, com os três
estados. Na barra de cima há o link **Abrir em tela cheia ↗**: ele abre o app sozinho numa aba nova, como num iPhone.
No iPhone, é tocar em Compartilhar e em Adicionar à Tela de Início para usar como app.

**As páginas de tela cheia são públicas.** Elas ficam fora do pacote cifrado: qualquer pessoa com o link abre, sem
senha. Por isso só têm dados fictícios e pedem aos buscadores para não indexar (`noindex`). O catálogo e as maquetes
com stand (`galeria/`) também são arquivos comuns do site; só o resto do portal é cifrado.

Para publicar uma versão nova das maquetes:

```zsh
cd ../ia-chat && python3 laboratorio/publicar.py ../orquestrator-portal   # reescreve galeria/ e apps/
cd ../orquestrator-portal && node --test testes/*.test.mjs                 # confere cada maquete e a tela cheia dela
```

Depois é commit e push; o GitHub Pages publica sozinho.

## Conferir

```zsh
node --test testes/*.test.mjs                                 # livro-razão, servidor, diário, galeria e tela cheia das maquetes
node ferramentas/arnes/servir.mjs 8765                        # o portal local, sem senha: http://127.0.0.1:8765/?demo=1
node ferramentas/arnes/fotografar.mjs --query "demo=1"        # fotos de todas as páginas, claro/escuro, desktop/celular
node ferramentas/arnes/fluxos/lembrar.mjs --porta 8931        # "Lembrar deste aparelho" no Chromium (arnês e ponte real)
node ferramentas/arnes/fluxos/perfis.mjs --porta 8951         # perfis: corrida entre aparelhos, iPhone, ajuda, perfis.json fora
```

No arnês, `?diario=local` grava de verdade, cifrado, num servidor do diário em memória. `?membro=m-ana` mostra o portal
como a Ana. `?login=1` mostra a tela de entrada (com "Lembrar deste aparelho" marcado, recarregar entra direto) e
`?pacote=novo` faz de conta que o pacote foi lacrado de novo. `?galeria=1` mostra o Laboratório com a `galeria/` do
repositório, e `?legado=1` junta um pacote antigo de mentira (um documento "Sem stand" e um Sinal antigo, que tem de
perder para o do repositório). As fotos falham se a página registrar erro de script ou violação de CSP.
