"use strict";

// Produtos (22/10/2026, pedido do Criador): o painel lateral direito "Produtos", espelho do menu da esquerda, e a página
// de cada produto — o que é, o modelo (gratuito, pago, em construção), a maquete numa moldura isolada e, quando há, o
// app funcionando. Script clássico, carregado entre o paginas.js e o app.js: registra as páginas em tempo de execução
// (window.financeRegistrarPagina, grupo Empresa, depois do Portfólio) e o app.js cria a seção, o botão da gaveta e a
// rota (#ai-swarm, #ai-chat, #calculadora-obstetrica, #calculadora-rcog, #orquestrator). As maquetes moram em produtos/
// (arquivos comuns do site, públicos, só com dados fictícios) e abrem como blob: nesta aba, numa moldura isolada
// (sandbox só com scripts), do mesmo jeito que as páginas da galeria. O Med Painel continua com a página que já tinha.
(() => {
  const PRODUTOS = [
    {chave: "aiswarm", rota: "ai-swarm", titulo: "AI Swarm", eyebrow: "Produto · a frota de IAs trabalhando", estado: "em construção",
      descricao: "A frota de IAs trabalhando ao mesmo tempo, vista de um painel só.",
      ajuda: {oque: "A maquete do painel azul que acompanha a frota: quantos enxames, quantas IAs, quem entregou, quem está em curso e quem falhou.",
        deonde: "Do painel do AI Swarm, repetindo em laço um enxame real de 22/10/2026 capturado do próprio servidor.",
        naoe: "Nenhuma IA real está trabalhando aqui: a maquete repete o que já aconteceu, e nada do que ela mostra pode ser parado ou redisparado."},
      texto: "Quando várias IAs trabalham ao mesmo tempo, o AI Swarm mostra a frota inteira num painel: cada enxame, cada IA com a sua cor, o que está em curso, o que foi entregue e o que falhou. Esta maquete repete em laço um enxame real de 22/10/2026 (quatro IAs escrevendo fichas de vitaminas); clique no nome de uma IA para ver o contrato, as etapas e o terminal dela.",
      modelo: ["Modelo ainda não decidido: se será gratuito ou se terá um componente pago.", "Nome novo: AI Swarm (era ia-swarm).", "Em construção."],
      maquete: "produto-ai-swarm.html", dica: "A frota anda sozinha. Clique no nome de uma IA para abrir o mini painel dela; os botões no alto filtram em curso, falhas e entregues.",
      app: null, nota: "Ainda sem página publicada: por enquanto, só a maquete."},
    {chave: "aichat", rota: "ai-chat", titulo: "AI Chat", eyebrow: "Produto · as IAs conversando numa sala só", estado: "em construção",
      descricao: "As IAs conversando entre si numa sala só, com você no comando.",
      ajuda: {oque: "A maquete do AI Chat: a sala onde Claude, Codex, Kimi, Grok e Qwen trocam mensagens, com os comandos de barra do dono, o enxame e a telemetria de cada IA.",
        deonde: "Da interface real do app, aberta no modo de cópia congelada, com uma conversa fictícia; o enxame da aba “enxame” é real, de 22/10/2026.",
        naoe: "Nada é enviado: o botão de envio fica desligado e nenhuma IA recebe mensagem."},
      texto: "A sala onde as IAs conversam entre si: cada mensagem diz quem fala e para quem, a sala avisa só quem foi chamado, e o dono comanda com os comandos de barra. Nesta maquete, Claude, Codex, Kimi, Grok e Qwen montam juntos uma página.",
      modelo: ["Hoje: a sala, sem modelo de cobrança definido.", "Depois: uma versão paga com mais funções na mesma sala, como o AI Painel, os navegadores e os terminais.", "Em construção."],
      maquete: "produto-ai-chat.html", dica: "Role a conversa para cima para ver o começo. Clique em “/ comandos”, embaixo, para ver os comandos de barra. As abas “enxame” e “groupchat”, no alto, mostram a frota trabalhando (um enxame real de 22/10, em laço: clique no nome de uma IA) e a telemetria de cada IA.",
      app: null, nota: "Ainda sem página publicada: por enquanto, só a maquete."},
    {chave: "obstetrica", rota: "calculadora-obstetrica", titulo: "Calculadora obstétrica", eyebrow: "Produto · app de iPhone", estado: "a caminho da App Store",
      descricao: "Idade gestacional e DPP pela DUM, pelo ultrassom ou comparando os dois.",
      ajuda: {oque: "A recriação, em página, da tela do app de iPhone: escolha DUM, USG ou Comparar e veja a idade gestacional, a DPP e o texto para o prontuário.",
        deonde: "Das cores e dos textos do próprio app (CalculatorView); a conta é a mesma regra: DPP = DUM + 280 dias.",
        naoe: "Não é o app instalado nem orientação clínica; os campos já vêm com dados fictícios."},
      texto: "A calculadora do iPhone, recriada aqui em página, inteira e sem rolar: idade gestacional e DPP pela DUM, pelo ultrassom ou comparando os dois, e o texto pronto para o prontuário. Mude a data ou as semanas e veja a conta refazer.",
      modelo: ["Pagamento único pela Apple (R$ 6,90), decisão de 11/10/2026.", "Quem não compra usa com anúncios; a compra tira os anúncios.", "Inscrição no Apple Developer como empresa ainda pendente."],
      maquete: "produto-calc-obstetrica.html", telefone: true, dica: "Funciona aqui dentro, numa moldura isolada, com dados fictícios.",
      app: null, nota: "App de iPhone a caminho da App Store: a maquete recria a tela dele."},
    {chave: "rcog", rota: "calculadora-rcog", titulo: "Calculadora RCOG · TEV", eyebrow: "Produto · no ar no GitHub", estado: "no ar",
      descricao: "O escore de risco de tromboembolismo venoso na gestação e no puerpério.",
      ajuda: {oque: "A calculadora do escore do RCOG para TEV, a mesma que está no ar no GitHub, dentro de um iPhone desenhado.",
        deonde: "Da página publicada em bauerfilho.github.io/score-tev-rcog, copiada para a maquete.",
        naoe: "É ferramenta educacional: não substitui a avaliação clínica nem a diretriz completa."},
      texto: "O escore do RCOG para tromboembolismo venoso na gestação e no puerpério, a calculadora publicada rodando dentro de um iPhone: marque os fatores de risco e o escore soma sozinho.",
      modelo: ["No iPhone: pagamento único pela Apple (R$ 5,90), decisão de 11/10/2026, com anúncios para quem não compra.", "A página publicada hoje continua aberta."],
      maquete: "produto-rcog-tev.html", telefone: true, dica: "A lista de fatores rola dentro do telefone.",
      app: {url: "https://bauerfilho.github.io/score-tev-rcog/", rotulo: "Abrir a calculadora funcionando"}},
    {chave: "specialist", rota: "specialist-ai", titulo: "Specialist AI", eyebrow: "Produto · a especialista de bolso", estado: "em construção",
      descricao: "Especialistas pequenas que respondem lendo a biblioteca oficial brasileira — com a fonte, a página e as figuras do manual.",
      ajuda: {oque: "A maquete do Specialist AI (tela escura) com três respostas reais do app, a versão no iPhone e o projeto: como ficam as respostas e as figuras, a velocidade das IAs pequenas, o celular, os planos, de onde vêm as fontes e a previsão de custos e ganhos.",
        deonde: "Da tela real do app, do histórico real de outubro de 2026 (364 respostas com o tempo medido) e da biblioteca de 47 fontes oficiais; as figuras vêm do Manual de Gestação de Alto Risco (Ministério da Saúde, 2022).",
        naoe: "Não é o produto final: a maquete responde só às três perguntas preparadas, e preço, plano e ganhos são hipóteses para conversar, não decisão."},
      texto: "Uma especialista que cabe no bolso. IAs pequenas — 2 e 4 bilhões de parâmetros — que rodam na sua própria máquina, sem mandar nada para fora, e respondem como um colega de serviço: lendo a biblioteca oficial brasileira, citando a fonte e a página e trazendo as figuras do próprio manual. A pergunta vai para a especialista certa (são 19, de obstetrícia e ginecologia), ela abre só a gaveta que interessa, ficha os trechos literais, escreve e confere cada frase com a fonte. O que a fonte não traz, ela diz que não traz.",
      modelo: ["Em construção: o app roda no Mac do Criador; a maquete mostra a tela real com três respostas reais de outubro de 2026.",
        "Modelo de venda ainda não decidido: a seção de custos e ganhos traz as hipóteses para a conversa.", "Só no modo escuro, por decisão do Criador."],
      maquete: "produto-specialist-ai.html", telaCheia: true, statusMaquete: "Maquete escura · três respostas reais do app · nenhuma operação real",
      dica: "Toque numa conversa à esquerda, ou escreva uma das três perguntas preparadas — descolamento prematuro de placenta · placenta prévia · gravidez ectópica com metotrexato — e veja a resposta chegar em streaming, com as figuras da fonte. Clique no chip 📚 para ler o que ela leu.",
      app: null, nota: "Não é o produto final: por enquanto, a maquete e o projeto.",
      secoes: [
        {titulo: "Em números", numeros: [
          {valor: "47", rotulo: "fontes oficiais na biblioteca", nota: "Ministério da Saúde, FEBRASGO, INCA, OMS/OPAS, ISUOG, AMB e RS · 30 delas de 2024–2026"},
          {valor: "19", rotulo: "especialistas, uma por tema", nota: "10 de obstetrícia e 9 de ginecologia; o roteador acerta o tema em 82% das perguntas (95% entre as duas primeiras)"},
          {valor: "882", rotulo: "figuras recortadas das fontes", nota: "quadros, tabelas e fluxogramas, cada um com legenda e página, anexados à resposta"},
          {valor: "10 s", rotulo: "resposta da 2B no Mac", nota: "mediana de 18 respostas; no modo do app, com conferência frase a frase, 43 s (298 respostas)"}]},
        {tipo: "maquete"},
        {titulo: "Como ficam as respostas e as figuras", texto: "Fotos tiradas da própria maquete, com respostas reais do app gravadas em 9 e 10 de outubro de 2026.",
          fotos: [
            {src: "specialist-ai/resposta-inicio.jpg", legenda: {rotulo: "A resposta inteira.", texto: "Uma doença vem no molde: fisiopatologia → sintomas → diagnóstico (com o passo a passo) → tratamento (geral, clínico, cirúrgico) → acompanhamento → controle → complicações. Tabela, lista e fluxograma são desenhados pela tela."}},
            {src: "specialist-ai/resposta.jpg", legenda: {rotulo: "Debaixo da resposta, as figuras.", texto: "Quadros e fluxogramas recortados do manual, com legenda e página; toque amplia. Os chips dizem quem respondeu, o tema e a fonte."}},
            {src: "specialist-ai/figuras.jpg", legenda: {rotulo: "Os chips.", texto: "📑 trechos literais da fonte, conferidos por código · ✔ cada frase conferida com a fonte · 📚 fonte, capítulo e página — o ponto fica âmbar quando a resposta traz um número que não está na fonte."}},
            {src: "specialist-ai/cola.jpg", legenda: {rotulo: "O que ela leu.", texto: "Um toque no chip 📚 abre o texto literal que a IA recebeu antes de responder: o manual, o capítulo, a página. Sem caixa preta."}},
            {src: "specialist-ai/streaming.jpg", legenda: {rotulo: "Enquanto responde.", texto: "O roteador escolhe a especialista e diz a confiança; a fonte é fichada; a resposta chega em streaming e, no fim, passa pela conferência."}}],
          lista: [
            {rotulo: "Quando a fonte não traz, ela diz.", texto: "Em vez de inventar um número, uma dose ou um prazo, a resposta escreve “a fonte não traz” — e o rodapé lista qualquer número que apareça fora da fonte."},
            {rotulo: "Continuação curta fica com a mesma especialista.", texto: "“E a conduta?” segue na conversa, com os últimos turnos como contexto."},
            {rotulo: "Sem microfone e sem “não sou médico”.", texto: "Decisões do Criador: a tela é de trabalho, para quem já sabe o que está perguntando."}]},
        {tipo: "celular", titulo: "No celular", maquete: "produto-specialist-ai-celular.html",
          texto: ["O sentido das IAs pequenas é caber num aparelho pequeno. A tela já é a do celular: a conversa ocupa a tela inteira, as figuras ficam em duas colunas, os cartões por dia entram pelo menu ☰, o “o que ela leu” abre inteiro.",
            "Hoje o app roda no Mac e o iPhone entra como cliente, pela rede da casa (Tailscale ou Wi-Fi), com senha de link: a mesma tela, o mesmo histórico. É assim que ele é usado na maternidade."],
          lista: [
            {rotulo: "O passo seguinte é a 2B dentro do iPhone", texto: "(MLX Swift, no chip do próprio aparelho): sem rede, sem custo por resposta, a biblioteca junto. O peso que cabe: o modelo 2B em 4 bits ocupa 1,6 GB em disco; a biblioteca recortada, com texto e as 882 figuras, 279 MB."},
            {rotulo: "A medida que ainda falta:", texto: "a velocidade no aparelho. No Mac, a 2B responde em cerca de 10 s; no iPhone será medida quando rodar lá — nada aqui é promessa."},
            {rotulo: "O que já é certo no celular:", texto: "nenhum dado sai do aparelho e a resposta não depende de assinatura de IA de terceiros."}]},
        {titulo: "A velocidade das IAs pequenas", texto: "Medido no histórico real do app em outubro de 2026 — 364 respostas, num Mac com Apple Silicon. “Pequena” aqui é 2 ou 4 bilhões de parâmetros, em 4 bits: a 2B ocupa 1,6 GB em disco e a 4B, 2,9 GB; as 16 especialistas com o roteador cabem em 2,3 GB de memória e carregam em 2,4 s.",
          tabela: {cabecalho: ["Quem responde", "Respostas medidas", "Tempo (mediana)", "Metade das respostas entre", "Tamanho da resposta", "Caracteres por segundo"],
            linhas: [["2B sozinha — uma especialista, sem conferência", "18", "9,8 s", "4,6 e 10,8 s", "~1.700 caracteres", "154"],
              ["2B escrevendo + 4B conferindo frase a frase — o modo do app", "298", "43 s", "26 e 81 s", "~4.200 caracteres", "88"],
              ["4B leitora — lê a cola inteira: rascunho → conferência → revisão", "36", "52 s", "10 e 114 s", "~4.800 caracteres", "54"]]},
          lista: [
            {rotulo: "De onde vem a velocidade:", texto: "o modelo é pequeno, roda no aparelho e lê só a gaveta pedida — não a fonte inteira."},
            {rotulo: "O preço da pequena:", texto: "a 2B lê bem até ~3,5 mil tokens de cola de uma vez; acima disso encurta ou repete. Por isso a casca corta a fonte por seção e tópico e manda só o pedido. A 4B pura leu uma cola de 8 mil tokens e escreveu 8 mil caracteres em 73 s, sem repetir."},
            {rotulo: "Resposta bem feita vale mais que rápida", texto: "(regra do Criador): o modo do app gasta 43 s porque confere cada frase com a fonte antes de entregar."}]},
        {titulo: "A ideia e os planos", texto: ["A ideia cabe numa frase da Carta de Ensino da casa: fato na fonte, método na IA. A IA pequena não decora medicina — ela aprende o ofício de achar a gaveta certa, ler, citar e dizer “não consta” quando não há. O conhecimento fica na estante: fontes oficiais, recortadas e organizadas. Medimos o contrário também: treinar fatos no peso tirava o que a base já sabia.",
            "A estante cresce área por área até a Professora alcançar toda a informação de medicina necessária para ensinar um aluno — e o aluno, aqui, é também o Criador, no internato."],
          passos: [
            {estado: "feito", rotulo: "Biblioteca de 47 fontes oficiais", texto: "recortada por seção e tópico, com índice doença → especialista, sinônimos e abreviações (DPP, HPP, DMG, PE, RPMO, SUA, SOP…), e 882 figuras recortadas."},
            {estado: "feito", rotulo: "Roteador de 19 temas", texto: "(top-1 82%, top-2 95%), chips de fonte com página, fichamento literal conferido por código e conferência frase a frase (rascunho → auditoria → revisão)."},
            {estado: "feito", rotulo: "App no Mac e tela no iPhone pela rede", texto: "com histórico por dia, busca e “o que ela leu”."},
            {estado: "agora", rotulo: "O bulário do Med Painel vira a camada de remédios", texto: "da mesma estante: 1.111 famílias de medicamentos com bula profissional (22/10/2026), com a fonte embaixo de cada gaveta — trabalhar no Med Painel é trabalhar no Specialist AI."},
            {estado: "depois", rotulo: "Pesquisa inteligente", texto: "tudo em texto simples (.md), uma busca só, com as doenças em cima e os medicamentos embaixo; a IA pede a gaveta (“losartana#posologia”) em vez de ler o arquivo inteiro."},
            {estado: "depois", rotulo: "Papéis para as 2B", texto: "roteadora → buscadora (arquivos primeiro, web depois) → leitora confere a cobertura → professora escreve → anexadora de figuras; modos leve (2B), médio (4B) e intenso."},
            {estado: "depois", rotulo: "A 2B dentro do iPhone", texto: "(MLX Swift), sem rede e sem custo por resposta."},
            {estado: "depois", rotulo: "Mais áreas na estante", texto: "obstetrícia e ginecologia agora; pediatria em seguida; depois as demais — sempre fontes oficiais brasileiras atuais, cada frase com a fonte embaixo."}],
          nota: "O nome “ultra” está guardado: volta quando houver uma especialista de verdade — palavras do Criador."},
        {titulo: "Confiabilidade: de onde vem cada frase", texto: "Nenhuma frase sai da memória do modelo. A biblioteca é feita só de fontes oficiais e gratuitas, baixadas dos sites dos próprios órgãos; cada uma é recortada por seção e guardada em gavetas — o mesmo esquema de organização do bulário do Med Painel — e cada gaveta carrega a fonte e a página.",
          tabela: {cabecalho: ["Órgão", "Fontes", "Anos", "Exemplos"],
            linhas: [["Ministério da Saúde", "9", "2012–2025", "Manual de Gestação de Alto Risco (2022); PCDT de IST (2022) e de transmissão vertical (2022); Caderno de Atenção Básica 32, pré-natal (2012); Saúde das Mulheres (2016); Parto normal (2017); implante de etonogestrel (manual e nota técnica 419, 2025); nota técnica 626, mamografia (2025)"],
              ["FEBRASGO / Femina", "30", "2020–2026", "protocolos: sangramento uterino anormal (2026), SOP (2025), hemorragia pós-parto (2020 e 2025), prolapso (2025 e 2026), endometriose (2020 e 2026), sífilis na gravidez (2024), imunizações na gravidez (2025), toxoplasmose (2026), embolia amniótica (2026)…"],
              ["INCA", "3", "2015–2025", "rastreamento do câncer do colo do útero (2016 e 2025) e de mama (2015)"],
              ["OMS / OPAS", "2", "2018–2025", "hemorragia pós-parto (OMS 2025, em português) e hemorragia obstétrica (OPAS 2018)"],
              ["ISUOG · AMB · RS", "3", "2020–2024", "ultrassom de 11–14 semanas (ISUOG 2023); ultrassom do 1.º trimestre (AMB 2020); pré-natal na atenção primária (RS 2024)"]]},
          lista: [
            {rotulo: "A mais nova primeiro.", texto: "Documento com mais de cinco anos só entra com prova de que segue vigente (“2017 é pré-histórico”). A resposta cita o documento por nome e ano — nunca número de norma de memória."},
            {rotulo: "Nada pirata.", texto: "O Tratado da FEBRASGO, que é pago, só entra com exemplar legítimo; as cópias “grátis” da web ficaram de fora."},
            {rotulo: "As gavetas.", texto: "Para doenças: conceito, fisiopatologia, quadro clínico, diagnóstico, tratamento, acompanhamento, complicações, prevenção. Para remédios, no bulário do Med Painel: apresentação, mecanismo, indicações, posologia, cuidados, interações, efeitos, meia-vida, gestação, contraindicações — e o que a bula não traz vem de fonte confiável, só o que falta, com a fonte embaixo."},
            {rotulo: "Conferência em três camadas.", texto: "📑 os trechos que a IA usa são conferidos por código contra a fonte; ✔ cada frase da resposta passa pela conferência (o que a fonte não sustenta é removido e o chip conta os ajustes); 🟡 número fora da fonte acende o ponto âmbar e aparece no rodapé."},
            {rotulo: "Sem caixa preta.", texto: "“O que ela leu” abre o texto literal da fonte; e o histórico guarda, em cada resposta, a cola inteira, a cartinha usada e os números fora da fonte — nunca se apaga."}],
          nota: "As figuras e os trechos desta maquete vêm do Manual de Gestação de Alto Risco — Ministério da Saúde, Brasília, 2022 — licença Creative Commons BY-NC-SA 4.0 (“é permitida a reprodução parcial ou total desta obra, desde que citada a fonte”)."},
        {titulo: "Previsão de custos e possibilidade de ganhos", texto: "Os custos abaixo foram medidos ou são públicos; os ganhos são cenários, não previsão de vendas. Preço, plano e canal são decisão do Criador.",
          tabela: {legenda: "Custos — o que já medimos e o que é público",
            cabecalho: ["Item", "Quanto", "De onde vem o número"],
            linhas: [["Uma resposta no app", "R$ 0 de API", "roda no Mac ou no celular; nenhuma chamada a serviço de fora (só energia)"],
              ["Uma rodada de treino na nuvem (A100)", "≈ US$ 5", "medido em 08/10/2026: US$ 4,86"],
              ["Uma noite de treino com 24 versões", "US$ 9,46", "medido em 07–08/10/2026"],
              ["Material de treino escrito por IA grande (Kimi K3)", "≈ US$ 0,14 por tarefa", "medido em 09/10/2026 nos registros das autoras"],
              ["Biblioteca", "R$ 0 de licença", "fontes oficiais gratuitas; o custo é a curadoria (horas) — o recorte é por código"],
              ["Vender no iPhone", "US$ 99/ano + 15% por venda", "Apple Developer Program; taxa do Small Business Program (até US$ 1 milhão/ano)"],
              ["Servir a biblioteca para o app baixar", "≈ R$ 0–50/mês", "arquivos estáticos (GitHub Pages ou CDN) — estimativa"]]},
          tabela2: {legenda: "Cenários de ganho — hipóteses a R$ 59,90/mês, já descontados os 15% da Apple",
            cabecalho: ["Assinantes", "Receita bruta/mês", "Líquido da loja/mês", "Custo marginal"],
            linhas: [["100", "R$ 5.990", "R$ 5.092", "≈ R$ 0 (roda no aparelho)"], ["1.000", "R$ 59.900", "R$ 50.915", "≈ R$ 0"], ["10.000", "R$ 599.000", "R$ 509.150", "≈ R$ 0"]]},
          lista: [
            {rotulo: "Por que R$ 59,90:", texto: "é o que o líder (Whitebook Premium) cobra por mês; a regra da casa é não cobrar menos que o líder — e, antes, entregar algo à altura. Plano de estudante, anual ou por turma é decisão a tomar."},
            {rotulo: "Onde está o custo de verdade:", texto: "fazer a estante crescer e conferir — horas de curadoria e noites de treino de menos de US$ 10. A margem por assinante fica quase inteira, porque a resposta roda no aparelho."},
            {rotulo: "Caminhos possíveis:", texto: "assinatura individual (residentes, internos, estudantes); plano para turmas e faculdades; pacote com o Med Painel, que já divide a estante."}],
          nota: "Fonte do preço do líder: lp.whitebook.com.br/premium, conferido em 17/10/2026 (R$ 59,90/mês no site). A taxa de 15% vale para quem está no Small Business Program da Apple; fora dele, 30%."}
      ]},
    {chave: "orquestrator", rota: "orquestrator", titulo: "Orquestrator", eyebrow: "Produto · o app da casa", estado: "em construção",
      descricao: "O app que reúne as IAs numa mesa só: conversa, enxame, navegadores, terminais e a central de comunicação.",
      ajuda: {oque: "A maquete do app Orquestrator: a sala das IAs, o enxame, o navegador, o terminal, o mini dock e a COMUNICATION, com dados fictícios.",
        deonde: "Da interface real do app (a sala, o Golden Dock e a COMUNICATION) montada numa página só, sem servidor; o enxame repete uma captura real de 22/10/2026.",
        naoe: "Não é o produto final: nada é enviado, nenhuma IA responde, o navegador só abre um Google e um YouTube de mentira e o terminal é simulado."},
      texto: "O app da casa: a mesa onde as IAs conversam, trabalham em enxame e usam navegadores e terminais, com a pessoa no comando. A maquete é a interface real do app com dados fictícios: troque de janela no alto (sala, enxame, painel, groupchat, navegador, terminal, comunication) e abra o mini dock, a pílula dourada no pé da tela.",
      modelo: ["Em construção: não é o produto final.", "COMUNICATION (e-mail, mensagens, agenda, ligações e notas numa central só): em produção — dá para ver o que já existe, com dados fictícios.",
        "Em discussão: se o app vai levar o nome da casa, Orquestrator.", "Modelo de venda ainda não decidido."],
      maquete: "produto-orquestrator.html", telaCheia: true,
      dica: "No navegador há um Google e um YouTube de mentira: digite youtube.com ou qualquer pesquisa na barra. O mini dock (a pílula dourada no pé) abre chat, navegador e terminal. Para ver com folga, abra em tela cheia.",
      app: null, nota: "Não é o produto final: por enquanto, a maquete."},
  ];
  const ORDEM_PAINEL = [{chave: "medpainel", sigla: "MP", nome: "Med Painel", linha: "O painel lateral do médico · plano de venda"},
    {chave: "aiswarm", sigla: "AS", nome: "AI Swarm", linha: "A frota de IAs trabalhando, ao vivo"},
    {chave: "aichat", sigla: "AC", nome: "AI Chat", linha: "As IAs conversando numa sala só"},
    {chave: "obstetrica", sigla: "OB", nome: "Calculadora obstétrica", linha: "IG e DPP pela DUM e pelo ultrassom"},
    {chave: "rcog", sigla: "TEV", nome: "Calculadora RCOG", linha: "Risco de TEV na gestação e no puerpério"},
    {chave: "specialist", sigla: "SA", nome: "Specialist AI", linha: "A especialista de bolso · em construção"},
    {chave: "orquestrator", sigla: "OR", nome: "Orquestrator", linha: "O app da casa · em construção"}];
  const porChave = Object.fromEntries(PRODUTOS.map((p) => [p.chave, p]));
  const el = (tag, cls, texto) => { const node = document.createElement(tag); if (cls) node.className = cls; if (texto !== undefined) node.textContent = texto; return node; };
  const tema = () => document.documentElement.getAttribute("data-tema") === "escuro" ? "escuro" : "claro";

  // ── as páginas, registradas em tempo de execução (o app.js processa a fila ao iniciar) ─────────────────────────
  let anterior = "portfolio";
  for (const p of PRODUTOS) {
    try {
      window.financeRegistrarPagina({chave: p.chave, rota: p.rota, grupo: "Empresa", titulo: p.titulo, descricao: p.descricao, ajuda: p.ajuda, eyebrow: p.eyebrow, depoisDe: anterior});
      anterior = p.chave;
    } catch (erro) { console.error(erro); }
  }

  // ── a maquete: o arquivo em produtos/ vira blob: nesta aba (a moldura herda a CSP do portal); #tema= acompanha o tema ──
  const bases = new Map();
  async function baseDaMaquete(arquivo) {
    if (!bases.has(arquivo)) {
      bases.set(arquivo, (async () => {
        const resposta = await fetch(new URL("produtos/" + arquivo, document.baseURI), {cache: "no-store"});
        if (!resposta.ok) throw new Error("A maquete não está publicada neste site (" + resposta.status + ").");
        const html = await resposta.text();
        return URL.createObjectURL(new Blob([html], {type: "text/html"}));
      })().catch((erro) => { bases.delete(arquivo); throw erro; }));
    }
    return bases.get(arquivo);
  }
  function secao(titulo, descricao) {
    const s = el("section", "mp-secao");
    s.append(el("h3", "mp-secao-titulo", titulo));
    if (descricao) s.append(el("p", "mp-secao-texto", descricao));
    return s;
  }
  // ── as seções ricas da página de produto (o Specialist AI foi o primeiro): números, fotos, celular ao lado do texto,
  //    tabelas, planos com estado e notas — tudo construído por DOM, texto por textContent ───────────────────────────
  function paragrafos(texto, cls) { const frag = document.createDocumentFragment(); (Array.isArray(texto) ? texto : [texto]).filter(Boolean).forEach((t) => frag.append(el("p", cls || "mp-secao-texto", t))); return frag; }
  function forte(no, item) { // {rotulo, texto} vira "<b>rotulo</b> texto"; string vira texto
    if (typeof item === "string") { no.textContent = item; return no; }
    if (item.rotulo) { no.append(el("b", "", item.rotulo), document.createTextNode(item.texto ? " " + item.texto : "")); } else no.textContent = item.texto || "";
    return no;
  }
  function listaDe(itens) { const ul = el("ul", "product-lista"); itens.forEach((i) => ul.append(forte(el("li"), i))); return ul; }
  function numerosDe(itens) {
    const grade = el("div", "product-numeros");
    itens.forEach((n) => { const c = el("div", "product-numero"); c.append(el("p", "product-numero-valor", n.valor), el("p", "product-numero-rotulo", n.rotulo)); if (n.nota) c.append(el("p", "product-numero-nota", n.nota)); grade.append(c); });
    return grade;
  }
  function tabelaDe(t) {
    const caixa = el("div", "table-scroll product-tabela"), tabela = el("table"), cabeca = el("thead"), tr = el("tr");
    t.cabecalho.forEach((h) => tr.append(el("th", "", h))); cabeca.append(tr); tabela.append(cabeca);
    const corpo = el("tbody");
    t.linhas.forEach((linha) => { const r = el("tr"); linha.forEach((c) => r.append(el("td", "", c))); corpo.append(r); });
    tabela.append(corpo); if (t.legenda) { const cap = el("caption", "", t.legenda); tabela.prepend(cap); }
    caixa.append(tabela); return caixa;
  }
  function fotosDe(itens) {
    const grade = el("div", "product-fotos");
    itens.forEach((f) => {
      const fig = el("figure", "product-foto"), a = el("a"), img = el("img");
      a.href = new URL("produtos/" + f.src, document.baseURI).href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = "Abrir a foto em tamanho cheio";
      img.src = a.href; img.alt = f.alt || f.legenda; img.loading = "lazy"; img.decoding = "async";
      a.append(img); fig.append(a); fig.append(forte(el("figcaption"), f.legenda)); grade.append(fig);
    });
    return grade;
  }
  function passosDe(itens) {
    const ol = el("ol", "product-passos");
    itens.forEach((p) => { const li = el("li", "product-passo"); const e = el("span", "product-passo-estado", p.estado); e.dataset.estado = p.estado; li.append(e, forte(el("p"), p)); ol.append(li); });
    return ol;
  }
  function montaSecao(s) {
    const sec = secao(s.titulo, null);
    if (s.texto) sec.append(paragrafos(s.texto));
    if (s.numeros) sec.append(numerosDe(s.numeros));
    if (s.fotos) sec.append(fotosDe(s.fotos));
    if (s.tabela) sec.append(tabelaDe(s.tabela));
    if (s.lista) sec.append(listaDe(s.lista));
    if (s.passos) sec.append(passosDe(s.passos));
    if (s.tabela2) sec.append(tabelaDe(s.tabela2));
    if (s.texto2) sec.append(paragrafos(s.texto2));
    if (s.nota) sec.append(paragrafos(s.nota, "product-nota"));
    return sec;
  }
  async function molduraDe(p, arquivo, telefone, rotulo) {
    const base = await baseDaMaquete(arquivo);
    const moldura = el("iframe", "product-frame" + (telefone ? " product-frame--telefone" : ""));
    moldura.setAttribute("sandbox", "allow-scripts"); moldura.setAttribute("referrerpolicy", "no-referrer");
    moldura.title = rotulo || (p.titulo + ", maquete"); moldura.dataset.base = base; moldura.src = base + "#tema=" + tema();
    return moldura;
  }
  async function montaMaquete(p) {
    const mesa = secao("Veja a maquete", p.dica || "Funciona aqui dentro, numa moldura isolada, com dados fictícios.");
    if (p.telaCheia) {
      // a maquete sozinha, numa aba nova, ocupando a tela inteira (o arquivo é o mesmo de produtos/, com o tema do portal)
      const fora = el("p", "product-actions");
      const a = el("a", "button button-primary", "Ver em tela cheia ↗");
      a.target = "_blank"; a.rel = "noopener noreferrer"; a.dataset.telaCheia = new URL("produtos/" + p.maquete, document.baseURI).href;
      a.href = a.dataset.telaCheia + "#tema=" + tema();
      fora.append(a, el("span", "mp-secao-texto", "Abre a maquete sozinha, numa aba nova, ocupando a tela inteira."));
      mesa.append(fora);
    }
    const aviso = el("p", "mp-secao-texto mp-mesa-aviso", "Abrindo a maquete…");
    mesa.append(aviso);
    try { aviso.replaceWith(await molduraDe(p, p.maquete, p.telefone)); }
    catch (erro) { aviso.textContent = erro && erro.message ? erro.message : "A maquete não veio neste site."; }
    return mesa;
  }
  async function montaCelular(p, s) {
    const sec = secao(s.titulo, null), colunas = el("div", "product-colunas"), lado = el("div", "product-coluna-texto");
    if (s.texto) lado.append(paragrafos(s.texto));
    if (s.lista) lado.append(listaDe(s.lista));
    if (s.nota) lado.append(paragrafos(s.nota, "product-nota"));
    const aviso = el("p", "mp-secao-texto mp-mesa-aviso", "Abrindo a maquete no telefone…");
    colunas.append(aviso, lado); sec.append(colunas);
    try { aviso.replaceWith(await molduraDe(p, s.maquete, true, p.titulo + " no iPhone, maquete")); }
    catch (erro) { aviso.textContent = erro && erro.message ? erro.message : "A maquete não veio neste site."; }
    return sec;
  }
  async function desenhar(chave) {
    const p = porChave[chave], alvo = document.getElementById(chave + "-content");
    if (!p || !alvo || alvo.dataset.montado === "1") return;
    alvo.dataset.montado = "1";
    alvo.className = "product-content";
    const cabecalho = alvo.parentElement && alvo.parentElement.querySelector(".section-heading");
    if (cabecalho && !cabecalho.querySelector(".source-status")) {
      const estado = el("div", "source-status");
      estado.append(el("p", "", p.maquete ? (p.statusMaquete || "Maquete com dados fictícios · nenhuma operação real") : "Sem maquete ainda"));
      cabecalho.append(estado);
    }
    const sobre = secao("O que é", p.texto);
    const acoes = el("p", "product-actions");
    if (p.app) {
      const a = el("a", "button button-primary", p.app.rotulo + " ↗");
      a.href = p.app.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      acoes.append(a, el("span", "mp-secao-texto", "Abre a página publicada no GitHub, numa aba nova."));
    } else acoes.append(el("span", "product-pending", p.nota));
    sobre.append(acoes);
    alvo.append(sobre);
    const modelo = secao("Modelo e caminho");
    const pilula = el("span", "product-estado", p.estado);
    pilula.dataset.estado = p.estado;
    const lista = el("ul", "product-modelo");
    p.modelo.forEach((linha) => lista.append(el("li", "", linha)));
    modelo.append(pilula, lista);
    if (!p.secoes) {
      alvo.append(modelo);
      if (p.maquete) alvo.append(await montaMaquete(p));
      return;
    }
    // página rica: as seções na ordem declarada (a maquete e o celular entram onde o produto pede); o modelo fecha
    for (const s of p.secoes) {
      if (s.tipo === "maquete") alvo.append(await montaMaquete(p));
      else if (s.tipo === "celular") alvo.append(await montaCelular(p, s));
      else alvo.append(montaSecao(s));
    }
    alvo.append(modelo);
  }
  // Só o produto aberto fica com a maquete viva: ao sair da página, a moldura é desmontada (o AI Swarm e o AI Chat
  // repetem o enxame em laço e gastariam CPU escondidos); ao voltar, redesenha a partir do blob: já guardado.
  function desmontar(chave) {
    const alvo = document.getElementById(chave + "-content");
    if (!alvo || alvo.dataset.montado !== "1") return;
    alvo.replaceChildren();
    delete alvo.dataset.montado;
  }
  document.addEventListener("financeiro:rota", (evento) => {
    const chave = evento.detail && evento.detail.pagina;
    PRODUTOS.forEach((p) => { if (p.chave !== chave) desmontar(p.chave); });
    if (porChave[chave]) desenhar(chave);
  });
  // Trocar só o #tema não recarrega a moldura: as maquetes que têm tema (AI Chat e Orquestrator) escutam a troca e
  // mudam na hora, sem perder o que estiver aberto. O link de tela cheia leva o tema atual.
  new MutationObserver(() => {
    document.querySelectorAll(".product-frame[data-base]").forEach((moldura) => { const url = moldura.dataset.base + "#tema=" + tema(); if (moldura.src !== url) moldura.src = url; });
    document.querySelectorAll("a[data-tela-cheia]").forEach((a) => { a.href = a.dataset.telaCheia + "#tema=" + tema(); });
  }).observe(document.documentElement, {attributes: true, attributeFilter: ["data-tema"]});

  // ── o painel lateral direito "Produtos" ─────────────────────────────────────────────────────────────────────────
  function montarPainel() {
    const acoes = document.querySelector("#app-header .header-actions"), ref = document.getElementById("change-password-button");
    if (!acoes || document.getElementById("products-button")) return;
    const botao = el("button", "button button-outline products-button");
    botao.id = "products-button"; botao.type = "button";
    botao.setAttribute("aria-haspopup", "dialog"); botao.setAttribute("aria-controls", "products-drawer"); botao.setAttribute("aria-expanded", "false"); botao.setAttribute("aria-label", "Produtos");
    const glifo = el("span", "products-button-glyph", "◫"); glifo.setAttribute("aria-hidden", "true");
    botao.append(glifo, el("span", "products-button-text", "Produtos"));
    acoes.insertBefore(botao, ref || acoes.firstChild);
    const painel = el("dialog", "navigation-drawer products-drawer");
    painel.id = "products-drawer"; painel.setAttribute("aria-labelledby", "products-title");
    const cabecalho = el("div", "drawer-heading"), bloco = el("div");
    const h2 = el("h2", "", "Produtos"); h2.id = "products-title";
    bloco.append(el("p", "eyebrow", "ORQUESTRATOR"), h2);
    const fechar = el("button", "icon-button"); fechar.id = "products-close"; fechar.type = "button"; fechar.setAttribute("aria-label", "Fechar produtos");
    const x = el("span", "", "×"); x.setAttribute("aria-hidden", "true"); fechar.append(x);
    cabecalho.append(bloco, fechar);
    const nav = el("nav", "drawer-nav products-nav"); nav.setAttribute("aria-label", "Produtos");
    for (const item of ORDEM_PAINEL) {
      const b = el("button"); b.type = "button"; b.dataset.navigate = item.chave;
      const marca = el("span", "product-mark", item.sigla); marca.setAttribute("aria-hidden", "true");
      const texto = el("span", "product-text"); texto.append(el("b", "", item.nome), el("small", "", item.linha));
      const seta = el("span", "nav-arrow", "↗"); seta.setAttribute("aria-hidden", "true");
      b.append(marca, texto, seta);
      nav.append(b);
    }
    const rodape = el("div", "drawer-footer"); rodape.append(el("p", "", "As maquetes usam dados fictícios. Nada aqui opera de verdade."));
    painel.append(cabecalho, el("p", "drawer-caption", "Cada produto com a maquete aqui dentro e, quando houver, o app funcionando."), nav, rodape);
    document.body.append(painel);
    let devolverFoco = null;
    const abrir = () => {
      if (!window.financeReady || document.getElementById("dashboard").hidden) return;
      devolverFoco = botao;
      if (!painel.open) painel.showModal();
      botao.setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("drawer-open");
      const atual = window.financePaginaAtiva ? window.financePaginaAtiva() : "";
      nav.querySelectorAll("[data-navigate]").forEach((b) => { if (b.dataset.navigate === atual) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
      (nav.querySelector('[aria-current="page"]') || fechar).focus();
    };
    const fecharPainel = (devolver = true) => {
      if (painel.open) painel.close();
      const esquerda = document.getElementById("navigation-drawer");
      if (!esquerda || !esquerda.open) document.documentElement.classList.remove("drawer-open");
      botao.setAttribute("aria-expanded", "false");
      if (devolver && devolverFoco && devolverFoco.isConnected) devolverFoco.focus({preventScroll: true});
    };
    botao.addEventListener("click", abrir);
    fechar.addEventListener("click", () => fecharPainel());
    painel.addEventListener("cancel", (evento) => { evento.preventDefault(); fecharPainel(); });
    painel.addEventListener("click", (evento) => {
      const caixa = painel.getBoundingClientRect();
      if (evento.target === painel && (evento.clientX < caixa.left || evento.clientX > caixa.right || evento.clientY < caixa.top || evento.clientY > caixa.bottom)) fecharPainel();
    });
    painel.addEventListener("keydown", (evento) => {
      if (evento.key !== "Tab") return;
      const controles = [...painel.querySelectorAll("button:not([disabled]),a[href]")].filter((n) => n.getClientRects().length);
      if (!controles.length) return;
      const primeiro = controles[0], ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    });
    document.addEventListener("financeiro:rota", () => fecharPainel(false));
    const painelDoApp = document.getElementById("dashboard");
    if (painelDoApp) new MutationObserver(() => { if (painelDoApp.hidden) fecharPainel(false); }).observe(painelDoApp, {attributes: true, attributeFilter: ["hidden"]});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarPainel); else montarPainel();
})();
