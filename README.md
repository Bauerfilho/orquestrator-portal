# Portal Orquestrator · Finanças

O portal da empresa: finanças, assinaturas, projetos, sociedade e o Laboratório de maquetes. Ele é publicado pelo
GitHub Pages a partir da branch `main`.

**Este repositório é a fonte da interface** (decisão do Bauer em 19/10/2026). O `montar.mjs` do AI Cask continua
gerando o **pacote cifrado de dados** (`bundle-*.bin`, `manifest.json`, `painel/`). Ele não deve sobrescrever a
interface: `app.js`, `domain.js`, `razao.js`, `diario.js`, `livro.js`, `graficos.js`, os `.css` e o `index.html`.

Os dados da empresa são cifrados no navegador: sem a senha, não há nada legível deles aqui. A exceção são as
maquetes do Laboratório (`galeria/` e `apps/`), que são públicas e só têm dados fictícios.

## O que há em cada arquivo

| Arquivo | O que faz |
|---|---|
| `index.html` | A página, com a política de segurança (CSP). Só fala com o próprio site, com o servidor do diário e com a PTAX do BCB. |
| `static-bridge.js` · `portal-crypto.js` | Abrem o pacote cifrado com a senha e abrem o diário. |
| `domain.js` | O domínio que já existia: assinaturas, cobranças e rateio, em centavos inteiros. |
| `razao.js` | O livro-razão:<br>· parâmetros com vigência (câmbio, spread, IOF, impostos, taxas);<br>· lançamentos das sócias, conferência e conciliação da fatura;<br>· assinaturas, passos de venda, acertos, saldos e receitas;<br>· fechar e reabrir o mês, com a trava do que forma os números;<br>· o mês calculado, o acerto entre sócias e o CSV para o contador. |
| `diario.js` | O diário cifrado: cada gravação é cifrada (AES-GCM) e assinada (ECDSA) no navegador, e o servidor só guarda texto cifrado. Fala com o armazenamento por uma **porta** (`portaHttp`, `portaMemoria` ou uma sua): o contrato está em `docs/PORTAS.md`. |
| `livro.js` · `graficos.js` · `livro.css` | As páginas Livro do mês, Lançamentos, Parâmetros e Histórico, o botão "+ Lançar", os gráficos e os ganchos das páginas novas (`registrarPagina`, `abrirFolha`, `campoDinheiro`, `gravar`). |
| `ferramentas/importar-livro-caixa.py` | Lê o Excel sem salvá-lo: detecta o cabeçalho de cada mês, confere movimentos, saldos e totais em centavos e grava a extração somente fora do site público. |
| `ferramentas/atualizar-livro-caixa.mjs` | Incorpora a extração com a mesma chave e preserva diário, senhas, perfis e interface. Reconfere cifra, cadeia e assinaturas do diário com GET, exige backup externo e não publica nem grava no servidor. |
| `endereco-diario.js` | Endereço único do diário publicado, compartilhado pela ponte e pelo atualizador. Não há seletor de ambiente nem destino vindo da planilha. |
| `rotina.js` e `assinaturas.js` · `acerto.js` · `caixa.js` · `conciliacao.js` · `fechamento.js` · `ajuda.js` | As páginas da rotina do mês (fase 2), cada uma com o seu `.css`. |
| `fiscal.js` | O núcleo fiscal puro: Simples (anexos III e V, com a 6ª faixa da lei), fator R, DAS estimado, Presumido e o calendário fiscal com `.ics`. Tudo informa, nada aconselha: confirmar com o contador. |
| `app.js` · `style.css` · `tema.css` | A interface que já existia. |
| `galeria.js` | O Laboratório: lê o catálogo e as maquetes de `galeria/` (mesma origem) e junta os documentos antigos do pacote cifrado como "Sem stand". Quando o mesmo arquivo existe nos dois, vence o do repositório. |
| `galeria/` | O catálogo (`index.html`) e as maquetes com stand (`apps/<id>.html`) que o item Laboratório mostra numa moldura isolada. **Não se edita aqui**: vem do ia-chat, com `python3 laboratorio/publicar.py <pasta do portal>`. |
| `apps/<id>/` | A versão **tela cheia** de cada maquete, para abrir numa aba à parte e pôr na Tela de Início do iPhone: o app sozinho (`index.html`), `manifest.webmanifest` e os ícones 180, 192 e 512. Também vem do publicador do ia-chat. Endereço: `https://bauerfilho.github.io/orquestrator-portal/apps/<id>/`. |
| `servidor/` | O servidor do diário (função Netlify com Blobs). Como publicar: `servidor/LEIA.md`. |
| `docs/` | `PLANO-PORTAL.md` (o plano aprovado), `PLANO-FASES-2-3.md` (as fases 2 e 3 fatiadas), `PORTAS.md` (como plugar outro armazenamento no diário) e `CHECKLIST.md` (o que foi feito e o que falta). |

## O Med Painel não fica no portal (27/10/2026)

