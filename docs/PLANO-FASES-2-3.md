# Fases 2 e 3 do portal: o plano fatiado

Gerado em 19/10/2026 a partir do `PLANO-PORTAL.md` aprovado, conferido contra o código por um crítico. Cada fatia é
uma entrega do tamanho de um PR, com os arquivos que mexe, os dados, as telas, os testes e quando está pronta.

## Ordem de execução

| Fatia | Tamanho | Depende de | Precisa do Bauer |
|---|---|---|---|
| **F2-1-nucleo-eventos** · Núcleo da rotina: as ações novas do diário | G | — | Confirmar D3 (a responsável é quem tem papel owner no pacote, hoje o Bauer) e D8 (fechar até o dia 5, só mês terminado, reabrir com motivo). Decidir se receitas podem ser lançadas por qualquer sócia (proposta, como o interino dos parâmetros) ou só pela responsável (texto do plano). |
| **F2-2-base-ui** · Base das telas novas: ganchos, folha comum, contêineres e gráficos do caixa | M | — | — |
| **F2-3-contas-selo-demo** · As contas da rotina: acerto acumulado, receitas, fôlego, 12 meses e o selo | G | F2-1-nucleo-eventos, PR-laboratorio-perfis (merge) — só a troca na ponte-simulada.js | — |
| **F2-4-navegacao-rotas** · Mapa do portal: menu em grupos, um endereço para cada página e a faixa de treino em todas | M | F2-2-base-ui, PR-laboratorio-perfis (merge) | — |
| **F2-5-assinaturas-vender** · Assinaturas e Vender primeiro sem arquivo | M | F2-1-nucleo-eventos, F2-3-contas-selo-demo, F2-4-navegacao-rotas, PR-laboratorio-perfis (merge) | Confirmar que, daqui para a frente, as assinaturas e os passos de venda só mudam pelo portal: o arquivo de planos do pacote de 18/10 vira a base congelada. 'Confirmar por outra sócia' só vale de verdade com o servidor publicado (em treino há uma pessoa só no navegador). |
| **F2-6-acerto** · Acerto, reembolso e aporte na Sociedade e no Meu painel | M | F2-2-base-ui, F2-3-contas-selo-demo, F2-4-navegacao-rotas | — |
| **F2-7-caixa** · Caixa: receitas, saldos, fluxo de 12 meses, cascata, fôlego e a manchete do Meu painel | G | F2-3-contas-selo-demo, F2-6-acerto | Aplicar o teste de 10 segundos (§8.8) com as três sócias, de preferência depois de publicar o servidor. |
| **F2-8-conciliacao** · Conciliar a fatura e a PTAX do dia | M | F2-2-base-ui, F2-3-contas-selo-demo | Conferir o spread com a primeira fatura real do cartão da empresa (hoje 4%, 'a confirmar'). |
| **F2-9-fechamento** · Fechar o mês: roteiro de 6 passos, selo, pacote do contador e Exportar | M | F2-3-contas-selo-demo, F2-4-navegacao-rotas, F2-6-acerto, F2-8-conciliacao | Publicar o servidor do diário (sem ele o fechamento é treino e some ao recarregar); fechar outubro de verdade com as sócias até 05/11; mandar o pacote ao contador e trazer o retorno sobre o formato (é o 'pronto quando' da P1.1); confirmar D8. |
| **F2-10-ajuda-estado** · Como fazer, treino visível, primeiro acesso, Estado do portal e controles do mês fechado | M | F2-3-contas-selo-demo, F2-4-navegacao-rotas, F2-5-assinaturas-vender, F2-7-caixa | Decidir o texto de 'Esqueci a senha': sem o montar.mjs ninguém troca senha hoje (as senhas são as do pacote de 18/10); é a D10 em aberto. |
| **F2-11-exatidao-conflito** · Exatidão que faltou da P0 e o diálogo de conflito | M | F2-5-assinaturas-vender, F2-10-ajuda-estado, PR-laboratorio-perfis (merge) | — |
| **F2-12-diario-paginado** · Diário inteiro em qualquer tamanho: paginação no cliente e leitura em paralelo no servidor | P | — | — |
| **F3-1-fiscal-nucleo** · Núcleo fiscal puro: Simples, fator R, DAS, Presumido e calendário com .ics | M | — | Nada para começar. Antes da F3-3 ir ao ar: confirmar com o contador a regra de dia não útil do DAS, quais obrigações se aplicam e se a folha do fator R é só o pró-labore. |
| **F3-2-ganchos** · Ganchos de extensão: ações registráveis no razão, pontes genéricas e campos novos do lançamento | M | F2-9-fechamento, F2-10-ajuda-estado, F2-11-exatidao-conflito, F2-12-diario-paginado, PR-laboratorio-perfis (merge) | — |
| **F3-3-impostos** · Página Impostos: DAS estimado, fator R, faixa, comparador de regime e prazos no calendário | M | F3-1-fiscal-nucleo, F3-2-ganchos | D9: regime atual, data de início de atividade, município da sede (ISS) e quem é o contador. Confirmar com o contador a regra de dia não útil do DAS e as obrigações listadas. Para saber já (informação, não conselho): o DAS da competência outubro vence num feriado nacional, 20/11/2026. |
| **F3-4a-medpainel** · Med Painel ligado aos parâmetros, com o motor em centavos e o simulador 'e se' | G | F3-1-fiscal-nucleo, F3-2-ganchos | Confirmar o canal de venda principal do Med Painel (Hotmart, Apple ou Stripe) e se qualquer sócia pode mudar premissa (recomendado: sim, com fonte e registro). |
| **F3-5-comprovantes** · Comprovantes cifrados: foto ou PDF anexado ao gasto, guardado no servidor do diário | M | F3-2-ganchos | Publicar o servidor (sem ele os comprovantes só existem em treino, na aba) e conferir o consumo de Netlify Blobs no plano gratuito antes de liberar para as sócias. |
| **F3-6-pagantes** · Usuários e pagantes: funil, receita recorrente e churn por produto, com importação agregada no aparelho | M | F3-2-ganchos | Mandar só a linha de cabeçalho (nomes das colunas, sem nenhum dado) dos relatórios reais da Hotmart, da Stripe e da Apple, e dizer qual produto corresponde a cada canal. Nunca subir um relatório real ao repositório (ele é público). |
| **F3-7-portfolio-lab** · Portfólio com custo por projeto e decisão de destino pelo diário; catálogo nativo do Laboratório | M | F3-2-ganchos, PR-laboratorio-perfis (merge) | Confirmar quem é a responsável (D3) e a lista de destinos; se quiser chips diferentes, revisar a 'proposta' de cada maquete no ia-chat (o publicador gera o catálogo). |
| **F3-8-origem-propria** · Origem própria com cabeçalhos de segurança no Netlify e a fila de envio que não se perde | M | F3-2-ganchos, F3-5-comprovantes | Tudo o que vai ao ar: (1) só depois deste merge, trocar o Base directory do site no painel da Netlify de 'servidor' para a raiz (testar numa prévia; antes disso a raiz não tem netlify.toml e a publicação quebraria); (2) decidir o endereço — recomendação: manter orquestrator-diario.netlify.app (grátis, nada a reconfigurar); renomear ou comprar domínio (.com.br, cerca de R$ 40 por ano) é cosmético e exige trocar o endereço do diário no github.io; (3) preencher ORIGEM_OFICIAL e avisar as sócias (refazer o atalho da tela de início); (4) decidir quando o GitHub Pages passa a só redirecionar. |
| **F3-4b-projecao-empresa** · Projeção da empresa com o motor do Med Painel e a base nos meses fechados | M | F3-4a-medpainel | — |
| **F3-9-face-id** · Entrar com Face ID (passkey com PRF), sem digitar a frase-senha | G | F3-7-portfolio-lab, F3-8-origem-propria | D16: liberar ou não o Face ID no bauerfilho.github.io (recomendação: não; ligar direto na origem própria da F3-8). Publicar o servidor. Testar no iPhone (iOS 18 ou mais novo) e no Mac. |

## Correções do crítico e decisões em aberto