O portal é um site público: tudo o que não está no pacote cifrado pode ser baixado por quem tiver o endereço. A maquete
"Med Painel no iPhone" levava o núcleo do app e as 2.496 bulas em texto aberto, e por isso saiu, junto com a mesa de
teste e o empacotador (`ferramentas/maquete-med-painel`). As cópias estão em `~/Projetos/_backups/portal-medpainel-20261027`.
O teste `o Med Painel não está publicado no portal` falha se algum deles voltar. Para mostrar o Med Painel de novo aqui,
só com uma forma protegida (decisão do Bauer).

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
python3 testes/importar-livro-caixa.test.py                     # importador, com openpyxl e arquivos fictícios
node ferramentas/arnes/servir.mjs 8765                        # o portal local, sem senha: http://127.0.0.1:8765/?demo=1
node ferramentas/arnes/fotografar.mjs --query "demo=1"        # fotos de todas as páginas, claro/escuro, desktop/celular
```

No arnês, `?diario=local` grava de verdade, cifrado, num servidor do diário em memória. `?membro=m-ana` mostra o portal
como a Ana. `?galeria=1` mostra o Laboratório com a `galeria/` do repositório, e `?legado=1` junta um pacote antigo de
mentira (um documento "Sem stand" e um Sinal antigo, que tem de perder para o do repositório). As fotos falham se a
página registrar erro de script ou violação de CSP.

## Livro-caixa, diário e conciliação

O `state.livroCaixa` fica **dentro do pacote cifrado**, nunca num JSON público. Cada movimento preserva a aba, a linha,
a data, a categoria, a forma, o documento, o saldo na ordem da planilha e as observações. As saídas alimentam o razão;
as entradas de capital não viram receita de vendas. Meses vazios não criam pagamentos nem previsão de entrada.

**Saldo escriturado não é saldo bancário conciliado.** O Caixa mostra a fonte separada dos saldos bancários informados
no diário. Importação não inventa quem pagou, quem lançou, comprovante, repasse ou assinatura de uma sócia. A linha da
planilha é somente leitura; a correção se faz na fonte e numa nova importação. Pagamento único não é custo mensal.

Se o diário já contiver os mesmos gastos, não somar, apagar ou anular automaticamente. A decisão do responsável fica
em `livroCaixa.conciliacao`, com os IDs aprovados, o limite de sequência e a autorização. Esses registros continuam no
Histórico e no filtro **Histórico conciliado**, sem repetir custo nem entrar no selo novo. Isso **não perdoa dívidas**:
reembolsos, Pix e aportes já assinados continuam nos acertos, uma vez só. O atualizador recusa levar para histórico
uma obrigação ainda pendente; resolvê-la é uma decisão separada. Eventos novos continuam contando. A reimportação
comum não pode revogar a conciliação nem alterar registros assinados ou meses fechados.
O congelamento documental inclui entradas, saldos, descrições e observações da aba fechada, não só os custos do selo.
Uma compra avulsa não converte a assinatura recorrente do mesmo fornecedor em pagamento único. Essa normalização só
vale quando o próprio plano já declara o caráter único (período ou nome); contradição fica `PENDENTE`.

Fluxo local (os caminhos abaixo são exemplos, sem credenciais reais):

```zsh
python3 ferramentas/importar-livro-caixa.py /pasta/privada/livro.xlsx --saida /pasta/privada/livro.json
node ferramentas/atualizar-livro-caixa.mjs --portal . --livro /pasta/privada/livro.json --credenciais /pasta/privada/credenciais.json --diario /pasta/privada/diario-conferido.json --backup /pasta/privada/backup-novo
node ferramentas/arnes/fluxos/livro-caixa.mjs --saida /pasta/privada/provas-lancamentos
node ferramentas/arnes/fluxos/caixa.mjs --saida /pasta/privada/provas-caixa
```

O retrato do diário deve vir de leitura integral. O atualizador não confia no booleano do JSON: abre o mesmo diário
publicado com `diario.js`, somente por GET, verifica cadeia e assinaturas, exige igualdade com o retrato e reconfere a
cabeça imediatamente antes da troca. Servidor inacessível, assinatura adulterada, cópia antiga ou diário que avançou
fazem parar sem substituir o manifesto. Trava e manifesto temporário ficam fora do site.
O pacote só entra no site depois da última leitura da cabeça. Uma falha limpa o pacote novo não referenciado;
não apaga arquivo selecionado por outro manifesto nem qualquer versão anterior. A trava coordena instâncias
do atualizador; outros publicadores também precisam respeitá-la e reconferir o diário antes de publicar.

O importador não avalia
fórmulas: se o Excel não tiver os valores calculados, ele pede recálculo em vez de inventar zero. A extração não
sobrescreve arquivos, e o empacotador usa trava, conferência de versão, backup e troca atômica do manifesto. Ele não
roda o antigo `montar.mjs`, que poderia sobrescrever a interface. Projeções de `estadoEfetivo` nunca viram semente de
planos: isso duplicaria eventos de assinatura e colaria o status pago nos meses seguintes. Vínculo da fonte a uma
assinatura que existe **só no diário** fica `PENDENTE` e interrompe a importação; não se inventa uma semente para
contornar a integridade da abertura ou dos selos. Commit, push e deploy continuam sendo atos separados.