CORREÇÕES DO CRÍTICO (conferidas no código, branch claude/laboratorio-no-portal com o PR ainda sem commit em app.js, static-bridge.js, ponte-simulada.js, style.css, galeria.js e galeria/):
1. Tabela do Simples (F3-1, F3-3): a 6ª faixa é descontínua por lei nos dois anexos (III em R$ 3,6 mi: 21% − 125.640 = 630.360 contra 33% − 648.000 = 540.000; V: 23% − 62.100 = 765.900 contra 30,5% − 540.000 = 558.000). O teste de 'continuidade nas 10 viradas' e o set_tabela_simples recusariam a tabela oficial. Agora a continuidade vale para as 8 viradas das faixas 1→5, e a 6ª é conferida contra docs/premissas-padrao-pesquisa.json.
2. close_month sem falso conflito (F2-1): o diario.acrescentar reenvia o MESMO conteúdo numa posição seguinte depois de um 409, então 'cabeca = seq anterior' recusaria fechamentos legítimos e sujaria o Histórico. Recusa só se entrou evento que muda aquele mês. E só se fecha mês terminado (mês < mês do evento; nos testes, relógio do Playwright em 03/11).
3. Selo e trava só cobrem o que forma os números do mês (F2-1, F2-3): acertos, reembolsos, conversões, mark_reimbursed e saldos ficam fora do selo e não travam. Sem isso, o Pix de outubro feito em novembro e o saldo de 31/10 informado em 04/11 seriam recusados (o próprio rascunho apontava esse risco). fotoDoMes lista os campos que entram nas contas, não versões.
4. Sociedade: #sociedade-acerto vai DEPOIS de #society-content. O PR em andamento desenha os perfis dentro dele (renderSociety + host().perfis). O rascunho punha o acerto antes e, nos riscos, pedia perfis em cima.
5. F3-7 não cria galeria/catalogo.json: galeria/ é reescrita pelo publicador do ia-chat ('não se edita aqui', README). Ela já traz o catálogo em <script id=catalogo> com proposta (Pago…), resumo e modelo_negocio. O chip sai daí, por galeria.js.
6. Demonstração com autoria (F2-3): d.acrescentar assina tudo como a sessão. Os eventos de Ana, Bauer e Beatriz entram direto em d.eventos no treino.
7. Diário acima de 500 registros (nova F2-12): GET /eventos devolve no máximo 500 e sincronizar busca uma vez só. Em ~5 meses a primeira tela e um selo sairiam de um diário pela metade. Somam-se a paginação no cliente e a leitura em paralelo no servidor.
8. Treino visível desde a F2-4 (faixa global): cada fatia vai ao ar sozinha. Sem isso, 'Confirmar' e 'Recebi' pareceriam salvos em Assinaturas e Sociedade até a F2-10.
9. Nenhuma página vazia no ar: Como fazer e Estado do portal entram na gaveta só na F2-10.
10. Menos duplicação na F3-2. Saem dela:
   - o kit.js (os ajudantes já são exportados pelo livro.js na F2-2);
   - o registro de páginas em tempo de execução e as fotos pelo registro (vão para a F2-4);
   - a troca do DIARIO_URL (vai para a F3-8);
   - o pró-labore (entra já na F2-1, D15).
   Entram as pontes genéricas (sobrepor e ações antigas). Assim a F3-7 não edita static-bridge.js nem ponte-simulada.js e roda junto da F3-8. A F3-2 passa a mapear /demo/* no servir.mjs, que faltava.
11. A F3-9 precisa do app.js: a lista fechada de ações em app.js:8 e a entrada sem senha. A F3-4 foi dividida em F3-4a (motor e Med Painel) e F3-4b (Projeção da empresa): numa sessão só ela não cabia.
12. Campos antecipados na F2-1:
   - edit_plan com o status livre, porque o planForm atual edita esse campo;
   - add_income com testes e canceladosMinor, para a F3-6 e a F3-3 não mexerem no razao.js;
   - recusas com codigo e o registro atual, para o diálogo de conflito.
13. Fatias que faltavam:
   - Lançamentos ganha 'Reembolsar' e 'Converter em aporte' no lugar de 'Marcar reembolsado' (F2-6), para não haver dois jeitos de quitar o mesmo gasto;
   - Exportar CSV de parâmetros e do histórico, P0 que ninguém fez (F2-9, pelos extras novos 'parametros-barra' e 'historico-barra');
   - cadeado de mês fechado nos controles (F2-10);
   - o ciclo de 2 s não redesenha com folha aberta e a página atualiza logo depois de gravar (F2-2, F2-5).
14. Testes de §8 com dono:
   - contraste dos tokens e mínimo de 12px nos CSS novos: F2-2;
   - §8.1: F2-5 (plano inativo), F2-11 (o resto) e F3-4a (mpRepartir, fixed_monthly);
   - §8.5 itens 1, 2, 5 e 6: F2-11;
   - §8.5 itens 3, 7 e 8: F3-8.
   Não se aplicam:
   - §8.5.4, porque não há propostas (D4);
   - §8.4 itens 6 a 8 (piso journal_head, chave estável entre publicações, época), porque o pacote está congelado;
   - limite por sócia do §8.6, porque o token é comum, derivado da chave do diário. É risco aceito.
15. O teste da F2-5 'mesmo content_revision' era impossível com campos novos. Virou comparação dos blocos, menos as mudanças listadas.
16. Fluxos Playwright versionados em ferramentas/arnes/fluxos/<fatia>.mjs (um arquivo por fatia, sem conflito). Fotos e artefatos ficam fora do repositório. README.md e docs/CHECKLIST.md: só o integrador, no merge.
17. Dependências corrigidas:
   - a F2-6 depende da F2-4 (livro.js);
   - a F2-9 não precisa da F2-7.
   Arquivos que faltavam:
   - index.html e paginas.js na F2-10;
   - servir.mjs na F3-2;
   - app.js na F3-9.

ORDEM COM 2 AGENTES (cada onda = 2 fatias sem arquivo em comum, conferido):
1. F2-1 ‖ F2-2
2. F2-3 ‖ F2-4
3. F2-5 ‖ F2-6
4. F2-7 ‖ F2-8
5. F2-9 ‖ F2-10
6. F2-11 ‖ F2-12
7. F3-2 ‖ F3-1
8. F3-3 ‖ F3-4a
9. F3-5 ‖ F3-6
10. F3-7 ‖ F3-8
11. F3-4b ‖ F3-9

Por que essa ordem:
- Primeiro vêm Assinaturas e Acerto (uso diário e o 'só leitura' que mais irrita), depois Caixa e Conciliação (a fatura chega no começo do mês), depois Fechamento, a tempo de fechar outubro até 05/11.
- Impostos é a primeira da fase 3 (DAS de outubro em 23/11).
- Projeção da empresa fica por último: só tem sentido com 2 ou 3 meses fechados.

Plano B, se o PR ainda estiver aberto na onda 2:
- F2-3 sem a troca na ponte ‖ F3-1;
- F2-4 ‖ F2-8;
- F2-5 (com a troca da demonstração) ‖ F2-6;
- F2-7 ‖ F2-12;
- F2-9 ‖ F2-10;
- F2-11 sozinha;
- depois a fase 3 como acima.

Coringas para qualquer espaço livre: F3-1 e F2-12. Arquivos que travam até o merge do PR: app.js, static-bridge.js, ponte-simulada.js, style.css, galeria.js, testes/galeria.test.mjs e perfis.js. Cada fatia sai do main atualizado e termina num PR; o merge publica no GitHub Pages e é do Bauer.

TREINO × SERVIDOR: tudo funciona nos dois modos.
Só valem de verdade com o servidor publicado:
- confirmar assinatura por outra sócia;
- 'Recebi';
- o selo conferido pelas três em aparelhos diferentes;
- o pacote para o contador (em treino sai marcado TREINO);
- 'Sincronizado' e o diálogo de conflito real;
- comprovantes;
- fila persistente;
- Face ID.
Funcionam já, nos dois modos: PTAX, importação de CSV e todas as contas.

FICA FORA DESTAS FASES (P0 visual, não P1/P2):
- resumo e ranking de Assinaturas;
- bullet de teto (F14);
- glossário clicável;
- escala tipográfica do style.css legado;
- valor por extenso no + Lançar;
- degraus SVG dos parâmetros;
- participationHistory e troca de participação;
- quatro olhos (D4).
Merecem uma fatia futura.

DECISÕES QUE PRECISAM DO BAUER:
1. Publicar o servidor do diário agora, como diz servidor/LEIA.md (Base directory 'servidor'). É o que mais destrava: sem ele nada da fase 2 persiste, e o fechamento de outubro (até 05/11) só vale com ele. Trocar a pasta base para a raiz só depois do merge da F3-8.
2. D3: a responsável é o papel owner do pacote (hoje ele).
3. D8: fechar até o dia 5, só mês terminado, reabrir com motivo.
4. Receitas e conciliação por qualquer sócia (proposta) ou só pela responsável (plano).
5. Assinaturas e passos de venda só pelo portal daqui para a frente (o pacote de 18/10 vira base congelada). Confirmar assinatura: por outra sócia, ou só a responsável aplica?
6. D9, urgente, falar com o contador esta semana: regime, início de atividade, município e contador.
   - 30/10: prazo da opção por IBS/CBS fora do DAS.
   - 01/11: NFS-e nacional obrigatória.
   - DAS de outubro: vence em 20/11, feriado nacional, provavelmente passa para 23/11.
   Isto é informação, não conselho.
7. D10: sem o montar.mjs ninguém troca senha. Trocar exige regerar o pacote no Mac, o que muda a chave mestra: o perfis.json precisa ser cifrado de novo e o diário pede que uma sócia entre para liberar as chaves. Decidir se fica com as senhas atuais.
8. Endereço próprio: recomendação de não renomear o site e usar orquestrator-diario.netlify.app, que já é uma origem só do portal. Renomear ou comprar domínio é cosmético e exige trocar o endereço do diário no github.io.
9. D16: Face ID no github.io ou só na origem própria. Recomendação: só na origem própria.
10. Mandar só a linha de cabeçalho dos relatórios da Hotmart, da Stripe e da Apple.
11. Conferir o spread na primeira fatura real, e as taxas do Google (15%) e da Apple.
12. Com as sócias:
   - teste de 10 segundos e tarefas cronometradas;
   - fechar outubro de verdade;
   - mandar o pacote ao contador e trazer o retorno;
   - conferir a cota do Netlify Blobs antes dos comprovantes;
   - testar o Face ID no iPhone.
13. Revisar e fazer o merge de cada PR (o merge publica em produção).

## F2-1-nucleo-eventos · Núcleo da rotina: as ações novas do diário

**Para as sócias:** Assinaturas, passos de venda, acertos, saldos, receitas e o fechamento viram registros do diário, com as mesmas regras e as mesmas recusas em qualquer navegador.

**Do plano:** §4.2 (plans com version, settlements, balances, income, closings); §4.5 (check_expense, reconcile_statement no lugar de set_statement_value, add/edit/confirm/archive/reactivate_plan, record_payment, toggle_step por id+version, set_balance, add/edit/void_income, record_settlement/confirm_settlement, convert_to_contribution, close_month/reopen_month); §4.6 F6 (previsto só com planos ativos e confirmados, encerrado fora); D8 e F16 (trava do mês fechado); §3.8 (versão por registro e código da recusa para o diálogo de conflito); §3.9 (evento inválido vira recusado com motivo); §3.12 (dono por coleção: plans e selling.steps = base do pacote + eventos por id+version); D15 (categoria Pró-labore).

**Arquivos:** `razao.js`, `testes/razao-eventos.test.mjs`

**Dados:** Conteúdo do evento mantido ({acao, alvo, versao?, dados, motivo?, quando}). Dinheiro sempre valorMinor inteiro seguro > 0 (saldo ≥ 0) com moeda em DIGITOS; papel sempre lido do estado, nunca do evento. Ações agrupadas em aplicarGasto/aplicarPlano/aplicarDinheiro/aplicarMes:
- check_expense {alvo, versao}: outra sócia que não quem lançou; estado conferido, conferidoPor/Em.
- reconcile_statement {dados:{mes, forma, totalFaturaMinor|null, itens:[{alvo, versao, faturaBrlMinor}]}}: cada item existe, não anulado, moeda ≠ BRL, mesma forma e competência = mes; grava faturaBrlMinor e versao++; um registro no histórico com Σ estimado → Σ fatura e o Δ (F4).
- record_payment {alvo novo, dados = campos de add_expense + planoId (plano ativo) + ciclo AAAA-MM obrigatórios}: verbo 'marcou como paga'. Um add_expense comum com planoId também conta como pagamento do ciclo da sua competência (são dois caminhos para o mesmo fato).
- convert_to_contribution {alvo, versao}: só quem pagou; gasto empresa_reembolsa pendente passa a contar como aporte (convertidoEm/Por), sem mudar valor, competência nem categoria.
- add_plan {alvo 'pl-…', dados:{servico≤80, plano≤80, valorMinor, moeda, periodo ∈ chaves de EQUIVALENTE, diaVencimento 1–31|null, proximaData|null, categoria, status≤240}}: nasce confirmed=false (fora do previsto) e ativa.
- edit_plan {alvo, versao, dados parciais com os mesmos campos, inclusive o status livre}: mudar valor, moeda ou período tira a confirmação.
- confirm_plan {alvo, versao}: outra sócia que não a última a criar/alterar, ou a responsável.
- archive_plan {alvo, versao, dados:{desde}, motivo} e reactivate_plan {alvo, versao}.
- toggle_step {alvo = id do passo do pacote, versao, dados:{feito}}: qualquer sócia. Registros do pacote entram como versão 1 sem autora.
- record_settlement {alvo 'ac-…', dados:{tipo ∈ reembolso_empresa|acerto_entre_socias|aporte|retirada, de, para (sócia ou 'empresa'), valorMinor BRL, data, forma ∈ pix|transferencia|dinheiro|outro, gastoIds[], nota}}: reembolso e retirada só a responsável (de='empresa'); acerto e aporte só a própria 'de'; no reembolso com gastoIds, cada gasto é empresa_reembolsa pendente da 'para' e o valor = Σ reais deles. confirm_settlement {alvo}: só a 'para' (a responsável quando para='empresa').
- set_balance {alvo 'sd-…', dados:{conta≤60, data ≤ dia do evento, valorMinor ≥ 0, moeda, fonte≤160, nota}}: qualquer sócia; vale o de maior data por conta, desempate pelo seq.
- add_income {alvo 'rc-…', dados:{competencia, canal ∈ hotmart|stripe|apple|google|outro, produto≤60, brutoMinor ≥ 0 (já sem cancelamentos), canceladosMinor|null, moeda BRL|USD, transacoes int ≥ 0, taxasMinor|null, pagantesAtivos/Novos/Perdidos, testes, cadastros int|null}}, edit_income {alvo, versao, motivo se de outra sócia}, void_income {alvo, versao, motivo}: qualquer sócia (interino, ver precisa_do_bauer). Os campos testes e canceladosMinor entram já para a F3-6 e a F3-3 não precisarem mexer no razao.js.
- close_month {alvo 'AAAA-MM', dados:{cabeca, selo (64 hex), totais:{realizado, previsto, total, resultado}}}: só a responsável; só mês terminado (mês < mês de quando); mês não fechado; recusado ('O diário andou enquanto você fechava') apenas se, entre o seq cabeca e este evento, entrou evento aceito que mude aquele mês (gasto, receita ou fatura da competência, parâmetro com desde ≤ último dia, plano criado/alterado/encerrado). NÃO exige cabeça exata: num 409 o diario.js reenvia o mesmo conteúdo numa posição seguinte, e um gasto de novembro no meio não invalida outubro. Guarda fechamentos[mes] {seq, cabeca, selo, totais, por, em, ordemParametros, planosNaHora (cópia dos planos efetivos), reaberturas[]}. O selo é conferido no contas.js (F2-3).
- reopen_month {alvo, motivo obrigatório}: só a responsável.
- Trava do mês fechado (só o que forma os números do mês): recusa add/edit/void_expense e record_payment pela competência (na edição, a antiga e a nova), check_expense e reconcile_statement de gastos do mês, add/edit/void_income da competência. NÃO travam: acertos, reembolsos, conversões, mark_reimbursed, saldos, parâmetros e planos (o mês fechado já usa os parâmetros e planos da hora). Assim o Pix de outubro registrado em novembro e o saldo de 31/10 informado em 04/11 continuam possíveis.
- livroDoMes ciente do fechamento: mês fechado usa só parâmetros com ordem < ordemParametros e os planosNaHora. Previsto passa a usar os planos efetivos, categoria explícita do plano antes do palpite, e ignora plano encerrado com desde ≤ último dia do mês.
- estadoEfetivo(estadoBase, aplicado, hoje): cópia do estado com plans (pacote + eventos: confirmed, subscriptionState, changedAt/By, confirmedBy; paymentStatus 'pago' com paymentStatusExplicit=true e nextDate do próximo ciclo quando há gasto ligado ao ciclo) e selling.steps (checked, checkedBy/At); passa no validateState do domain.js.
- Recusas ganham codigo ∈ versao|mes_fechado|permissao|invalido|repetido e, em 'versao', o registro atual {versao, alteradoPor, alteradoEm, resumo} (o diálogo de conflito da F2-11 usa isso).
- aplicar devolve também planos, passos, acertos, saldos, receitas, fechamentos; todo item do historico ganha verbo em português e antes/depois; exporta VERBOS e ACOES.
- mark_reimbursed continua aceito (legado do treino) e conta como reembolso no F12.
- CATEGORIAS ganha {id:'pro_labore', rotulo:'Pró-labore e folha', slot:0} (D15, base do fator R); CATALOGO ganha taxa.google_pct (15%, a confirmar).

**Telas:** Nenhuma tela. Recusas curtas e didáticas, por exemplo: 'Outubro está fechado. A responsável reabre, com motivo, se precisar mudar.' · 'Só dá para fechar um mês que já terminou.' · 'Só quem recebe confirma o recebimento.' · 'Quem confirma a assinatura é outra sócia: são quatro olhos nos dados da fatura.' · 'O valor não bate com os gastos escolhidos (R$ 59,90).' · 'O diário andou enquanto você fechava. Confira e feche de novo.'

**Testes:** node --test testes/*.test.mjs. Em testes/razao-eventos.test.mjs: um teste por ação (aceita e recusa com o motivo e o codigo esperados); trava em gasto (inclusive edição que leva a competência para dentro ou para fora do mês fechado), receita, fatura e conferência; acerto, saldo, conversão e mark_reimbursed em mês fechado ACEITOS; close_month aceito com um gasto de novembro entre cabeca e ele, recusado com um gasto de outubro entre os dois, recusado no mês corrente e por quem não é a responsável; livroDoMes de outubro fechado igual antes e depois de set_parameter do dólar, edit_plan e archive_plan; estadoEfetivo passa em validateState e o buildSnapshot mostra plano novo (a confirmar), confirmado, encerrado e pago (inclusive por add_expense com planoId); previsto não conta assinatura a confirmar nem encerrada; recusa de versão traz codigo 'versao' e o registro atual; determinismo (aplicar 3 vezes dá o mesmo JSON); alvo repetido recusado; nenhuma ação aceita valor negativo, moeda desconhecida, autora fora do estado nem papel declarado no evento; testes/razao.test.mjs intacto (outubro do plano centavo a centavo).

**Pronto quando:** Testes antigos e novos verdes; só os dois arquivos mudaram; ACOES lista as ações novas; o exemplo de outubro do §4.6 continua batendo; o chip 'Pró-labore e folha' aparece sozinho no + Lançar (que lê R.CATEGORIAS).

**Riscos:** razao.js passa de ~380 para ~850 linhas: manter funções por grupo e o mesmo estilo; mudar livroDoMes pode quebrar a fase 1 (a suíte antiga é a rede); estadoEfetivo precisa manter os campos que o domain.js valida; a regra de concorrência do close_month precisa saber quais eventos 'mudam o mês' (lista fechada e testada); maior fatia da fase: escrever os testes primeiro.

## F2-2-base-ui · Base das telas novas: ganchos, folha comum, contêineres e gráficos do caixa

**Para as sócias:** As telas da rotina nascem com a mesma cara e o mesmo jeito de gravar, e os gráficos de 12 meses e da cascata ficam prontos e testados antes de entrar nas páginas.

**Do plano:** §6.6 (fluxo em barras divergentes com linha de saldo, cascata, minigráfico, um tab stop por gráfico, tabela equivalente, 'Como ler'); §6.3 (sólido = pago, contorno = estimado, hachura = previsto, cadeado = mês fechado); §6.7 (.sheet de 520px no desktop e de baixo no celular); §3.7 (nunca redesenhar com folha aberta); §6.2 e §8.8 (contraste dos tokens medido em teste); §8.7 (fotos, 0 erros, sem rolagem a 390px).

**Arquivos:** `livro.js`, `graficos.js`, `livro.css`, `index.html`, `rotina.js (novo)`, `assinaturas.js (esqueleto novo)`, `acerto.js (esqueleto novo)`, `caixa.js (esqueleto novo)`, `conciliacao.js (esqueleto novo)`, `fechamento.js (esqueleto novo)`, `ajuda.js (esqueleto novo)`, `assinaturas.css (vazio novo)`, `acerto.css (vazio novo)`, `caixa.css (vazio novo)`, `conciliacao.css (vazio novo)`, `fechamento.css (vazio novo)`, `ajuda.css (vazio novo)`, `ferramentas/arnes/vitrine-graficos.html (novo)`, `ferramentas/arnes/vitrine-graficos.js (novo)`, `ferramentas/arnes/fotografar.mjs`, `testes/contraste.test.mjs (novo)`

**Dados:** Nenhum evento novo e nenhuma mudança no razao.js. livro.js passa a exportar (sem mudar o comportamento) os ajudantes puros (el, botao, cartao, kpi, dado, pilula, dataBR, horaBR, nomeDe, hojeDe, campoComRotulo) e os de estado (dados, gravar, toast, verConta, pedirTexto, faixaModo, renderTudo), e ganha: registrarPagina(fn) (chamada a cada renderTudo); registrarExtra(lugar, fn) com os lugares 'livro-topo', 'lancamentos-barra', 'parametros-barra' e 'historico-barra'; abrirFolha({eyebrow, titulo, corpo, acoes}) que marca 'folha aberta' (renderTudo e as páginas registradas não redesenham enquanto ela estiver aberta, como já acontece com o + Lançar); campoDinheiro(moeda) (centavosBR). gravar aceita qualquer ação (prévia pelo R.aplicar, erro no formulário); o Desfazer de 8 s vale para add_expense e add_income (anulação). window.financeLivro ganha gravar (o app.js clássico usa na F2-5). O Histórico usa h.verbo quando o razão mandar e mostra antes → depois de qualquer ação. Os módulos da fase 2 e da fase 3 importam de './livro.js' (mesma instância do módulo); livro.js não importa nenhum deles. Gráficos recebem centavos inteiros, não somam nada e recusam moedas misturadas numa série.

**Telas:** index.html ganha contêineres vazios: #acerto-resumo (Meu painel, depois de #livro-resumo), #assinaturas-topo (Assinaturas, antes de #subscriptions-content), #sociedade-acerto (Sociedade, DEPOIS de #society-content: o PR em andamento põe os cartões de perfis dentro dele, perfis em cima e acerto embaixo), #caixa-calculado (topo do Caixa), #fechamento-content (Livro do mês, depois de #livro-content); #cash-content passa a ficar dentro de <details class="registro-importado" open> com o resumo 'Registro importado do pacote de 18/10'. Links para os 6 CSS novos (vazios) e <script type=module src=rotina.js>, que importa os 6 esqueletos (só se registram). graficos.js: fluxo(serie) (entrou para cima em azul, saiu para baixo em vinho, linha de saldo em ouro, mês fechado com cadeado no eixo, mês aberto e futuro hachurados); cascata(passos) (receita → taxas → imposto → custos → resultado → partes); minigrafico(serie); barra100 com {neutro} para participação. Cada gráfico novo: aria-label com a conclusão, 'Ver tabela', linha 'Como ler', um tab stop com ←/→/Home/End.

**Testes:** node --test verde. testes/contraste.test.mjs: lê os --fin-* do livro.css e confere marcas ≥ 3:1 e texto ≥ 4,5:1 sobre o cartão e sobre o fundo (#f4f3ee e #0c1913) nos dois temas (§6.2, §8.8), e que nenhum dos 6 CSS novos declara font-size abaixo de 12px. Fotos do arnês (?demo=1, 4 cortes) iguais às de antes em todas as páginas, menos o Caixa (aparece o resumo 'Registro importado', aberto). Vitrine dos gráficos (fotografar --vitrine) nos 4 cortes com 0 erros de script e de CSP, sem rótulo sobreposto e sem rolagem horizontal a 390px; teclado: um tab stop por gráfico e a dica anda com as setas; forced-colors mantém a hachura.

**Pronto quando:** Páginas atuais sem regressão visível; vitrine fotografada; esqueletos carregam sem erro; nenhum outro módulo é importado pelo livro.js (sem ciclo); uma folha aberta sobrevive ao ciclo de 2 s e ao renderTudo.

**Riscos:** Se o PR do Laboratório/perfis passar a mexer no index.html, rebase antes do merge (hoje ele não mexe); a vitrine precisa da mesma CSP do index.html para provar 0 violações; o Caixa em <details> fica aberto até a F2-7 existir, porque cada fatia vai ao ar sozinha.

## F2-3-contas-selo-demo · As contas da rotina: acerto acumulado, receitas, fôlego, 12 meses e o selo

**Para as sócias:** Cada número novo (o que a empresa deve a você, o resultado do mês, quanto tempo o caixa dura, o selo do mês fechado) sai de uma função testada ao centavo, igual em todo navegador.

**Do plano:** §4.6 F7, F8 (alíquota efetiva informada), F9, F10, F11 e F12 acumulados com acertos, F13, F15, F16 e variação cambial de F4; §4.3 (series12m, runway, headline, settlement, income, closing.checklist); §5 Fechamento (roteiro de 6 passos como dados); §5 Conciliação (rateio do total pelo maior resto, PTAX de fechamento do último dia útil); §8.2 propriedades (inclusive 'nenhum valor em reais sem a conta'); §8.3 determinismo; §8.7 estado fictício com o outubro, um mês fechado e um recusado.

**Arquivos:** `contas.js (novo)`, `selo.js (novo)`, `ferramentas/arnes/demonstracao.js (novo)`, `ferramentas/arnes/ponte-simulada.js`, `ferramentas/arnes/servir.mjs`, `testes/contas.test.mjs (novo)`, `testes/selo.test.mjs (novo)`

**Dados:** Tudo puro e síncrono, BigInt na conta e um arredondamento só (meio para longe do zero). contas.js (importa razao.js e selo.js):
- acertoAcumulado(estadoBase, aplicado, lista, ate): F11 saldo_i = Σ gastos 'dividir' até a data (pagou_i − parte_i) + Σ acertos entre sócias (de: +v; para: −v), soma 0, transferências do maior devedor ao maior credor (n−1 no máximo); F12 devido_i = Σ reais dos gastos empresa_reembolsa de i não anulados, não convertidos e sem mark_reimbursed − Σ reembolsos para i; aportes_i = gastos 'aporte' + convertidos + acertos tipo aporte; reembolsos pendentes e acertos aguardando confirmação. Independe de fechamento.
- receitasDoMes(aplicado, lista, mes): F7 taxa = extrato, ou arred(bruto × pct) + transações × fixa com os parâmetros do canal vigentes no último dia do mês; F8 imposto = arred(bruto × imposto.simples_efetiva_pct); receita em USD pela PTAX do último dia sem spread nem IOF; 'Ver a conta' de cada termo.
- resultadoDoMes (F9), partes do resultado (F10), cascataDoMes.
- caixaInformado(aplicado, lista, data): último saldo de cada conta, USD pelo câmbio da data do saldo (só principal, dito na conta), idade em dias.
- serie12m(estadoBase, aplicado, mesFinal, hoje): 12 meses {entrou, saiu, saldo|null, fechado, selo, aberto} + 3 futuros só com o previsto das assinaturas; começa no primeiro mês com dado.
- folego (F13) com estados 'sem_mes_fechado', 'sem_queima', 'sem_saldo'.
- fotoDoMes(estadoBase, aplicado, mes, cabeca) {mes, cabeca, totais{realizado, previsto, total, por_moeda, por_categoria, receita_bruta, taxas, imposto, receita_liquida, resultado, variacao_cambial}, partes, pesos, parametros (ids usados), gastos[{id, valorMinor, moeda, brl, categoria, estado}], receitas[{id, brutoMinor, taxas, imposto}]}: só o que forma os números do mês — sem acertos, reembolsos, saldos nem versões (conferir ou reembolsar não muda o selo; ver F2-1); seloDoMes(foto) = sha256Hex(canonico(foto)); conferirFechamentos(estadoBase, eventos, {aplicar = R.aplicar}) refaz o prefixo (seq ≤ cabeca) e diz 'confere' ou 'não confere' (o aplicar é injetável para a F3-2 passar a versão com extensões).
- roteiroDoFechamento(estadoBase, aplicado, lista, mes, hoje): 6 passos pronto/falta/atenção com itens (quem lançou e quem não; assinaturas sem pagamento; moeda estrangeira sem fatura; não conferidos; reembolsos e acertos pendentes; parâmetros 'a confirmar' ou dólar com mais de 7 dias).
- ratearFatura(totalMinor, itens) pelo maior resto; spreadImplicito(faturaBrl, valorMinor, ptax, iofPct) em texto de 2 casas; cotacaoDoBoletim(jsonOlinda, data) (boletim de fechamento do último dia útil ≤ data).
- manchetePainel(estadoBase, aplicado, hoje, membroId) e mudancasRecentes(aplicado, membroId, n).
selo.js: sha256Hex(texto) em JS puro (UTF-8), canonico(valor) com chaves em ordem e recusa de número não inteiro, seloCurto(hex).
ferramentas/arnes/demonstracao.js: SEM imports (servido em /demonstracao.js; servir.mjs ganha a troca, como o estado-ficticio.js). demonstracao(estadoBase, {fotoDoMes, seloDoMes, aplicar}) devolve eventos {membro, conteudo} com AUTORA PRÓPRIA de ago–out: gastos do exemplo do plano, Anthropic de outubro sem fatura, plano novo 'a confirmar', passos marcados, receitas Hotmart de ago–out (outubro 40 × R$ 59,90), saldo da conta PJ de R$ 21.765,00 em 18/10, Pix de Ana para Bauer de R$ 135 e o de Beatriz pendente, reembolso do domínio pendente, setembro fechado pelo Bauer com selo verdadeiro (calibrado para a queima de setembro dar R$ 2.366,00) e um evento recusado (correção num gasto de setembro). ponte-simulada.js empurra esses eventos direto em d.eventos no treino (d.acrescentar assinaria tudo como a sessão) e troca a demonstração interna por esta (?demo=1).

**Telas:** Nenhuma tela. Fórmulas do 'Ver a conta' em português: 'Taxa Hotmart = 9,9% × R$ 2.396,00 + 40 × R$ 2,49 = R$ 336,80' · 'Fôlego = caixa ÷ queima média de N meses fechados' · 'Saldo no acerto = o que você pagou nos gastos divididos − a sua parte neles ± os Pix entre vocês' · 'Saldo em dólar convertido pela PTAX do dia, sem spread'.

**Testes:** testes/contas.test.mjs: outubro do plano — receita 2.396,00, taxa 336,80, Simples 143,76, líquido 1.915,44, custo 1.388,47, resultado 526,97, partes 210,79/158,09/158,09; acerto Bauer +270,00 / Ana −135,00 / Beatriz −135,00 e, depois do Pix da Ana, +135,00 / 0 / −135,00; saldos sempre somam 0 (laço de 2.000 casos); fôlego R$ 21.765,00 ÷ R$ 2.366,00 = 92 décimos; sem mês fechado dá 'sem_mes_fechado'; ratearFatura soma exata; pct_permil soma 1000; todo valor em reais traz a conta ou o tipo de conversão; selo de outubro igual com as chaves embaralhadas e diferente se 1 centavo muda; selo de setembro igual depois de um acerto, um reembolso e um saldo registrados em novembro; conferirFechamentos diz 'não confere' com selo forjado; a demonstração aplica com só o recusado esperado e setembro confere; serie12m com 1.200 eventos em menos de 200 ms. testes/selo.test.mjs: sha256Hex igual a node:crypto em 500 textos com acentos e emoji; canonico recusa 1.5. Arnês: ?demo=1 abre sem erro com as autoras certas no Histórico.

**Pronto quando:** node --test verde; os números do §4.6 e o exemplo de F13 batem; nenhuma função usa float para dinheiro; ?demo=1 carrega a demonstração nova com 0 erros e com cada evento na autora certa.

**Riscos:** Se o PR ainda estiver aberto, a troca na ponte-simulada.js passa para a F2-5 (plano B); caminho de import diferente no Node e no navegador (por isso a demonstração não importa nada); o prefixo do fold para conferir selo custa O(eventos) por mês fechado (medido no teste); serie12m chama livroDoMes 15 vezes: guardar a lista de parâmetros por chamada.

## F2-4-navegacao-rotas · Mapa do portal: menu em grupos, um endereço para cada página e a faixa de treino em todas

**Para as sócias:** O Voltar do navegador funciona, um link abre direto a página certa depois da senha, 'de onde vem este número' chega ao lançamento ou ao parâmetro em até 3 toques, e toda página diz quando nada está sendo salvo.

**Do plano:** §5 Navegação (grupos DINHEIRO · PLANEJAR · EMPRESA · AJUDA; rotas por hash com pushState; link direto depois da senha; atalhos do PWA 'Lançar gasto' e 'Lançamentos'; registro único de páginas no lugar dos 5 pontos atuais; '+ Lançar' no topo da gaveta); §5 Ver a conta (termos são links para o gasto ou o parâmetro); §5 Como fazer/modo treino (a faixa 'Treino — nada é salvo' em todas as páginas); §7 P1.2 pronto quando (3 cliques).

**Arquivos:** `paginas.js (novo)`, `app.js`, `index.html`, `livro.js`, `manifest.webmanifest`, `ferramentas/arnes/fotografar.mjs`, `ferramentas/arnes/fluxos/navegacao.mjs (novo)`

**Dados:** Nenhum evento. paginas.js é script clássico, carregado antes do app.js, e define window.financePaginas = [{chave, rota, grupo, numero, titulo, descricao, ajuda{oque, deonde, naoe}}] (os textos de ajuda saem do objeto pages do app.js, incluindo o do Laboratório que o PR reescreveu); app.js monta pages e a gaveta a partir dele e religa os botões. window.financeRegistrarPagina({chave, rota, grupo, titulo, descricao, ajuda, depoisDe}) registra página em tempo de execução: cria a seção, o botão (numeração refeita) e a entrada em pages, para a fase 3 não editar app.js nem index.html. Rotas: #painel · #livro/2026-10 · #livro/2026-10/fechar · #lancamentos?mes=2026-10&socia=m-ana&id=… · #assinaturas · #caixa · #parametros/fx.USD_BRL · #historico · #sociedade · #vender · #medpainel · #projecao · #portfolio · #laboratorio · #lancar. O hash guarda só página e filtros, nunca valores, nomes ou textos. navigate() faz pushState (replaceState na entrada); popstate navega sem empilhar; depois do login aplica o hash guardado. Ignora #main-content (pular para o conteúdo). livro.js exporta rotaAtual() {pagina, args, filtros}, dispara 'financeiro:rota', lê mês do Livro, filtros e id destacado de Lançamentos e o parâmetro aberto; os termos do 'Ver a conta' com id (gasto) ou cambio/spreadParam/iofParam (parâmetro) viram links. livro.js desenha faixaModo em #faixa-global em todas as páginas fora da gravação (a F2-10 só refina o texto e o indicador).

**Telas:** Gaveta: DINHEIRO (Meu painel, Livro do mês, Caixa, Lançamentos, Assinaturas, Parâmetros) · PLANEJAR (Med Painel, Projeção, Vender primeiro) · EMPRESA (Sociedade, Portfólio, Laboratório) · AJUDA (Histórico; Como fazer e Estado do portal entram prontos na F2-10, para nenhuma página vazia ir ao ar); '+ Lançar' no topo; numeração mantida; eyebrow por grupo. index.html: a gaveta vira contêiner montado pelo registro; #faixa-global no topo do page-stage. Lançamento aberto por link fica destacado com 'Você veio do Ver a conta'. manifest.webmanifest com os atalhos './#lancar' e './#lancamentos'.

**Testes:** ferramentas/arnes/fluxos/navegacao.mjs (Playwright): /?demo=1#lancamentos?socia=m-ana abre Lançamentos filtrado; navegar por 3 páginas e Voltar 3 vezes volta na ordem; ?login=1#parametros/fx.USD_BRL abre Parâmetros com o dólar aberto depois da senha; 'Ir para o conteúdo' não troca de página; 'Ver a conta' do Custo do mês → termo → lançamento destacado em até 3 cliques; #lancar abre a folha; uma página registrada em tempo de execução por um módulo de teste aparece na gaveta, na rota e nas fotos; a faixa de treino aparece em Assinaturas, Caixa e Sociedade. Fotos da gaveta aberta nos 4 cortes; fotografar lê as páginas do registro (nenhuma lista fixa); 0 erros de script e de CSP; node --test verde.

**Pronto quando:** Uma página nova se cria só no paginas.js + index.html ou por financeRegistrarPagina; Voltar e link direto funcionam; nenhum dado sensível no hash; o Laboratório (moldura com #tema= e tela cheia) continua funcionando; nenhuma página da gaveta está vazia.

**Riscos:** O PR mexe no app.js (Laboratório e Sociedade) e no texto de ajuda do Laboratório: só depois do merge; o registro precisa manter os ids das seções usados pelo app.js e pelas fotos; o atalho do PWA abre antes da senha (guardar a rota e aplicar depois); atalhos do PWA não existem no iOS (só Android e desktop).

## F2-5-assinaturas-vender · Assinaturas e Vender primeiro sem arquivo

**Para as sócias:** Assinatura nova, confirmar, encerrar e marcar como paga viram botões, com autora e data, e os passos de venda voltam a ser marcados, em todos os produtos e sem o corte em 3.

**Do plano:** §5 Assinaturas P1 (Nova, Confirmar, Encerrar, Marcar como paga separada do Status livre; 'Alterado por X em dd/mm'); §5 Vender primeiro (fim do corte em 3, barra por produto, 'marcado por X em dd/mm', caixinhas pelo diário); §5 Controles honestos (liberados ação por ação); §3.8 (as três mutações antigas por id + version); §4.3 (plans exportam changedAt/By); §8.1 (plano inativo sem 'sua parte' e sem próxima data).

**Arquivos:** `static-bridge.js`, `ferramentas/arnes/ponte-simulada.js`, `domain.js`, `app.js`, `assinaturas.js`, `assinaturas.css`, `testes/dominio.test.mjs (novo)`, `ferramentas/arnes/fluxos/assinaturas.mjs (novo)`

**Dados:** Ponte publicada e simulada: o snapshot passa a ser buildSnapshot(R.estadoEfetivo(estado, R.aplicar(estado, eventos), hoje), …), então as páginas antigas refletem o diário sem reescrita. toggle_step, edit_plan e set_subscription deixam de responder read_only e viram eventos toggle_step, edit_plan, archive_plan/reactivate_plan pelo id e pela versão (app.js passa a mandar o id), gravados por window.financeLivro.gravar chamado na hora do pedido (sem import, para não mudar a ordem de carga); valores digitados passam por centavosBR e o Status livre vai no edit_plan; Encerrar pede data e motivo. financeHost.pode(acao) substitui readOnly nas Assinaturas e no Vender primeiro: liberado em gravação e em treino, desligado com motivo em leitura e aguardando; set_decision continua desligado até a F3-2/F3-7. domain.js: plans[] ganham changed_at, changed_by_nome, confirmed_by_nome e steps[] ganham checked_at, checked_by_nome (só quando há dado); produtos sem slice(0, 3); plano inactive sai sem personal_amount e sem próxima data (§8.1). Marcar como paga = record_payment com valor e moeda da assinatura já preenchidos (substitui o botão 'Lançar pagamento'). app.js: o ciclo de 2 s não redesenha Assinaturas nem Vender primeiro com folha ou formulário aberto (generaliza editingPlan) e recarrega o snapshot logo depois de cada gravação ('financeiro:diario'). O ?escrita=1 do arnês deixa de usar applyMutation.

**Telas:** Assinaturas (#assinaturas-topo): 'Nova assinatura' (serviço, plano, valor, moeda, período, dia do vencimento ou próxima data, categoria); em cada cartão 'Confirmar' (se a confirmar), 'Marcar como paga', 'Editar', 'Encerrar' ou 'Reativar'; pílula 'a confirmar' com contorno tracejado; 'Alterado por Ana em 17/10'. Textos: 'Confirmar = os dados batem com a fatura.' · 'Encerrar aqui não cancela o serviço: cancele também no site dele.' · 'Anual de US$ 99 ÷ 12 = US$ 8,25 por mês.' · 'Uma assinatura nova só entra no previsto depois que outra sócia confirmar.' Vender primeiro: todos os produtos, barra '3 de 4 passos', 'marcado por Beatriz em 18/10'. Em treino, a faixa global da F2-4 aparece nas duas páginas.

**Testes:** testes/dominio.test.mjs: sem eventos, os blocos do snapshot saem iguais aos de antes exceto as mudanças listadas (produtos sem corte, plano inativo sem sua parte e sem próxima data, campos changed_*/checked_* só quando há dado); com eventos aparecem plano novo, confirmado, encerrado e pago; 5 produtos sem corte. Arnês ?demo=1: Assinaturas e Vender primeiro nos 4 cortes. ferramentas/arnes/fluxos/assinaturas.mjs em ?diario=local, trocando de sócia por ?membro=: Ana cria 'Canva Pro', Beatriz confirma (entra no previsto), Bauer marca como paga (o gasto aparece em Lançamentos e sai do previsto), Ana encerra o Figma com motivo, Beatriz marca um passo; Histórico mostra os 5 registros com autora; uma folha aberta sobrevive a 3 ciclos de 2 s; 0 erros de script e de CSP; node --test verde.

**Pronto quando:** Nenhum controle das duas páginas recusa depois de preenchido; tudo vira registro do diário com autora; o portal não mostra mais 'Esta versão publicada é só de leitura' nessas páginas; a página atualiza logo depois de gravar.

**Riscos:** Dois caminhos de escrita (ponte e livro.js) usam o mesmo gravar e a mesma prévia; índices mudam quando entra assinatura nova (sempre id); o fold a cada 2 s no snapshot (medir com 1.000 eventos); domain.js também roda nos testes antigos; editar o app.js só em renderSubscriptions, planForm, renderSelling e no ciclo de 2 s.

## F2-6-acerto · Acerto, reembolso e aporte na Sociedade e no Meu painel

**Para as sócias:** Cada sócia vê quanto adiantou, quanto a empresa deve a ela e quem paga quem; registra o Pix com um toque, e quem recebe confirma.

**Do plano:** §5 Sociedade (barra de participação, quadro adiantou · parte · saldo, quem paga quem, 'Reembolsar' da responsável e 'Recebi' da sócia, aportes acumulados, aviso quando a participação não fecha 100%); §5 Meu painel ('O que você adiantou' e 'Seu saldo no acerto'); §4.6 F11 e F12; D5.

**Arquivos:** `acerto.js`, `acerto.css`, `livro.js`, `ferramentas/arnes/fluxos/acerto.mjs (novo)`

**Dados:** Lê contas.acertoAcumulado (até hoje). Grava record_settlement (acerto_entre_socias com de = você e para/valor da transferência sugerida; reembolso_empresa da responsável com os gastos pendentes escolhidos e valor = soma; aporte em dinheiro), confirm_settlement e convert_to_contribution. Centavos BRL. livro.js: o quadro 'Entre as sócias' do Livro do mês ganha 'neste mês' e o link para o acerto acumulado; em Lançamentos, 'Marcar reembolsado' dá lugar a 'Reembolsar' (abre a folha do reembolso, só a responsável) e 'Converter em aporte' (só quem pagou), para não haver dois jeitos de quitar o mesmo gasto.

**Telas:** Sociedade (#sociedade-acerto, abaixo dos cartões de perfis do PR): 'Participação' em barra neutra 40/30/30 e o aviso 'A participação cadastrada soma 90%: o rateio fica suspenso até corrigir'; quadro por sócia (Adiantou · Sua parte · Saldo no acerto · A empresa deve · Aportes); barras divergentes (a receber em azul, a pagar em vinho, sempre com sinal); 'Quem paga quem': 'Ana paga R$ 135,00 a Bauer' com 'Registrar o Pix' (só para quem paga) e 'Recebi' (só para quem recebe); 'Reembolsos pendentes' com 'Reembolsar' (responsável) e 'Converter em aporte' (quem pagou); 'Histórico de acertos'. Exemplo: 'Bauer pagou o contador (R$ 450,00). A parte dele é 40% (R$ 180,00); Ana e Beatriz devem R$ 135,00 cada.' Meu painel (#acerto-resumo): 'Você adiantou R$ 509,90 · a empresa te deve R$ 59,90 · no acerto você tem +R$ 135,00 a receber' e 'Ver o acerto'.

**Testes:** Arnês ?demo=1: Sociedade e Meu painel nos 4 cortes, como m-bauer e como m-ana; os saldos mostrados somam zero. ferramentas/arnes/fluxos/acerto.mjs em ?diario=local: Ana registra o Pix de R$ 135 para Bauer → o saldo dela vai a zero e Bauer vê 'Recebi'; Bauer confirma; Bauer reembolsa o domínio da Ana a partir de Lançamentos → 'a empresa te deve' zera; Beatriz converte um reembolso em aporte. Teclado e leitor de tela nos botões e no anúncio do toast; 0 erros de script e de CSP.

**Pronto quando:** Os números da tela batem com contas.acertoAcumulado e com o 'Ver a conta'; cada sócia só vê os botões que pode usar; nada grava sem passar pelo diário; Lançamentos não oferece mais 'Marcar reembolsado'.

**Riscos:** Confundir o acerto do mês (Livro) com o acumulado (Sociedade): rótulos explícitos; 'Recebi' só faz sentido com o servidor publicado (em treino há uma pessoa só); a ordem visual com os perfis do PR (perfis em cima).

## F2-7-caixa · Caixa: receitas, saldos, fluxo de 12 meses, cascata, fôlego e a manchete do Meu painel

**Para as sócias:** A empresa passa a ver o que entrou, o que saiu, quanto tem no banco e por quantos meses o caixa dura, numa frase e em dois gráficos.

**Do plano:** §5 Caixa P1 (fluxo de 12 meses, cascata, fôlego, saldos informados; o bloco estático vira 'registro importado'); §5 Receitas (lançamento mensal por canal e produto; taxas pelos parâmetros ou pelo extrato; 'Ver a conta'); §5 Meu painel P1 (manchete com 4 números, minigráfico de 12 meses, mudanças recentes); §4.6 F7–F9 e F13; §6.4 (três níveis de leitura); §8.8 teste de 10 segundos (preparo).

**Arquivos:** `caixa.js`, `caixa.css`, `livro.js`, `ferramentas/arnes/fluxos/caixa.mjs (novo)`

**Dados:** Grava add_income, edit_income, void_income e set_balance. Lê contas.receitasDoMes, resultadoDoMes, cascataDoMes, caixaInformado, folego, serie12m, manchetePainel e mudancasRecentes. No livro.js muda só o renderResumo do Meu painel. caixa.js fecha o <details> do registro importado quando a parte calculada aparece.

**Telas:** Caixa (#caixa-calculado): manchete 'Caixa de R$ 21.765,00 em 18/10: dá ≈ 9,2 meses na queima média de 1 mês fechado.'; 4 números (No banco · Queima média · Fôlego · Resultado de outubro) com 'Ver a conta'; Fluxo de 12 meses; Cascata 'Para onde vão os R$ 2.396,00 de outubro'; Receitas do mês por canal com '+ Receita' (competência, canal, produto, bruto já sem cancelamentos, cancelados, nº de vendas, taxas do extrato se tiver, pagantes ativos/novos/perdidos, testes, cadastros) e a prévia 'taxa 9,9% + 40 × R$ 2,49 = R$ 336,80 · Simples 6% = R$ 143,76 · líquido R$ 1.915,44'; Saldos por conta (último valor, data, quem informou) com '+ Saldo' e o aviso 'saldo de 42 dias atrás: informe o de hoje'; sem mês fechado: 'precisa de 1 mês fechado'; sem queima: 'sem queima de caixa'. Meu painel: 'Outubro: saiu R$ 1.166,41; R$ 1.388,47 comprometidos por mês; o caixa dá ≈ 9,2 meses; nada atrasado.' + 4 números (Saiu este mês · Comprometido por mês · Caixa · Fôlego), cada trecho é link; minigráfico de 12 meses; 'Mudanças recentes' (as 3 últimas das outras sócias). Sempre '≈' e 'média de N meses'.

**Testes:** Arnês ?demo=1: Caixa e Meu painel nos 4 cortes; os números do plano (2.396,00 / 336,80 / 143,76 / 1.915,44 / 526,97; 9,2 meses) na tela e no 'Ver a conta'; ferramentas/arnes/fluxos/caixa.mjs em ?diario=local: lançar uma receita e um saldo e ver o fôlego e a cascata mudarem; corrigir e anular a receita; 0 erros de script e de CSP; sem rolagem horizontal a 390px. Roteiro do teste de 10 segundos (as 4 perguntas do §8.8) preparado sobre a foto do Meu painel, para aplicar com as sócias.

**Pronto quando:** Nenhum número inventado (sem dado, a tela diz o que falta); o mesmo valor aparece igual no Caixa, no Meu painel e no 'Ver a conta'; o registro importado de 18/10 continua acessível.

**Riscos:** Precisão falsa (≈ e 'média de N meses' obrigatórios); gráfico sem história (a série começa no primeiro mês com dado); saldo em dólar convertido sem spread; manchete longa demais no celular; maior fatia de tela: se apertar, os gráficos ficam e as mudanças recentes passam para a F2-10.

## F2-8-conciliacao · Conciliar a fatura e a PTAX do dia

**Para as sócias:** Quando a fatura chega, a sócia digita o que o banco cobrou, item a item ou só o total, e o '≈ estimado' vira valor efetivo, com a diferença explicada.

**Do plano:** §5 Conciliação e PTAX ('Conciliar fatura' por mês e cartão: valor de cada item ou total rateado pelo maior resto; estimado em itálico com contorno, efetivo sólido; Δ cambial com sinal; 'Por que o banco cobrou diferente?'; PTAX de fechamento do último dia útil, com a data à vista); D6; F4 (variação cambial).

**Arquivos:** `conciliacao.js`, `conciliacao.css`, `ferramentas/arnes/fluxos/conciliacao.mjs (novo)`

**Dados:** Grava reconcile_statement {mes, forma, totalFaturaMinor|null, itens[{alvo, versao, faturaBrlMinor}]}; o total é dividido por contas.ratearFatura (maior resto, soma exata). PTAX do dia de cada compra via Olinda (CotacaoMoedaPeriodo, já liberada na CSP; uma consulta por período) escolhida por contas.cotacaoDoBoletim; spread implícito por contas.spreadImplicito; oferece set_parameter de cartao.spread_pct com a fonte 'fatura de outubro'. Expõe window.financeConciliacao.abrir(mes, forma) para o Fechamento.

**Telas:** Botão 'Conciliar fatura' na barra de Lançamentos (extra 'lancamentos-barra'); folha: mês e cartão (Cartão da empresa / Meu cartão pessoal, filtrado por quem pagou); lista dos gastos em moeda estrangeira com '≈ R$ 547,09 estimado' e o campo 'Cobrado na fatura'; alternativa 'Só tenho o total'; resumo 'Estimado R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71'; 'Por que o banco cobrou diferente? A PTAX de 14/10 era 5,0826; o banco cobra a PTAX + o spread do cartão + o IOF de 3,5%. Nesta fatura o spread saiu 4,3%.' com 'Usar 4,3% como spread a partir de 01/11'. Mês fechado: 'Outubro está fechado: a responsável reabre, com motivo, se a fatura chegou depois.'

**Testes:** Arnês ?demo=1 (gastos em dólar de outubro sem fatura): a folha nos 4 cortes; ferramentas/arnes/fluxos/conciliacao.mjs em ?diario=local: conciliar pelo total → cada item ganha fatura e a soma fecha ao centavo; o Livro do mês troca 'estimado' por 'fatura'; o Histórico mostra 1 registro com o Δ; mês fechado recusa com o motivo; PTAX indisponível (rede bloqueada no teste) mostra 'Não foi possível consultar o Banco Central agora; a conciliação funciona sem ela'; 0 erros de script e de CSP.

**Pronto quando:** Conciliar não apaga a estimativa (o antes fica no Histórico); a soma dos itens é sempre igual ao total digitado; a explicação usa a PTAX real com a data dela.

**Riscos:** Fim de semana e feriado (último dia útil anterior); Olinda fora do ar; o cartão pessoal mistura sócias (filtrar por quem pagou); a fatura pode trazer IOF em linha separada (o campo é o total cobrado do item, com IOF).

## F2-9-fechamento · Fechar o mês: roteiro de 6 passos, selo, pacote do contador e Exportar

**Para as sócias:** Em uns 10 minutos a responsável fecha o mês: os números congelam com um selo que as três conferem, e sai um arquivo pronto para o contador.

**Do plano:** §5 Fechamento (roteiro de 6 passos, 'Lembrar', selo, cadeado, reabrir só a responsável com motivo); §5 Exportar (pacote do contador do mês fechado, e o CSV de parâmetros com histórico e o do histórico, que eram P0 e ninguém fez; ';', vírgula decimal, UTF-8 com BOM, valor_centavos, apóstrofo antes de = + - @); §4.2 closings; F16; D8; §8.8 ponta a ponta (o mesmo hash no selo e no CSV); §7 P1.1 pronto quando.

**Arquivos:** `fechamento.js`, `fechamento.css`, `pacote.js (novo)`, `testes/pacote.test.mjs (novo)`, `ferramentas/arnes/fluxos/fechamento.mjs (novo)`

**Dados:** Lê contas.roteiroDoFechamento, fotoDoMes, seloDoMes e conferirFechamentos. Grava check_expense, close_month {cabeca, selo, totais} e reopen_month {motivo}; se o fechamento chegar ao diário e for recusado porque um evento do mesmo mês entrou antes, refaz a foto e reenvia uma vez. pacote.js (puro, sem DOM): ZIP sem compressão com CRC32 contendo resumo.csv (totais, partes, selo, quem fechou e quando), lancamentos.csv, receitas.csv, acertos.csv, parametros.csv (os usados, com vigência e fonte) e LEIA.txt (como conferir o selo); nome contador-2026-10-81babb05.zip. Os mesmos escritores de CSV servem o 'Baixar CSV' de Parâmetros (todas as vigências, fonte e autora) e do Histórico, pelos extras 'parametros-barra' e 'historico-barra' (sem editar o livro.js).

**Telas:** Livro do mês (extra 'livro-topo'): o selo 'Outubro fechado por Bauer em 03/11 · 81babb05', com cadeado, ou o botão 'Fechar outubro' (só depois que o mês terminou). Roteiro em #fechamento-content (rota #livro/2026-10/fechar), etapas 01–06 em serifa com barra de progresso: 01 Todas lançaram? ('Ana: 3 lançamentos · Beatriz: nenhum'; 'Lembrar' copia 'Oi, Beatriz! Faltam seus gastos de outubro no portal: + Lançar, leva 10 segundos.') · 02 Faturas em dólar conciliadas? (abre a conciliação) · 03 Conferidos por outra sócia? ('Conferir' em cada um) · 04 Reembolsos e acertos (link para a Sociedade; lembrete, não trava) · 05 Parâmetros usados ('a confirmar' destacado) · 06 Fechar e exportar (só a responsável: 'Fechar é assinar o livro do mês: os números não mudam mais, nem se o dólar mudar.'). 'Reabrir' pede motivo; 'Baixar o pacote do contador'. Estado de cada etapa sempre com ícone e palavra (pronto, falta, atenção). Em treino: 'TREINO — não envie ao contador' no arquivo e na tela.

**Testes:** testes/pacote.test.mjs: ZIP com assinaturas PK, CRC32 igual ao zlib.crc32 e os 6 nomes; CSV com BOM, ';', vírgula decimal, valor_centavos e apóstrofo antes de '='; outubro do plano: resumo.csv com 1.388,47 e 526,97 e o selo igual ao seloDoMes; CSV de parâmetros com as duas vigências do spread. Arnês ?demo=1: roteiro de outubro e setembro fechado nos 4 cortes. ferramentas/arnes/fluxos/fechamento.mjs em ?diario=local com 3 sócias (?membro=) e o relógio do Playwright em 03/11/2026 (page.clock): Bauer fecha outubro e Ana e Beatriz veem o mesmo selo de 8 dígitos; Ana tenta corrigir um gasto de outubro → recusado com motivo; Ana registra um Pix de outubro → aceito e o selo continua igual; Bauer muda o dólar → outubro não muda; Bauer reabre com motivo → aparece no Histórico; o pacote baixado lista os arquivos (unzip -l) e o CSV abre com acentos; 0 erros de script e de CSP.

**Pronto quando:** No arnês, outubro fictício fecha de ponta a ponta sem IA e sem Mac; o selo é igual nas 3 sócias, no Livro do mês e no resumo.csv; mês fechado não muda com parâmetro novo nem com acerto; reabrir deixa rastro; Parâmetros e Histórico baixam CSV.

**Riscos:** O evento precisa caber em 16 KB (por isso leva só cabeça, selo e totais); o contador pode pedir outras colunas; alguns apps abrem mal ZIP sem compressão (os CSV também podem ser baixados um a um); a F2-12 precisa estar no ar antes de o diário passar de 500 registros, senão um selo pode nascer de um diário pela metade.

## F2-10-ajuda-estado · Como fazer, treino visível, primeiro acesso, Estado do portal e controles do mês fechado

**Para as sócias:** A sócia sabe sempre se está treinando ou gravando, aprende as 8 tarefas com um botão que faz a coisa, vê num lugar só se o portal está saudável e não encontra botão que vai recusar num mês fechado.

**Do plano:** §5 Como fazer, modo treino e primeiro acesso (faixa 'Treino — nada é salvo', 4 telas puláveis, 8 tarefas); §5 Estado do portal (versões, pacote, cabeça do diário, fila, recusados, parâmetros desatualizados, versão antiga; cada item vermelho com o passo seguinte); §5 Cabeçalho (verde 'Sincronizado 14:02' · ouro '1 na fila' · cinza 'Sem conexão' · vermelho '2 recusados' no lugar de 'Dados compartilhados'; o clique abre o Estado do portal); §3.10 ('Íntegro até o registro N'); §6.7 .training-banner; §5 Controles honestos (mês fechado); §5 Med Painel P0 ('ajuda sem caminhos do Mac').

**Arquivos:** `ajuda.js`, `ajuda.css`, `livro.js`, `index.html`, `paginas.js`, `static-bridge.js`, `ferramentas/arnes/ponte-simulada.js`, `ferramentas/arnes/fotografar.mjs`, `ferramentas/arnes/fluxos/ajuda.mjs (novo)`

**Dados:** Nenhum evento. Lê diario (modo, cabeca, verificacao, fila, ultimaSincronia), aplicado.recusados e aplicado.fechamentos, parâmetros (dólar com mais de 7 dias, itens 'a confirmar'), contas.conferirFechamentos e, com servidor, GET /api/estado. As duas pontes ganham financeHost.sobre() {pacote (nome do bundle), dataDoPacote, diarioUrl, versao}. 'Tour visto' em localStorage com try/catch (a única chave além do tema; sem ela, o tour só aparece de novo). livro.js: a faixa global ganha o texto final; o indicador do cabeçalho sai do read-state e substitui 'Dados compartilhados' (index.html); em mês fechado, Lançamentos troca Editar/Anular por cadeado com motivo e o + Lançar avisa antes de salvar numa competência fechada. paginas.js: entram Como fazer e Estado do portal (grupo AJUDA, prontas), e a ajuda do Med Painel e da Projeção perde os caminhos do Mac.

**Telas:** Faixa global (#faixa-global) fora da gravação: 'Treino — nada é salvo. O servidor do diário ainda não foi publicado: o que você fizer some ao recarregar.' (hachura ouro). Indicador: 'Sincronizado 14:02' / '1 na fila' / 'Sem conexão' / '2 recusados'. Como fazer: 8 cartões (Lancei errado · Paguei do meu bolso · O dólar mudou · Chegou a fatura · Fechar o mês · Mandar ao contador · Assinatura nova · Esqueci a senha), 2 a 3 frases em 'você' e um botão que faz ('Abrir + Lançar', 'Atualizar pela PTAX', 'Conciliar fatura', 'Começar o fechamento', 'Baixar o pacote', 'Nova assinatura'). Primeiro acesso: 4 telas puláveis (O portal em 1 minuto · Lançar em 10 segundos · As cores: azul entrou, vinho saiu, ouro é a sua parte · Treino ou gravação), reabríveis no Como fazer. Estado do portal: lista com ponto, ícone e palavra — Versão · Pacote de dados ('retrato de 18/10; não é regerado; o que é novo vem do diário') · Diário (modo, servidor, 'íntegro até o registro N') · Fila · Recusados · Última sincronia · Dólar atualizado há N dias · Parâmetros a confirmar · Selos dos meses fechados · Versão antiga; cada item vermelho traz o passo seguinte ('Recarregue a página', 'Atualize o dólar pela PTAX', 'Peça para outra sócia entrar: ela libera a sua chave'). Cadeado no mês fechado: 'Setembro está fechado. A responsável reabre, com motivo, se precisar mudar.'

**Testes:** Arnês: fotos de Como fazer, Estado do portal e das 4 telas de primeiro acesso nos 4 cortes; em treino (padrão do arnês) a faixa aparece em Assinaturas, Caixa e Meu painel; em ?diario=local aparece 'Sincronizado' e a faixa some; o recusado da demonstração aparece em vermelho com o passo; gastos de setembro (fechado na demonstração) com cadeado e sem Editar/Anular. ferramentas/arnes/fluxos/ajuda.mjs: cada botão do Como fazer abre a coisa certa; o primeiro acesso aparece uma vez e não volta depois de pulado; com localStorage bloqueado nada quebra; fotografar marca o tour como visto nas demais fotos; 0 erros de script e de CSP.

**Pronto quando:** O modo (treino ou gravação) está escrito em toda página; nenhum item do Estado do portal pede o Mac; as 8 tarefas levam à ação em 1 toque; nenhum botão de mês fechado recusa depois de clicado.

**Riscos:** Faixa duplicada com a das páginas do livro (remover a antiga); texto demais nos cartões; o tour atrapalhar as fotos e os testes; /api/estado inexistente em treino; trocar o indicador do cabeçalho mexe na linha que o app.js preenche com 'Leitura às HH:MM' (manter os ids).

## F2-11-exatidao-conflito · Exatidão que faltou da P0 e o diálogo de conflito

**Para as sócias:** Datas de vencimento e mensagens certas, o histórico da Sociedade volta a aparecer, e quando duas sócias mexem no mesmo gasto ao mesmo tempo o portal pergunta qual valor fica, sem perder o que foi digitado.

**Do plano:** §8.1 (os casos que ninguém fez: dia 31 vira fim do mês, nextDate pago avança, source estático forjado não sobrescreve, CPF só com dígito verificador, Sociedade 'Histórico importado', plural '1 cobrança vencida', teto a 103% em vermelho no claro); §5 Correções de exatidão (indicador da entrada em style.css:3); §3.8 (diálogo de conflito com as duas versões); §8.5 itens 1, 2, 5 e 6; §6.7 .conflict-dialog.

**Arquivos:** `domain.js`, `app.js`, `tema.css`, `style.css`, `livro.js`, `testes/dominio.test.mjs`, `ferramentas/arnes/fluxos/conflito.mjs (novo)`

**Dados:** Nenhum evento novo. domain.js: planSchedule com dia 31 vira o último dia do mês; plano mensal pago com nextDate vencida avança para o próximo ciclo; bloco estático com source.status forjado não sobrescreve o calculado; safeText só mascara 11 dígitos quando os dígitos verificadores de CPF fecham. app.js: renderSociety mostra o 'Histórico importado' embaixo do quadro (hoje some quando há linhas), em cima do que o PR desenhou; plural correto nos contadores. tema.css: .over-budget em --fin-perigo também no claro; style.css: indicador da entrada (>span:first-child). livro.js: quando a prévia ou o diário recusar com codigo 'versao' (F2-1), abre o diálogo de conflito com nome, hora, o valor dela e o seu, com 'Manter o meu' (reenvia sobre a versão nova) e 'Ficar com o dela'; o formulário continua preenchido. Vale para gasto, receita, plano e passo (os caminhos do app.js passam pelo mesmo gravar).

**Telas:** Diálogo: 'Ana mudou este gasto às 14:02 (R$ 400,00 → R$ 450,00). Manter o seu, R$ 480,00, ou ficar com o dela?' com as duas versões lado a lado. Sociedade: 'Histórico importado: o quadro acima é o cadastro atual; o texto abaixo veio da fonte importada e pode descrever uma composição anterior.'

**Testes:** testes/dominio.test.mjs: dia 31 em novembro → 30/11; nextDate vencido de plano mensal pago avança; source forjado não sobrescreve; safeText('NF 12345678901') mantém e '12345678909' continua mascarado; Sociedade com linhas e texto mostra o histórico; '1 cobrança vencida'. Fotos: teto a 103% no claro; indicador da entrada; Sociedade com perfis e histórico. ferramentas/arnes/fluxos/conflito.mjs com duas abas em ?diario=local: duas inclusões simultâneas aceitas sem diálogo (§8.5.1); duas edições do mesmo gasto → a segunda vê o diálogo com o formulário preenchido (§8.5.2); versão antiga recusada com motivo (§8.5.5); o ciclo de 2 s não redesenha com folha aberta (§8.5.6); 0 erros de script e de CSP; node --test verde.

**Pronto quando:** Toda a lista 'reprova hoje' de §8.1 passa, menos mpRepartir e fixed_monthly do Med Painel (F3-4a); um conflito nunca perde o que a sócia digitou.

**Riscos:** renderSociety acabou de ser reescrito pelo PR (perfis): mexer só no histórico; mudar safeText altera textos já exibidos (listar no PR); o conflito em gravação só aparece de verdade com o servidor publicado (no arnês, ?diario=local).

## F2-12-diario-paginado · Diário inteiro em qualquer tamanho: paginação no cliente e leitura em paralelo no servidor

**Para as sócias:** Daqui a alguns meses, com centenas de registros, o portal continua abrindo com tudo e os números (e os selos) nunca saem de um diário pela metade.

**Do plano:** §3.7 passo 5 (leitura na entrada), §3.10 ('Íntegro até o registro N'), §8.6 (servidor), §9.1 (limite por coleção: o diário é paginado).

**Arquivos:** `diario.js`, `servidor/nucleo.mjs`, `testes/diario.test.mjs`, `testes/servidor.test.mjs`

**Dados:** Nenhum evento. Achado no código: GET /api/eventos devolve no máximo 500 e diario.sincronizar busca uma vez só; com ~100 registros por mês, em 5 meses a primeira tela abriria incompleta até a sincronização seguinte (60 s) e diria 'íntegro até o registro 500'. diario.sincronizar repete enquanto vierem 500 (ou até a cabeça informada) antes de devolver. nucleo.mjs: GET /eventos lê os blobs em lotes paralelos (ex.: 25 de cada vez), mantendo a ordem, e calcula a cabeça uma vez por pedido.

**Telas:** Nenhuma tela.

**Testes:** testes/diario.test.mjs: diário com 1.200 eventos no servidor em memória abre inteiro numa sincronização e diz 'íntegro até o registro 1.200'. testes/servidor.test.mjs: GET /eventos na ordem com depois= no meio; com armazém lento (5 ms por get), 500 eventos em menos de 1 s; nenhum teste antigo muda.

**Pronto quando:** Os testes do diário e do servidor passam; nada muda no formato dos envelopes nem nas rotas.

**Riscos:** Netlify Blobs tem limite de pedidos por segundo (lotes moderados); a função tem tempo máximo por pedido (o cliente pagina, então cada pedido continua pequeno). Coringa: pode correr em qualquer espaço livre antes da onda 6.

## F3-1-fiscal-nucleo · Núcleo fiscal puro: Simples, fator R, DAS, Presumido e calendário com .ics

**Para as sócias:** Nada muda na tela ainda: é a conta dos impostos e dos prazos, testada centavo a centavo, que a página Impostos e o Med Painel vão usar.

**Do plano:** §7 P2.1 (cálculo); §5 Impostos (alíquota efetiva F8, fator R, DAS estimado, calendário com .ics, comparador III × V × Presumido); §4.6 F8; §4.2 obligations (P2) como semente em código; §8.2 (vetores e propriedades).

**Arquivos:** `fiscal.js (novo)`, `testes/fiscal.test.mjs (novo)`

**Dados:** Nenhuma ação no diário (funções puras, BigInt, um arredondamento meio para longe do zero).
- TABELAS_SIMPLES em código, com vigência, fonte e estado 'a_confirmar' (semente: docs/premissas-padrao-pesquisa.json): Anexos III e V da LC 155/2016, desde 2018-01-01 até 2026-12-31; nominal em texto decimal, nunca float.
- validarTabela(t): 6 faixas, tetos crescentes, nominal 0–40, dedução inteira ≥ 0 e CONTINUIDADE exata só nas viradas das faixas 1→5 (nominal_k × teto_k − ded_k = nominal_k+1 × teto_k − ded_k+1). A 6ª faixa é descontínua por lei nos dois anexos (III em R$ 3,6 mi: 21% − 125.640 = 630.360 contra 33% − 648.000 = 540.000; V: 23% − 62.100 = 765.900 contra 30,5% − 540.000 = 558.000) e é conferida contra a semente; exigir continuidade nela recusaria a tabela oficial.
- tabelaVigente(anexo, competencia, extras=[]) (extras = tabelas do diário, F3-3). Sem tabela vigente → {erro}; nunca estima com tabela de outro período (01/2027 em diante fica 'a cadastrar').
- rbt12(receitas[{competencia, brutoMinor}], competencia, inicioAtividade) → {rbt12Minor, meses, proporcional, faltando[]} com a regra de início de atividade (Res. CGSN 140/2018, art. 22); folha12 com a mesma regra.
- fatorR(folha12, rbt12) → {bp, atinge: folha × 100 ≥ rbt12 × 28}; anexoPeloFatorR.
- efetiva(tabela, rbt12) → {faixa, nominal, deduzirMinor, num/den, bp}; RBT12 = 0 → nominal da faixa 1; acima de R$ 4,8 mi → 'fora do Simples'.
- dasEstimado(baseMinor, tabela, rbt12) com explica{formula, termos, resultado} no formato do 'Ver a conta'.
- presumidoAnual({rbt12, folha12, issPct}) (IRPJ 15% × 32%, adicional 10% sobre o presumido acima de R$ 240 mil/ano, CSLL 9% × 32%, PIS 0,65%, Cofins 3%, ISS, CPP 20% do pró-labore), vale até 31/12/2026.
- comparar({rbt12, folha12, issPct}) e folhaPara28.
- OBRIGACOES_PADRAO [{id, titulo, regra 'mensal:20' | 'anual:03-31' | 'data:2026-10-30', diaNaoUtil 'prorroga' | 'antecipa' | 'nenhum', fonte, aConfirmar}]: DAS e PGDAS-D (dia 20, competência anterior), DEFIS (31/03), fechamento do mês (dia 5, D8), opção IBS/CBS fora do DAS (30/10/2026), NFS-e nacional (01/11/2026), reforma (01/01/2027).
- feriadosBancarios(ano) (fixos nacionais com 20/11 desde 2024, Carnaval, Sexta-feira Santa e Corpus Christi pela Páscoa, 31/12) e ocorrencias(obrigacao, de, ate).
- ics(ocorrencias, {agora, nome}) RFC 5545: dia inteiro, UID estável id-data@orquestrator-financas, DTSTAMP do parâmetro, descrição com fonte e 'confirmar com o contador', alarme 2 dias antes, escapes, CRLF e dobra em 75 octetos UTF-8; ocorrências expandidas por 12 meses (sem RRULE).

**Telas:** Nenhuma tela. Textos reaproveitados pelas telas: 'Faixa 2: de R$ 180 mil a R$ 360 mil de receita em 12 meses' · 'Receita dos últimos 12 meses R$ 300.000,00 × 11,2% − R$ 9.360,00 = R$ 24.240,00; ÷ R$ 300.000,00 = 8,08%' · 'DAS de outubro · vence 23/11 (20/11 é feriado nacional)' · 'Na 6ª faixa a alíquota efetiva pode cair: é a regra da lei.'

**Testes:** node --test testes/fiscal.test.mjs: vetores do F8 (RBT12 R$ 300.000 com folha R$ 90.000 → fator R 30%, Anexo III faixa 2, 8,08%; folha R$ 60.000 → 20%, Anexo V faixa 2, 16,50%); DAS de R$ 25.000,00 a 8,08% = R$ 2.020,00; fator R exatamente 28% vai ao III; continuidade nas 8 viradas das faixas 1→5 e descontinuidade esperada na 6ª; tabela com um dígito trocado nas faixas 1–5 recusada; tabelas do código iguais às da semente; proporcionalização no 1º e no 6º mês; Presumido com RBT12 300 mil, folha 90 mil e ISS 2% = R$ 57.990,00; folha para 28% = R$ 84.000,00; Páscoa 05/04/2026 e 28/03/2027, Carnaval 08–09/02/2027, Corpus Christi 27/05/2027; DAS da competência 10/2026: 20/11/2026 (sexta, feriado) → 23/11 com 'prorroga'; 20/12/2026 (domingo) → 21/12; .ics com CRLF, linhas ≤ 75 octetos com acentos, escapes, UID estável e texto idêntico em 3 execuções; 2.000 bases: DAS = arredondamento único do valor exato.

**Pronto quando:** node --test passa; fiscal.js não toca DOM, rede nem storage e roda igual no navegador e no Node; nenhum arquivo existente foi alterado.

**Riscos:** Tabelas e prazos vieram da pesquisa marcados 'conferir'; feriados municipais ficam fora (a tela avisa); a tabela de 2027 (LC 214/2025) não existe ainda e a estimativa para em 31/12/2026 de propósito; receitas de exportação não são segregadas. Coringa: só cria arquivos novos e pode correr em qualquer espaço livre (plano B da onda 2, ou ao lado da F3-2).

## F3-2-ganchos · Ganchos de extensão: ações registráveis no razão, pontes genéricas e campos novos do lançamento

**Para as sócias:** Quase nada muda na tela; é o que deixa Impostos, Med Painel, Comprovantes, Pagantes e Portfólio entrarem sem quebrar as páginas atuais e duas IAs trabalharem ao mesmo tempo sem mexer nos mesmos arquivos.

**Do plano:** Pré-requisito das entregas P2 do §7 (nasce da restrição de 2 agentes); §3.3 (capacidades por ação no lugar de readOnly, inclusive set_decision); §4.1/§4.2 (expenses.projectId e receipt{ref, sha256, mime, bytes}); §6.4 ('Ver a conta' reaproveitável); §8.7 (fotos de todas as páginas, inclusive as novas).

**Arquivos:** `razao.js`, `livro.js`, `app.js`, `index.html`, `static-bridge.js`, `ferramentas/arnes/ponte-simulada.js`, `ferramentas/arnes/servir.mjs`, `ferramentas/arnes/fotografar.mjs`, `servidor/netlify/functions/diario.mjs`, `extensoes.js (novo)`, `extensoes-dados.js (novo)`, `impostos-dados.js, impostos.js, projecao.js, planejar.js, projecao-tela.js, anexos.js, pagantes-dados.js, pagantes.js, portfolio-dados.js, portfolio.js, passkey.js (esqueletos novos)`, `impostos.css, planejar.css, projecao.css, anexos.css, pagantes.css, portfolio.css, passkey.css (vazios novos)`, `ferramentas/arnes/demo/indice.js e demo/impostos.js, planejar.js, projecao.js, anexos.js, pagantes.js, portfolio.js, passkey.js (esqueletos novos)`, `ferramentas/arnes/telas/indice.mjs e telas/impostos.mjs, planejar.mjs, projecao.mjs, anexos.mjs, pagantes.mjs, portfolio.mjs, origem.mjs, passkey.mjs (esqueletos novos)`, `testes/ganchos.test.mjs (novo)`

**Dados:** - razao.js: registrarExtensao({nome, acoes:{[acao]:{verbo, aplicar(ctx)}}, inicial(), sobrepor?(estadoEfetivo, estadoDaExtensao), acoesAntigas?:{[acaoDaPonte]: payload → conteudo}, pode?:{[acao]: (membro, modo) → {ok, motivo}}}). aplicar() trata as ações embutidas como hoje e entrega as registradas ao módulo dono; ctx = {estado do módulo, conteudo, autora, quando, ev, membros, dono(id), texto(v, max), recusar(motivo, codigo), registrar(itemDoHistorico)}; saída ganha aplicado.extensoes[nome]; ação desconhecida continua recusada com o mesmo motivo; ordem de registro fixa (extensoes-dados.js), fold determinístico. extensoes-dados.js é importado por livro.js, static-bridge.js e ponte-simulada.js antes de qualquer aplicar, e entrega a contas.conferirFechamentos o aplicar com extensões.
- Gasto ganha 2 campos opcionais (null por padrão, validados só quando presentes): projeto = id de ativo do atlas /^[A-Za-z0-9._-]{1,80}$/; comprovante = {ref: SHA-256 hex do cifrado, sha256: SHA-256 hex do claro, mime ∈ image/jpeg | image/png | image/webp | application/pdf, bytes 1..4.194.304, nome ≤ 120}. Entram em CAMPOS_GASTO, validarGasto, pick e no FIM do CSV ('projeto', 'comprovante' sim/não); as 16 colunas atuais não mudam.
- livro.js: registrarCampo({id, montar(container, gasto, D) → {ler()}}) em 'Mais opções' do + Lançar e registrarDecoracao((gasto, artigo, D) → void) nos cartões de Lançamentos. Os módulos novos importam de './livro.js' (não há kit.js: os ajudantes já são exportados desde a F2-2).
- Pontes (static-bridge.js e ponte-simulada.js): depois do R.estadoEfetivo, aplicam o sobrepor de cada extensão antes do buildSnapshot; financeWebRequest de uma ação antiga mapeada por extensão (ex.: set_decision) vira conteudo e vai para window.financeLivro.gravar; financeHost.pode(acao) consulta o pode das extensões. Assim a F3-7 não edita as pontes.
- app.js: window.financeRegistrarRender(chave, fn) para 'medpainel' e 'projection' (com fn registrada, renderMedPainel/renderProjection delegam e o código antigo fica inerte); canDecide e renderDecision passam a usar host().pode('set_decision') (falso até a F3-7 registrar).
- index.html: <script type=module src=extensoes.js> depois do livro.js, links para os 7 CSS novos e CSP img-src 'self' data: blob: (miniaturas da F3-5).
- servidor/netlify/functions/diario.mjs: config.path = '/api/*' (as rotas novas da F3-5, F3-8 e F3-9 entram só no nucleo.mjs).
- extensoes.js importa os esqueletos (impostos.js, planejar.js, projecao-tela.js, anexos.js, pagantes.js, portfolio.js, passkey.js); cada página nova se registra por window.financeRegistrarPagina (F2-4).
- Arnês: ponte-simulada.js importa demo/indice.js no ?demo=1 e servir.mjs mapeia /demo/* (os módulos de demo não importam nada, como a demonstracao.js); fotografar.mjs importa telas/indice.mjs para as fotos extras (as páginas já vêm do registro desde a F2-4).

**Telas:** Nenhuma página nova. Visível: a dica do chip 'Pró-labore e folha' no + Lançar: 'Lance o valor bruto, antes do INSS retido: é a base do fator R.' Histórico e Recusados iguais aos de hoje.

**Testes:** testes/ganchos.test.mjs: extensão registrada é aplicada e entra no Histórico com o verbo dela; ação não registrada continua recusada; mesma sequência dá o mesmo resultado em 3 execuções; extensão com sobrepor muda o snapshot nas duas pontes; ação antiga mapeada vira evento; conferirFechamentos com o aplicar das extensões dá o mesmo selo; gasto com projeto e comprovante válidos aceito; mime fora da lista, bytes acima de 4 MiB e ref não hexadecimal recusados; CSV mantém as 16 colunas antigas e acrescenta 2 no fim; estado sem os campos novos dá o mesmo livroDoMes (vetores de outubro intactos). Todos os testes antigos passam. Fotos: 4 cortes, todas as páginas do registro, 0 erro de script, 0 violação de CSP, sem rolagem horizontal a 390px; comparação com as fotos do fim da fase 2: só a dica nova mudou.

**Pronto quando:** Todos os testes passam; as fotos batem com as da fase 2 exceto a dica; os esqueletos carregam sem erro; as fatias F3-3 a F3-9 conseguem trabalhar só nos arquivos listados para cada uma.

**Riscos:** Regressão nas páginas atuais (refatorar aplicar e as pontes mexe no coração: vetores antigos e fotos antes/depois); ordem de carga (evento de extensão lido antes do registro apareceria como recusado: por isso o import estático nas três entradas); colunas novas no CSV podem surpreender o contador (vão no fim). Mexe em quase todos os arquivos compartilhados: o outro agente fica com a F3-1.

## F3-3-impostos · Página Impostos: DAS estimado, fator R, faixa, comparador de regime e prazos no calendário

**Para as sócias:** Veem quanto de DAS vem no mês e por quê (receita de 12 meses, fator R, faixa, alíquota), comparam os regimes e põem os prazos fiscais no calendário do celular.

**Do plano:** §5 Impostos (P2, M); §7 P2.1; §4.6 F8 e F9 (o imposto calculado pode atualizar imposto.simples_efetiva_pct, que o resultado já usa); §4.2 obligations; D9; §8.8 ('Ver a conta', teste de leitura).

**Arquivos:** `impostos-dados.js`, `impostos.js`, `impostos.css`, `testes/impostos.test.mjs (novo)`, `ferramentas/arnes/demo/impostos.js`, `ferramentas/arnes/telas/impostos.mjs`

**Dados:** Extensão 'fiscal' (impostos-dados.js, sem DOM):
- add_obligation {alvo, titulo ≤ 120, regra mensal:D | anual:MM-DD | data:AAAA-MM-DD, diaNaoUtil, fonte obrigatória, nota} — qualquer sócia; void_obligation {alvo, motivo} — autora ou responsável.
- set_fiscal {chave: 'regime' (simples | presumido) | 'inicio_atividade' (AAAA-MM) | 'iss_pct' (decimal 2–5) | 'rbt12_informado' | 'folha12_informada' (centavos, por competência), competencia?, valor, fonte obrigatória} — qualquer sócia, sempre com autora e fonte (D4 fica com o Bauer).
- set_tabela_simples {anexo, desde, ate, faixas, fonte} — só a responsável; recusado se fiscal.validarTabela falhar (continuidade nas faixas 1→5, 6ª conferida).
Agregação pura:
- receitasMensais(aplicado): único ponto que conhece o formato da fase 2; bruto (já sem cancelamentos) em reais por competência, somando canais e produtos (moeda estrangeira pelo F4).
- folhaMensal = gastos não anulados da categoria pro_labore.
- Por competência: rbt12 (informado pelo contador > calculado), folha12, fatorR, anexo, tabela vigente (código + diário), efetiva, dasEstimado; RBT12 'provisório' se algum dos 12 meses não está fechado ou não tem receita.
- DAS pago: gasto não anulado em impostos_taxas, competência = mês, descrição começando por 'DAS' (o botão 'Lançar o DAS pago' preenche assim); diferença estimado × pago com sinal.
- Sugestão de parâmetro: se a efetiva calculada difere de imposto.simples_efetiva_pct vigente, o botão grava set_parameter (fonte 'calculado na página Impostos: RBT12 R$ X, fator R Y%').
Nada de nome do contador, CNPJ ou município no código: tudo isso entra pelo diário (set_fiscal), cifrado.

**Telas:** Página 'Impostos' registrada por financeRegistrarPagina (grupo Dinheiro, depois de Parâmetros; rota #impostos).
- Nível 1: 'Outubro: DAS estimado R$ 2.020,00 (8,08% sobre R$ 25.000,00), vence 23/11. Fator R 30%: Anexo III.' e 4 números com 'Ver a conta': Receita dos últimos 12 meses · Fator R · Alíquota efetiva · DAS do mês.
- Nível 2: termômetro do fator R (0–50% com marca em 28%, valor escrito) e 'Para chegar a 28%, a folha dos 12 meses precisaria somar R$ 84.000,00; hoje soma R$ 60.000,00.'; tabela das 6 faixas com a atual destacada; comparador Simples III × V × Presumido em barras horizontais com 'Estimativa para conversar com o contador. O portal informa, não aconselha.'
- Nível 3: tabela mês a mês (receita, RBT12, fator R, anexo, efetiva, DAS estimado, DAS lançado).
- Prazos: próximos 12 meses com 'faltam N dias', fonte e selo 'a confirmar'; 'Baixar para o calendário (.ics)'; 'Novo prazo'.
- 'Dados do contador' (folha): regime, início de atividade, RBT12 e folha informados, ISS do município, tabela nova.
- Avisos: 'Ainda não há tabela do Simples para 2027 com fonte: a estimativa para em dezembro até alguém cadastrar.' e 'Lucro distribuído acima de R$ 50 mil no mês para a mesma sócia tem retenção de 10% (Lei 15.270/2025). Confirme com o contador.'
- Em treino, tudo funciona com a faixa 'nada é salvo'.

**Testes:** testes/impostos.test.mjs: add_obligation sem fonte recusado; set_tabela_simples com a tabela oficial (6ª faixa descontínua) aceito, com um dígito trocado nas faixas 1–5 recusado e por não-responsável recusado; rbt12_informado prevalece; com a demo de 12 meses (RBT12 R$ 300 mil, folha R$ 90 mil) a efetiva dá 808 bp e o DAS de outubro R$ 2.020,00; mês sem receita marca 'provisório'; DAS pago encontrado com diferença com sinal; .ics tem as ocorrências da demo; fold determinístico. Fotos (?demo=1): Impostos nos 4 cortes, estado vazio sem receitas, 'Ver a conta' do DAS e a folha de novo prazo; 0 erro de script/CSP, sem rolagem horizontal a 390px; download do .ics sem erro; termômetro e comparador com um tab stop cada.

**Pronto quando:** Com a demo, a página mostra 8,08%, R$ 2.020,00 e vencimento 23/11/2026; 'Ver a conta' chega à fórmula com os valores reais; o .ics abre no calendário do Mac e do iPhone; nenhuma frase recomenda regime.

**Riscos:** Meses antigos sem receita lançada subestimam o RBT12 ('informado pelo contador' e selo provisório); casar o DAS pago pela descrição é heurístico (dito na tela); a estimativa para em 01/2027 até cadastrarem a tabela nova; sem segregação de exportação o DAS de Apple/Stripe internacional sai maior (aviso quando houver canal estrangeiro).

## F3-4a-medpainel · Med Painel ligado aos parâmetros, com o motor em centavos e o simulador 'e se'

**Para as sócias:** O Med Painel passa a usar o dólar, as taxas e o imposto do portal, diz de onde vem cada número, para de mostrar 'empresa R$ 0' e deixa testar 'e se' sem salvar.

**Do plano:** §5 Med Painel (P2: parâmetros, selo 'padrão do código', simulador 'e se', área por canal, aporte acumulado) e as correções P0 que ficaram (mpRepartir em inteiros, fixed_monthly, eixo X proporcional, um tab stop por gráfico, mesa de teste não recriada); §7 P2.2; §4.2 parâmetro × premissa; §6.3; §8.1 (mpRepartir, fixed_monthly).

**Arquivos:** `projecao.js`, `planejar.js`, `planejar.css`, `testes/projecao.test.mjs (novo)`, `ferramentas/arnes/demo/planejar.js`, `ferramentas/arnes/telas/planejar.mjs`

**Dados:** - projecao.js: projetar({premissas, cenario, parametros, base, sobrepor}) puro, mês a mês; assinantes em milésimos inteiros, dinheiro em centavos, um arredondamento por valor a partir do produto exato (BigInt); mantém as fórmulas do projetarMedPainel atual; partes das sócias por razao.ratear (corrige os 41.088 trios que o mpRepartir recusa).
- Origem de cada número, por prioridade: Parâmetro vigente hoje (câmbio ← fx.USD_BRL; taxa ← taxa.<canal>_pct e _fixa, com a premissa nova 'canal_venda') > Calculado (fiscal.efetiva sobre o RBT12 projetado; sem histórico, imposto.simples_efetiva_pct) > Premissa (pacote de 18/10 + diário) > padrão do código; cada valor sai com origem {tipo, ref, data, autora}.
- Custo fixo da empresa: média dos 3 últimos meses fechados; sem eles, o custo do mês corrente pelo razao.livroDoMes, rotulado 'estimado'.
- Extensão 'planejar': set_premissa {chave do catálogo, cenario pessimista | base | otimista | todos, valor decimal em texto, fonte obrigatória, nota, versao} — qualquer sócia; faixa dura por premissa; versão por chave.
- simular(base, delta{preco, churn, verba}) → Δ assinantes no mês 12, Δ mês da meta, Δ aporte total; não grava.
- planejar.js: tela do Med Painel por financeRegistrarRender('medpainel'), com a mesa de teste (host().painelUrl) preservada e window.financeMedPainel reexposto.

**Telas:** Cada premissa com pílula de proveniência ('Parâmetro · PTAX 16/10 · Ana', 'Calculado · Simples 8,08%', 'Premissa · chute', 'padrão do código'); 'Mudar premissa' abre folha com valor, cenário e fonte. Simulador 'E se…' (preço, perda ao mês, verba): 'Com preço de R$ 69,90: +412 assinantes no mês 12, meta 3 meses antes, R$ 8.300 a menos de aporte. Nada foi salvo.' e 'Guardar como premissa'. Gráfico de assinantes (eixo X proporcional, um tab stop), área por canal (linhas[].canais), barras do resultado com a linha do aporte acumulado: 'Precisamos aportar no total R$ X; o caixa fica positivo no mês N.'

**Testes:** testes/projecao.test.mjs: com as premissas do arnês, o mês 1 bate com a conta à mão em centavos; partes das sócias somam o lucro exato em 2.000 casos (inclui 0,1 / 64,1 / 35,8); mudar fx.USD_BRL muda só o custo em dólar; o imposto troca de faixa quando o RBT12 projetado passa de R$ 180 mil; set_premissa fora da faixa, sem fonte ou com versão velha recusado; simular não grava evento; determinístico em 3 execuções; window.financeMedPainel continua exposto. Fotos (?demo=1): Med Painel nos 4 cortes, simulador aberto e a folha 'Mudar premissa'; 0 erro de script/CSP, sem rolagem horizontal e sem rótulo sobreposto a 390px; a mesa de teste não é recriada a cada redesenho.

**Pronto quando:** No arnês: o Med Painel mostra o dólar do Parâmetro com a pílula e a autora; o custo fixo da empresa deixa de ser R$ 0; o simulador dá os três Δ sem gravar; uma premissa mudada aparece no Histórico e refaz a projeção.

**Riscos:** Tirar o Med Painel do app.js pode regredir os gráficos (o código antigo fica inerte até uma limpeza futura); trocar float por centavos muda alguns números no último real (listar as diferenças no PR); se apertar, cascata dos R$ 59,90 e LTV/CAC ficam fora.

## F3-5-comprovantes · Comprovantes cifrados: foto ou PDF anexado ao gasto, guardado no servidor do diário

**Para as sócias:** A foto do recibo fica presa ao gasto, cifrada no próprio celular; quem confere (sócias e contador) acha o comprovante sem procurar no e-mail.

**Do plano:** §5 Comprovantes cifrados (P2, M); §7 P2.4 (R2 trocado por Netlify Blobs); D13; §4.2 expenses.receipt{ref, sha256, mime, bytes}; §8.4 (servidor cego, adulteração detectada).

**Arquivos:** `anexos.js`, `anexos.css`, `diario.js`, `servidor/nucleo.mjs`, `testes/servidor.test.mjs`, `testes/anexos.test.mjs (novo)`, `ferramentas/arnes/demo/anexos.js`, `ferramentas/arnes/telas/anexos.mjs`

**Dados:** - diario.js ganha d.anexos.{guardar(bytes, mime, nome) → {ref, sha256, mime, bytes, nome}, abrir(ref, sha256) → {bytes, integro}}: chave = HKDF(K, 'orquestrator-diario/anexos/v1'); AES-GCM com IV aleatório e AAD 'anexo|v1|' + SHA-256 do claro; corpo = iv‖ct; ref = SHA-256 do corpo cifrado. Em treino, um Map da aba.
- servidor/nucleo.mjs: PUT /api/anexos/<ref> (Bearer do diário; corpo binário; SHA-256(corpo) ≠ ref → 400; acima de 4,5 MB → 413; onlyIfNew; mesmo ref → 200, idempotente) e GET /api/anexos/<ref> (Bearer); CORS passa a liberar PUT; sem rota de apagar; armazemEmMemoria ganha set/get binário.
- O evento guarda só comprovante {ref, sha256, mime, bytes, nome}, cifrado junto com o lançamento (campo da F3-2). Anexar a um gasto antigo = edit_expense com dados.comprovante (motivo se o gasto é de outra sócia; recusado em mês fechado, como toda edição).
- No navegador, imagem reduzida antes de cifrar (lado maior 2.000 px, JPEG 0,82); PDF como está; limite de 4 MB depois de reduzir (a função Netlify aceita até 6 MB por pedido e o binário viaja em base64 por dentro).

**Telas:** + Lançar, em 'Mais opções' (registrarCampo): 'Comprovante' com 'Tirar foto' e 'Escolher arquivo'; estado por extenso: 'Cifrando… Enviando… Anexado: recibo.jpg, 312 KB'. Falha: 'O comprovante não foi enviado. Salvar o gasto sem ele e anexar depois?' Lançamentos (registrarDecoracao): clipe e miniatura de 48 px decifrada só quando aparece na tela; 'Anexar comprovante'. Visor: imagem, ou 'Abrir PDF' e 'Baixar'; selo 'Comprovante íntegro: o arquivo é exatamente o que foi anexado' ou 'Este comprovante não confere'. Ajuda: 'O arquivo é cifrado no seu aparelho antes de sair; o servidor guarda só embaralhado.' Em treino: 'No treino o comprovante fica só nesta aba.'

**Testes:** testes/anexos.test.mjs (contra servidor/nucleo.mjs em memória): ida e volta de 1 MB igual byte a byte; 1 byte trocado no armazém → não decifra e o cartão diz 'não confere'; o armazém não contém trecho conhecido do claro; outra sócia abre o anexo; treino não chama a rede. testes/servidor.test.mjs: sem token 401, ref que não bate 400, acima do limite 413, PUT repetido 200 sem duplicar, GET devolve o mesmo corpo, preflight libera PUT, nenhuma rota apaga. Fotos com ?diario=local: + Lançar com comprovante (imagem gerada por canvas no teste, nenhum arquivo real), cartão com clipe e miniatura, visor com o selo, nos 4 cortes; 0 erro de script/CSP.

**Pronto quando:** No arnês com ?diario=local, uma foto anexada por uma sócia aparece em miniatura para outra, abre no visor com 'Comprovante íntegro' e o armazém não contém o arquivo em claro; em treino funciona na aba e avisa que some.

**Riscos:** Limite de corpo das funções Netlify (4 MB e redução no navegador); cota do Blobs; HEIC do iPhone depende da conversão do Safari; comprovante com CPF é dado pessoal — cifrado, mas o servidor só acrescenta: anular desliga do gasto, não apaga (dito com franqueza, LGPD). Só vale de verdade com o servidor publicado.

## F3-6-pagantes · Usuários e pagantes: funil, receita recorrente e churn por produto, com importação agregada no aparelho

**Para as sócias:** Veem quantos pagam, quantos entraram e saíram e quanto entra por mês em cada produto, e trazem o relatório da Hotmart sem que nenhum nome ou e-mail saia do aparelho.

**Do plano:** §5 Usuários e pagantes (P2, M); §7 P2.5 (parte 1); D12 (importação de CSV agregada no navegador); §9.2 (LGPD: só agregados).

**Arquivos:** `pagantes-dados.js`, `pagantes.js`, `pagantes.css`, `testes/pagantes.test.mjs (novo)`, `ferramentas/arnes/demo/pagantes.js`, `ferramentas/arnes/telas/pagantes.mjs`

**Dados:** Métricas (pagantes-dados.js, sem DOM) a partir das receitas agregadas da fase 2 (competência, canal, produto, bruto, cancelados, transações, ativos, novos, perdidos, testes, cadastros), por um adaptador único:
- ativosInicio = ativos − novos + perdidos; churn em bp = arred(perdidos × 10000 ÷ ativosInicio) (0 → '—').
- Receita recorrente do mês em centavos; ARPU = arred(receita ÷ ativos); conversão = novos ÷ cadastros e testes ÷ cadastros, em bp.
- CAC medido = gastos de marketing do mês (com projeto, quando houver) ÷ novos.
- Campo ausente → etapa escondida; nunca um zero inventado.
Importação:
- lerCSV(texto): separador ; ou , detectado, aspas, BOM, decimal pt-BR ou en-US, datas dd/mm/aaaa ou ISO.
- mapearColunas: sugestão por nomes conhecidos e confirmação da sócia (data, valor bruto, situação, comprador).
- agregar por competência: transações, bruto em centavos sem os cancelados (razao.centavosBR), cancelados, compradores únicos (SHA-256 com sal aleatório só em memória, descartado ao fechar), novos (primeira aparição no arquivo).
- Gera add_income (um por mês, canal e produto) com fonte 'importado de CSV (Hotmart), 12 meses'; mês já lançado → mostra os dois e pede 'Substituir' (edit_income) ou 'Pular'.

**Telas:** Página 'Usuários e pagantes' por financeRegistrarPagina (grupo Empresa; rota #pagantes). Frase: 'Med Painel em outubro: 40 pagantes (+12, −2), R$ 2.396,00 no mês, perda de 6,7%.' Números: Pagantes ativos · Entraram · Saíram · Receita recorrente do mês. Funil em barras horizontais (cadastros → testes → pagantes novos), colunas de 12 meses de ativos, tabela mês a mês. 'Importar relatório' em 3 passos (arquivo → conferir colunas → ver o que vai ser lançado), com o aviso fixo: 'Nomes e e-mails do arquivo não saem deste aparelho e não são guardados: só os totais do mês entram no diário.' Vazio: 'Nenhuma receita lançada ainda. Lance o mês no Caixa ou importe o relatório da plataforma.'

**Testes:** testes/pagantes.test.mjs: churn, receita recorrente, ARPU e conversões em inteiros com vetores à mão; ativosInicio 0 sem divisão por zero; CSV com ';' e vírgula decimal, outro com ',' e ponto, BOM e aspas contendo ';'; um CSV fictício gerado no teste (200 linhas, 3 meses) agrega em totais exatos; os eventos gerados não contêm nenhum nome, e-mail ou identificador do arquivo (varredura do JSON); mês repetido pede substituição; determinístico. Fotos (?demo=1): página nos 4 cortes, os 3 passos da importação com o CSV fictício e o estado vazio; 0 erro de script/CSP, sem rolagem horizontal a 390px.

**Pronto quando:** No arnês, a página mostra funil, pagantes e churn da demo; o CSV fictício vira 3 lançamentos de receita só com números, visíveis no Histórico; a varredura confirma que nada pessoal entrou no diário.

**Riscos:** Formatos de relatório mudam (mapeamento confirmado pela sócia); o relatório da Apple vem em dólar e já agregado (tratado como agregado e convertido pelo F4); dado pessoal só em memória — um erro que gravasse uma linha seria vazamento (a varredura é teste obrigatório).

## F3-7-portfolio-lab · Portfólio com custo por projeto e decisão de destino pelo diário; catálogo nativo do Laboratório

**Para as sócias:** Veem quanto cada projeto já custou, a responsável decide o destino de um ativo pelo próprio portal (fica registrado) e o Laboratório abre com um catálogo claro de maquetes, gratuitas ou pagas.

**Do plano:** §5 Portfólio e Laboratório (P2, M); §7 P2.5 (parte 2); §4.2 expenses.projectId; §3.3 capacidades por ação (set_decision); §5 Controles honestos.

**Arquivos:** `portfolio-dados.js`, `portfolio.js`, `portfolio.css`, `app.js`, `galeria.js`, `testes/galeria.test.mjs`, `testes/portfolio.test.mjs (novo)`, `ferramentas/arnes/demo/portfolio.js`, `ferramentas/arnes/telas/portfolio.mjs`

**Dados:** - Extensão 'portfolio': set_destino {alvo: id do ativo, destino ∈ lista fechada em portfolio-dados.js (a mesma do destinoLabels do app.js), ajuste inteiro −100..100, justificativa ≤ 500, proximo_passo ≤ 500} — só a responsável (papel owner do estado); vale a última por ativo; as anteriores ficam no Histórico. acoesAntigas: set_decision (o formulário 'Decisão do Criador' que já existe) vira set_destino pelas pontes genéricas da F3-2. pode('set_decision') = responsável com diário em gravação ou treino.
- sobrepor(estadoEfetivo): aplica a última set_destino de cada ativo em staticBlocks.atlas.assets[].decisao {destino, ajuste, justificativa, proximo_passo, autor, em} e recalcula a prontidão final = automática + ajuste, limitada a 0..100. Sem editar static-bridge.js nem ponte-simulada.js.
- custoPorProjeto(aplicado, lista, projetoId) → {totalBrlMinor (F4), porMes dos últimos 3, n, semCambio[]}; campo 'Projeto' no + Lançar por registrarCampo (ativos do atlas, com busca).
- Laboratório: SEM galeria/catalogo.json. galeria/ é do publicador do ia-chat ('não se edita aqui', README) e já traz o catálogo em <script type=application/json id=catalogo> com nome, resumo, proposta (Pago, Gratuito…) e modelo_negocio. galeria.js ganha itens() (o catálogo lido, com os 'Sem stand' do legado) e app.js renderLab desenha a grade nativa a partir dele.

**Telas:** Portfólio: no topo, barra 100% por destino e ranking por prontidão; em cada cartão e ficha, 'Custou R$ 1.230,00 em 7 lançamentos (últimos 3 meses: R$ 410,00) · Ver lançamentos'. Ficha: o formulário 'Decisão do Criador' funciona para a responsável: 'A decisão fica no Histórico com o seu nome e a data; a anterior não se apaga.' Para as outras: 'Só a responsável decide o destino.' Laboratório: grade nativa antes da moldura; cartão com título, resumo de uma linha, chip pela 'proposta' (gratuito, pago, assinatura, interno — forma e texto, não só cor), 'Abrir aqui' e 'Tela cheia' (o link do PR). Sem catálogo legível, volta ao índice atual.

**Testes:** testes/portfolio.test.mjs: set_destino de não-responsável recusado; destino fora da lista recusado; sobreposição muda decisão e prontidão final (automática 78 + ajuste 6 = 84; limite 100); set_decision pela ponte vira set_destino; custo por projeto soma em reais pelo F4 e ignora anulados. testes/galeria.test.mjs: itens() devolve o catálogo do repositório com a proposta e os do legado como 'Sem stand'. Fotos: Portfólio e ficha como responsável (?membro=m-bauer) e como sócia (?membro=m-ana), Laboratório pelo catálogo e com um cartão aberto, nos 4 cortes; 0 erro de script/CSP; o foco volta ao cartão ao fechar a ficha.

**Pronto quando:** No arnês, a responsável guarda uma decisão que aparece na ficha, no chip e no Histórico; uma sócia vê o motivo no lugar do formulário; um gasto com projeto entra no custo do ativo; o Laboratório abre pela grade nativa; nenhum arquivo de galeria/ foi editado.

**Riscos:** Decisão do diário × decisão gravada no pacote de 18/10 (o diário vence, e a ficha diz isso); galeria.js e renderLab são do PR (só depois do merge); decisão em treino some ao recarregar.

## F3-8-origem-propria · Origem própria com cabeçalhos de segurança no Netlify e a fila de envio que não se perde

**Para as sócias:** O portal ganha um endereço só dele, mais protegido, e um lançamento feito sem sinal fica guardado (cifrado) até voltar a conexão, mesmo fechando a aba.

**Do plano:** §7 P2.6 (domínio, CSP por cabeçalho, fila em IndexedDB); D14; §3.7 passos 2 e 4 (8 s para desfazer sem enviar, fila); §3.11 (frame-ancestors, HSTS, nosniff, Referrer-Policy, Permissions-Policy); §3.6 (reenvio idempotente); §8.4 item 10; §8.5 itens 3, 7 e 8.

**Arquivos:** `netlify.toml (novo, na raiz)`, `_headers (novo)`, `ferramentas/publicar.mjs (novo)`, `origem.js (novo)`, `index.html`, `static-bridge.js`, `diario.js`, `livro.js`, `servidor/nucleo.mjs`, `testes/servidor.test.mjs`, `testes/fila.test.mjs (novo)`, `testes/publicar.test.mjs (novo)`, `ferramentas/arnes/servir.mjs`, `ferramentas/arnes/telas/origem.mjs`, `servidor/LEIA.md`

**Dados:** - Hospedagem: o MESMO site Netlify do diário passa a servir portal + funções na mesma origem (o Blobs é por site). Recomendação: sem renomear — orquestrator-diario.netlify.app já é uma origem só do portal (netlify.app está na Public Suffix List) e o github.io continua achando o diário no mesmo endereço. Se o Bauer renomear, este PR troca junto DIARIO_URL, a connect-src da meta CSP e DIARIO_ORIGENS. netlify.toml na raiz: build 'npm --prefix servidor ci && node ferramentas/publicar.mjs', publish '_site', functions 'servidor/netlify/functions'. publicar.mjs copia tudo menos servidor/, testes/, ferramentas/, docs/, .github/ e *.md (lista de exclusão).
- _headers: CSP = a da meta + frame-ancestors 'none' e connect-src 'self' https://olinda.bcb.gov.br; img-src 'self' data: blob:; Strict-Transport-Security max-age=31536000; X-Content-Type-Options nosniff; Referrer-Policy no-referrer; Permissions-Policy camera=(), microphone=(), geolocation=(), publickey-credentials-get=(self), publickey-credentials-create=(self); Cross-Origin-Opener-Policy same-origin; regra própria para /galeria/*, /apps/* e /painel/*; bundle-*.bin com cache imutável. A meta CSP continua (vale no GitHub Pages).
- origem.js (carregado pelo index.html): ORIGEM_OFICIAL (vazia até o Bauer escolher); no bauerfilho.github.io, quando preenchida, mostra 'O portal mudou de endereço' com o link (mantendo o #) e redireciona em 3 s. static-bridge.js: DIARIO_URL = location.origin fora do *.github.io; no github.io, o endereço do site Netlify.
- Fila (diario.js): todo evento passa por uma caixa de saída; 8 s em que 'Desfazer' cancela sem enviar; depois envia, com nova tentativa e espera crescente sem rede. O pendente é cifrado com HKDF(K, 'orquestrator-diario/fila/v1') e guardado em IndexedDB SÓ na origem própria (no github.io fica em memória + aviso ao fechar, como hoje). No acesso seguinte, decifra e reenvia.
- Servidor idempotente: ids/<id do evento> → seq com onlyIfNew; reenviar um id já gravado devolve o seq original (201 perdido na rede não duplica).

**Telas:** Cabeçalho: 'Enviando em 8 s · Desfazer'; '1 lançamento na fila — nada se perdeu'; 'Sem conexão: guardado neste aparelho, cifrado' (só na origem própria; no github.io continua 'não feche a aba'). Endereço antigo: 'O portal mudou de endereço: <novo>. Atualize o atalho na tela de início.' Estado do portal passa a mostrar a origem e se a fila é persistente.

**Testes:** testes/fila.test.mjs (armazenamento em memória no lugar do IndexedDB): desfazer em 8 s não envia nada; sem rede o evento fica e sai quando a rede volta; 201 perdido → reenvio com o mesmo id dá o mesmo seq; a fila cifrada não contém o texto do lançamento; outra senha não decifra a fila. testes/servidor.test.mjs: idempotência por id. testes/publicar.test.mjs: _site tem index.html, todos os .js e .css e o pacote, e não tem servidor/, testes/, ferramentas/ nem docs/; _headers tem frame-ancestors 'none' e connect-src 'self'. Arnês: servir.mjs aplica o _headers → fotos de todas as páginas nos 4 cortes com a CSP por cabeçalho e 0 violação (inclui Laboratório, tela cheia e mesa de teste); o portal dentro de um iframe de outra origem não renderiza; IndexedDB conferido no Chromium em localhost.

**Pronto quando:** Com servir.mjs emulando os cabeçalhos, nenhuma página registra violação de CSP; num deploy de prévia da Netlify (sem tocar em produção) o portal abre, entra e lança na mesma origem do diário; a fila passa nos testes e, na origem própria, sobrevive a fechar a aba; no github.io nada vai para disco.

**Riscos:** Mudar a pasta base pode quebrar a publicação do servidor (prévia antes); a CSP por cabeçalho se soma à da meta e pode bloquear a galeria, a tela cheia ou a mesa de teste (documentos blob: herdam a política) — por isso o arnês emula os cabeçalhos; Permissions-Policy camera=() não deve afetar o <input capture> da F3-5 (conferir no iPhone); duas origens convivem até o redirecionamento; nada muda para as sócias até o Bauer publicar.

## F3-4b-projecao-empresa · Projeção da empresa com o motor do Med Painel e a base nos meses fechados

**Para as sócias:** A Projeção deixa de ser um texto antigo e mostra o caixa da empresa nos próximos 24 meses, dizendo de quais meses fechados saiu a base.

**Do plano:** §5 Projeção (P2, M); §7 P2.3; §6.3 (real sólido, projeção hachurada).

**Arquivos:** `projecao.js`, `projecao-tela.js`, `projecao.css`, `testes/projecao-empresa.test.mjs (novo)`, `ferramentas/arnes/demo/projecao.js`, `ferramentas/arnes/telas/projecao.mjs`

**Dados:** projetarEmpresa() em projecao.js: base = últimos min(3, N) meses fechados (receita média das receitas da fase 2, custo médio dos fechamentos, caixa = saldos informados, pagantes = último mês) + crescimento do Med Painel no cenário escolhido → 24 meses de entrada, saída e saldo, em centavos. Sem mês fechado devolve {precisa: '1 mês fechado'}; nunca inventa base. projecao-tela.js desenha a página por financeRegistrarRender('projection') com o gráfico de fluxo da F2-2.

**Telas:** 'Base: setembro e outubro de 2026 (fechados) · média de 2 meses.' + fluxo de 24 meses (entrou em azul, saiu em vinho, saldo em ouro, futuro hachurado) + 'Fôlego projetado'. Os cenários do documento de 18/10 ficam recolhidos como 'registro importado'. Sem mês fechado: 'A projeção da empresa precisa de 1 mês fechado. Enquanto isso, veja a do Med Painel.'

**Testes:** testes/projecao-empresa.test.mjs: usa só meses fechados; responde 'precisa de 1 mês fechado' sem eles; muda quando um mês novo fecha e não muda com lançamento em mês aberto; determinístico. Fotos (?demo=1): Projeção nos 4 cortes e sem mês fechado; 0 erro de script/CSP; um tab stop por gráfico.

**Pronto quando:** A Projeção diz de quais meses fechados saiu a base, nunca mostra número sem base, e o registro importado de 18/10 continua acessível.

**Riscos:** Com 1 ou 2 meses fechados a base é frágil (dizer 'média de N meses'); fica para o fim da fase porque só ganha sentido depois de outubro e novembro fechados.

## F3-9-face-id · Entrar com Face ID (passkey com PRF), sem digitar a frase-senha

**Para as sócias:** Entram com o rosto ou a digital em vez da frase-senha longa; a senha continua valendo como chave mestra.

**Do plano:** §5 Entrar com Face ID (P2, G); §7 P2.6 (passkey PRF); §9.1 (senha fraca); §3.4 (o limite do Criador continua).

**Arquivos:** `passkey.js`, `passkey.css`, `diario.js`, `static-bridge.js`, `app.js`, `servidor/nucleo.mjs`, `testes/servidor.test.mjs`, `testes/passkey.test.mjs (novo)`, `ferramentas/arnes/ponte-simulada.js`, `ferramentas/arnes/servir.mjs`, `ferramentas/arnes/telas/passkey.mjs`

**Dados:** - Ativar (depois de entrar com senha; pede a senha de novo): navigator.credentials.create com rp.id = location.hostname, residentKey required, userVerification required e extensions.prf; se o PRF não vier na criação (iOS), um get com allowCredentials. PRF com sal fixo = SHA-256('orquestrator-financas/passkey/v1') → HKDF(prf, 'orquestrator-passkey/v1') → chave AES-GCM → envelope = cifra de {v:1, membroId, masterRaw, K do diário, chave privada de assinatura em JWK}, AAD 'passkey|v1|' + credId → POST /api/passkeys {credId, membro, envelope} (Bearer do diário; onlyIfNew).
- Entrar: get descobrível com prf.eval → credId → GET /api/passkeys/<credId> (sem token: o envelope é inútil sem o autenticador) → decifra → static-bridge entra com o masterRaw (sem unlock pela senha) e abrirDiario recebe K e a chave de assinatura direto (opção nova, sem PBKDF2). app.js: 'login_passkey' entra na lista fechada de ações (app.js:8) e a entrada sem senha chama o mesmo enterSession.
- Revogar: POST /api/passkeys/revogar {membro} grava um marcador datado (só acréscimo); envelopes anteriores respondem 410. 'Esquecer o Face ID em todos os aparelhos' é isso (o token de escrita é comum, derivado da chave do diário).
- Liberado por origem: a origem própria da F3-8 e localhost; bauerfilho.github.io só se o Bauer decidir (D16).

**Telas:** Entrada: abaixo da senha, discreto, 'Entrar com Face ID' (só onde há passkey e o navegador oferece PRF). Depois de entrar com senha, uma vez: 'Quer entrar com Face ID neste aparelho? Seu rosto ou digital destrava o portal nos seus aparelhos Apple com o mesmo iCloud; a senha continua valendo.' → 'Confirme sua senha para ativar'. Na sessão: 'Face ID ativo · Esquecer o Face ID em todos os aparelhos'. Erros: 'Este navegador não oferece a chave segura de que o Face ID precisa: entre com a senha.' / 'O pacote do portal mudou: entre uma vez com a senha e ative de novo.'

**Testes:** testes/passkey.test.mjs (PRF falso de 32 bytes no Node): envelope ida e volta; PRF errado não abre; AAD de outra credencial não abre; revogado → 410 e a tela volta para a senha; o servidor não guarda nada em claro; com a chave do envelope o diário assina e grava, e o evento passa na conferência dos outros navegadores. testes/servidor.test.mjs: POST sem token 401, onlyIfNew, 410 depois de revogar, GET sem token permitido. Arnês em http://localhost (WebAuthn não aceita IP): autenticador virtual do Chromium pela CDP (hasPrf e verificação de usuário) — entrar com senha → ativar → sair → entrar com Face ID → lançar; fotos da entrada com o botão e do convite nos 4 cortes; 0 erro de script/CSP.

**Pronto quando:** No arnês com autenticador virtual, o ciclo ativar → sair → entrar com Face ID → lançar funciona e o lançamento passa na conferência de assinatura; a senha continua funcionando; o botão não aparece sem PRF nem em origem não liberada; o Bauer confirma no iPhone dele.

**Riscos:** PRF depende do aparelho (a senha fica sempre); o envelope guarda a chave mestra, a do diário e a de assinatura; passkey presa ao RP ID (recadastro ao mudar de endereço); revogar com o token comum deixa qualquer sócia revogar a passkey de outra (só incomoda, não vaza); o autenticador virtual pode não ter PRF (então o fluxo completo fica para o iPhone e o Node cobre a lógica); só vale com o servidor publicado.
