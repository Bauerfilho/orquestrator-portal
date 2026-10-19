// ESTADO FICTÍCIO do arnês de fotos (não é dado da empresa). Mesmo formato do estado canônico que domain.js valida
// (schemaVersion 1, dinheiro persistido em centavos inteiros). Valores plausíveis, nomes inventados.
// Blocos estáticos (staticBlocks.*) seguem o que app.js lê em cada página; valores ali são de exibição (não centavos),
// como no documento que o exportador copia. Chaves proibidas por sanitizePublic (path, root, cpf, senha...) ficam de fora.
const ATUALIZADO = '2026-10-18T20:30:00.000Z';
const fonte = (label, updated_at = ATUALIZADO) => ({exists: true, updated_at, stale: false, label});

const criterios = (a, b, c, d, e) => [
  {chave: 'proposito', nome: 'Propósito descrito', pontos: a, evidencia: 'README com público, problema e promessa.'},
  {chave: 'funcionamento', nome: 'Funcionamento documentado', pontos: b, evidencia: 'Roteiro de uso e capturas de tela.'},
  {chave: 'testes', nome: 'Testes registrados', pontos: c, evidencia: 'Suíte automática com resultado anexado.'},
  {chave: 'licenca', nome: 'Autoria e licença', pontos: d, evidencia: 'Licença e autoria declaradas no repositório.'},
  {chave: 'entrega', nome: 'Entrega empacotada', pontos: e, evidencia: 'Instalador ou endereço público de acesso.'},
];
const prontidao = (rotulo, pts, ajuste = 0, faltas = []) => {
  const auto = pts.reduce((s, v) => s + v, 0);
  return {rotulo, auto, ajuste, final: Math.max(0, Math.min(100, auto + ajuste)), criterios: criterios(...pts), faltas};
};

export const estadoFicticio = {
  schemaVersion: 1,
  revision: 42,
  updatedAt: ATUALIZADO,
  sourceInfo: {updatedAt: ATUALIZADO},
  members: [
    {id: 'm-bauer', displayName: 'Bauer', participationPct: 40, role: 'owner'},
    {id: 'm-ana', displayName: 'Ana Ribeiro', participationPct: 30, role: 'member'},
    {id: 'm-bia', displayName: 'Beatriz Lima', participationPct: 30, role: 'member'},
  ],
  // Assinaturas: período mensal com dia de vencimento deriva a próxima data; anual traz nextDate.
  plans: [
    {id: 'claude-max', servico: 'Claude', plano: 'Max 20x', amountMinor: 20000, currency: 'USD', period: 'mensal', monthlyDay: 22, status: 'a vencer', paymentStatus: 'a_vencer', subscriptionState: 'active', confirmed: true},
    {id: 'github-team', servico: 'GitHub', plano: 'Team · 3 assentos', amountMinor: 1200, currency: 'USD', period: 'mensal', monthlyDay: 5, status: 'pago', paymentStatus: 'pago', subscriptionState: 'active', confirmed: true},
    {id: 'vercel-pro', servico: 'Vercel', plano: 'Pro', amountMinor: 2000, currency: 'USD', period: 'mensal', nextDate: '2026-10-14', monthlyDay: 14, status: 'a pagar', paymentStatus: 'a_pagar', subscriptionState: 'active', confirmed: true},
    {id: 'dominio-br', servico: 'Registro.br', plano: 'Domínio orquestrator.com.br', amountMinor: 4000, currency: 'BRL', period: 'anual', nextDate: '2027-03-02', status: 'pago', paymentStatus: 'pago', subscriptionState: 'active', confirmed: true},
    {id: 'workspace', servico: 'Google Workspace', plano: 'Business Starter · 3 contas', amountMinor: 8400, currency: 'BRL', period: 'mensal', monthlyDay: 1, status: 'pago', paymentStatus: 'pago', subscriptionState: 'active', confirmed: true},
    {id: 'apple-dev', servico: 'Apple Developer', plano: 'Programa anual', amountMinor: 9900, currency: 'USD', period: 'anual', nextDate: '2027-05-10', status: 'pago', paymentStatus: 'pago', subscriptionState: 'active', confirmed: true},
    {id: 'anthropic-api', servico: 'Anthropic API', plano: 'Recarga mensal de créditos', amountMinor: 5000, currency: 'USD', period: 'mensal', monthlyDay: 25, status: 'a vencer', paymentStatus: 'a_vencer', subscriptionState: 'active', confirmed: true},
    {id: 'hotmart', servico: 'Hotmart', plano: 'Taxa por venda (9,9% + R$ 1,00)', amountMinor: null, currency: 'BRL', period: 'por venda', status: 'a confirmar', paymentStatus: '', subscriptionState: 'unconfirmed', confirmed: false},
    {id: 'figma', servico: 'Figma', plano: 'Professional', amountMinor: 1500, currency: 'USD', period: 'mensal', monthlyDay: 9, status: 'cancelado em setembro', paymentStatus: 'isento', subscriptionState: 'inactive', confirmed: true},
  ],
  charges: null,   // sem registro separado de cobranças: o painel mostra previsões a partir dos planos
  benefits: [
    {id: 'b-claude-extra', kind: 'credito_extra', subscriptionId: 'claude-max', service: 'Claude', environment: 'claude.ai e Claude Code', amountMinor: 10000, balanceMinor: 6420, currency: 'USD', observedAt: '2026-10-15', expiresOn: '2026-10-31', usageCondition: 'uso além do limite semanal do plano', confirmed: true, source: {label: 'Faturamento Anthropic'}},
    {id: 'b-vercel-edge', kind: 'bonus_recorrente', subscriptionId: 'vercel-pro', service: 'Vercel', environment: 'vercel.com', amountMinor: 2000, currency: 'USD', period: 'mensal', expiresMonth: '2026-10', confirmed: true, source: {label: 'Painel da Vercel'}},
    {id: 'b-api-saldo', kind: 'saldo_api', service: 'Anthropic API', environment: 'console.anthropic.com', balanceMinor: 3175, currency: 'USD', observedAt: '2026-10-18', expiresMonth: '2027-10', usageCondition: 'chamadas de API dos protótipos', confirmed: true, source: {label: 'Console Anthropic'}},
  ],
  selling: {
    text: 'Três frentes, nesta ordem.',
    columns: [], rows: [],
    steps: [
      {id: 's1', product: 'Med Painel', text: 'Fechar preço de lançamento (R$ 59,90/mês)', checked: true},
      {id: 's2', product: 'Med Painel', text: 'Publicar a página de vendas na Hotmart', checked: true},
      {id: 's3', product: 'Med Painel', text: 'Gravar o vídeo de demonstração de 90 segundos', checked: false},
      {id: 's4', product: 'Med Painel', text: 'Convidar 30 colegas para o piloto com cupom próprio', checked: false},
      {id: 's5', product: 'Bulário de bolso', text: 'Separar o bulário como app gratuito de entrada', checked: true},
      {id: 's6', product: 'Bulário de bolso', text: 'Revisar 50 fichas com fonte e data', checked: false},
      {id: 's7', product: 'Bulário de bolso', text: 'Publicar na App Store (conta Apple Developer)', checked: false},
      {id: 's8', product: 'Mentoria de prova', text: 'Validar interesse com 10 residentes', checked: false},
      {id: 's9', product: 'Mentoria de prova', text: 'Montar a primeira trilha de 4 semanas', checked: false},
    ],
  },
  staticBlocks: {
    cash: {
      text: '## Caixa de outubro\n\nSaldos conferidos no extrato em 17/10. Cartão PJ fecha dia 28. Gastos em dólar saem da conta global.',
      columns: ['Item', 'Situação'], rows: [{Item: 'Extrato PJ', Situação: 'conferido em 17/10'}, {Item: 'Fatura do cartão', Situação: 'fecha em 28/10'}],
      alerts: {source: fonte('ALERTAS.md'), text: 'Vercel: cobrança de 14/10 ainda em aberto.\nCréditos extras do Claude vencem em 31/10.', columns: [], rows: []},
      expenses_month: [
        {servico: 'Claude', valor: 200, moeda: 'USD', data: '2026-09-22', status: 'pago'},
        {servico: 'GitHub', valor: 12, moeda: 'USD', data: '2026-10-05', status: 'pago'},
        {servico: 'Google Workspace', valor: 84, moeda: 'BRL', data: '2026-10-01', status: 'pago'},
        {servico: 'Anthropic API (uso)', valor: 18.25, moeda: 'USD', data: '2026-10-17', status: 'parcial do mês'},
        {servico: 'Contador', valor: 450, moeda: 'BRL', data: '2026-10-10', status: 'pago'},
      ],
      balances: [
        {servico: 'Conta PJ', valor: 18450.32, moeda: 'BRL', data: '2026-10-17'},
        {servico: 'Conta global', valor: 612.4, moeda: 'USD', data: '2026-10-17'},
      ],
      forecast: [
        {servico: 'Vercel', valor: 20, moeda: 'USD', data: '2026-10-14', status: 'em aberto'},
        {servico: 'Claude', valor: 200, moeda: 'USD', data: '2026-10-22', status: 'a vencer'},
        {servico: 'Anthropic API', valor: 50, moeda: 'USD', data: '2026-10-25', status: 'a vencer'},
        {servico: 'Google Workspace', valor: 84, moeda: 'BRL', data: '2026-11-01', status: 'a vencer'},
      ],
      budget: [
        {servico: 'Claude Code · uso extra', consumo: 35.8, teto: 100, moeda: 'USD', percentual: 36},
        {servico: 'Anthropic API', consumo: 18.25, teto: 50, moeda: 'USD', percentual: 37},
        {servico: 'Total em dólar no mês', consumo: 412, teto: 400, moeda: 'USD', percentual: 103},
      ],
      records: [
        {source: fonte('CAIXA-2026-10.md'), columns: ['Data', 'Descrição', 'Valor', 'Moeda'], rows: [
          {Data: '01/10', Descrição: 'Google Workspace', Valor: '84,00', Moeda: 'BRL'},
          {Data: '05/10', Descrição: 'GitHub Team', Valor: '12,00', Moeda: 'USD'},
          {Data: '10/10', Descrição: 'Honorários do contador', Valor: '450,00', Moeda: 'BRL'},
        ], text: ''},
      ],
      sources: [fonte('CAIXA.md'), fonte('ALERTAS.md', '2026-10-17T21:10:00.000Z'), fonte('CAIXA-2026-10.md', '2026-10-17T21:12:00.000Z')],
      unclassified_expenses: [],
    },
    projection: {
      text: '## Notas\n\nPremissas revisadas em 12/10. Preço único de R$ 59,90; sem plano anual por enquanto.',
      scenarios: [
        {nome: 'Conservador', 'Assinantes no mês 12': '380', 'Receita do mês 12': 'R$ 22.762', 'Custo mensal': 'R$ 9.400', 'Margem': '41%', formula: 'assinantes × R$ 59,90 − taxas (4,69% + R$ 0,50) − impostos 6% − custo fixo'},
        {nome: 'Provável', 'Assinantes no mês 12': '1.150', 'Receita do mês 12': 'R$ 68.885', 'Custo mensal': 'R$ 21.300', 'Margem': '57%', formula: 'assinantes × R$ 59,90 − taxas − impostos − custo fixo − comissões'},
        {nome: 'Ambicioso', 'Assinantes no mês 12': '2.600', 'Receita do mês 12': 'R$ 155.740', 'Custo mensal': 'R$ 44.900', 'Margem': '62%', formula: 'assinantes × R$ 59,90 − taxas − impostos − custo fixo − comissões − verba'},
      ],
    },
    society: {text: 'Contrato social de 2025: três sócias, capital integralizado. Atualização de quotas registrada em 03/2026.'},
    inventory: {
      columns: ['Produto', 'Finalidade', 'Prontidão', 'Distância do dinheiro', 'Barreira'],
      rows: [
        {Produto: 'Med Painel', Finalidade: 'Painel clínico de consulta', Prontidão: '4/5', 'Distância do dinheiro': '1', Barreira: 'Piloto'},
        {Produto: 'Bulário de bolso', Finalidade: 'Consulta de bulas', Prontidão: '3/5', 'Distância do dinheiro': '2', Barreira: 'Revisão clínica'},
      ],
    },
    medpainel: {
      estrategias: {columns: ['Canal', 'Como funciona', 'O que custa', 'Como medir', 'Meta do canal'], rows: [
        {Canal: 'Indicação de colegas', 'Como funciona': 'Quem assina ganha um mês grátis por colega que assinar com o seu código.', 'O que custa': 'Um mês grátis por indicação', 'Como medir': 'Código de indicação', 'Meta do canal': '2% da base por mês'},
        {Canal: 'Promotores residentes', 'Como funciona': 'Residentes apresentam o painel na própria turma, com cupom.', 'O que custa': '20% por 12 meses', 'Como medir': 'Cupom por promotor', 'Meta do canal': '10 promotores, 3 assinaturas cada'},
        {Canal: 'Influenciadores médicos', 'Como funciona': 'Ações mensais com demonstração ao vivo.', 'O que custa': 'Comissão de 20% por 12 meses', 'Como medir': 'Link de afiliado Hotmart', 'Meta do canal': '2 ações por mês'},
        {Canal: 'Ecossistema Orquestrator', 'Como funciona': 'Convite dentro dos apps gratuitos (bulário, maquetes).', 'O que custa': 'Sem custo direto', 'Como medir': 'Origem do teste grátis', 'Meta do canal': '10% dos usuários convidados'},
        {Canal: 'Anúncio pago', 'Como funciona': 'Metade do resultado positivo vira verba do mês seguinte.', 'O que custa': 'CAC estimado de R$ 150', 'Como medir': 'UTM e pixel', 'Meta do canal': 'CAC abaixo de R$ 150'},
      ]},
      premissas: {
        preco: {nome: 'Preço da assinatura', pessimista: 59.9, base: 59.9, otimista: 59.9, unidade: 'R$/mês', origem: 'decisão de 12/10'},
        churn_pct: {nome: 'Perda de assinantes', pessimista: 7, base: 4, otimista: 3, unidade: '% ao mês', origem: 'chute'},
        indicacao_pct: {nome: 'Indicação boca a boca', pessimista: 1, base: 2, otimista: 3, unidade: '% da base', origem: 'chute'},
        cambio: {nome: 'Dólar', pessimista: 5.8, base: 5.4, otimista: 5.1, unidade: 'R$ por US$', origem: 'cotação de 18/10'},
        meta: {nome: 'Meta de assinantes', pessimista: 10000, base: 10000, otimista: 10000, unidade: 'assinantes', origem: 'objetivo'},
        meses: {nome: 'Horizonte', pessimista: 48, base: 48, otimista: 48, unidade: 'meses', origem: 'decisão'},
        verba_pct: {nome: 'Parte do resultado que vira verba', pessimista: 50, base: 50, otimista: 50, unidade: '%', origem: 'decisão'},
        empresa_fixo_pct: {nome: 'Parte do custo fixo da empresa', pessimista: 100, base: 100, otimista: 100, unidade: '%', origem: 'decisão'},
        servidor_usd: {nome: 'Servidor', pessimista: 20, base: 11, otimista: 11, unidade: 'US$/mês', origem: 'Vercel'},
        apple_usd_ano: {nome: 'Apple Developer', pessimista: 99, base: 99, otimista: 99, unidade: 'US$/ano', origem: 'Apple'},
        contador: {nome: 'Contador', pessimista: 600, base: 450, otimista: 450, unidade: 'R$/mês', origem: 'proposta'},
        taxa_pct: {nome: 'Taxa da plataforma', pessimista: 9.9, base: 4.69, otimista: 4.69, unidade: '% por venda', origem: 'Hotmart / Stripe'},
        taxa_fixa: {nome: 'Taxa fixa por venda', pessimista: 1, base: 0.5, otimista: 0.5, unidade: 'R$', origem: 'Hotmart / Stripe'},
        imposto_pct: {nome: 'Imposto (Simples)', pessimista: 8, base: 6, otimista: 6, unidade: '% da receita', origem: 'a confirmar com o contador'},
        comissao_pct: {nome: 'Comissão de afiliado', pessimista: 30, base: 20, otimista: 20, unidade: '%', origem: 'decisão'},
        comissao_meses: {nome: 'Meses de comissão', pessimista: 12, base: 12, otimista: 12, unidade: 'meses', origem: 'decisão'},
        promotores: {nome: 'Promotores ativos', pessimista: 5, base: 10, otimista: 15, unidade: 'pessoas', origem: 'chute'},
        conv_promotor: {nome: 'Assinaturas por promotor', pessimista: 1.5, base: 3, otimista: 4, unidade: 'por mês', origem: 'chute'},
        acoes_influencer: {nome: 'Ações com influenciadores', pessimista: 1, base: 2, otimista: 3, unidade: 'por mês', origem: 'chute'},
        conv_acao: {nome: 'Assinaturas por ação', pessimista: 15, base: 40, otimista: 60, unidade: 'por ação', origem: 'chute'},
        eco_usuarios: {nome: 'Usuários dos apps gratuitos', pessimista: 1500, base: 3000, otimista: 6000, unidade: 'pessoas', origem: 'chute'},
        eco_convite_pct: {nome: 'Convidados por mês', pessimista: 5, base: 10, otimista: 12, unidade: '%', origem: 'chute'},
        conv_teste_pct: {nome: 'Teste grátis que vira assinatura', pessimista: 8, base: 15, otimista: 20, unidade: '%', origem: 'chute'},
        inicio_assinantes: {nome: 'Assinantes no início', pessimista: 0, base: 0, otimista: 0, unidade: 'assinantes', origem: 'hoje'},
        verba_inicial: {nome: 'Verba do primeiro mês', pessimista: 1000, base: 2000, otimista: 3000, unidade: 'R$', origem: 'aporte das sócias'},
        cac_pago: {nome: 'Custo por assinante pago (CAC)', pessimista: 250, base: 150, otimista: 110, unidade: 'R$', origem: 'chute'},
      },
      decisoes: {columns: ['Data', 'Decisão', 'Por quê'], rows: [
        {Data: '12/10/2026', Decisão: 'Preço único de R$ 59,90 por mês', 'Por quê': 'Simplicidade no lançamento; plano anual depois do piloto.'},
        {Data: '15/10/2026', Decisão: 'Metade do resultado vira verba de marketing', 'Por quê': 'Crescer sem novo aporte depois do mês de equilíbrio.'},
        {Data: '17/10/2026', Decisão: 'Tudo do Med Painel no portal, cifrado', 'Por quê': 'As sócias acompanham sem pedir arquivo.'},
      ]},
    },
    atlas: {
      coverage: {assets_catalogued: 10, deep_dossiers_written: 4, automatic_triage_dossiers: 3, metadata_only_private_dossiers: 1, github_owned: 5, local_documents_read: 112, local_documents_not_read: 38, coverage_note: 'O catálogo registra o que foi encontrado e conferido. Contagem de ativos não representa validação técnica ou comercial.', runtime_validation: 'Funcionamento não testado por este catálogo', commercial_validation: 'Sem validação comercial registrada'},
      sources: [],
      assets: [
        {id: 'med-painel', name: 'Med Painel', kind: 'platform', category: 'Ensino e clínica', summary: 'Painel de consulta rápida para o plantão: CID, bulário, condutas e modelos que colam no prontuário.', documented_state: 'Versão de teste funcionando no Mac; mesa de teste publicada no portal.', distribution: ['commercial_candidate'], readiness: prontidao('pronto para piloto', [20, 18, 14, 12, 14], 6, [{texto: 'Piloto com usuários reais', proximo_passo: 'Convidar 30 colegas com cupom próprio'}]), decisao: {destino: 'produto', ajuste: 6, justificativa: 'Já resolve um problema de plantão.', proximo_passo: 'Convidar 30 colegas com cupom próprio', autor: 'Bauer', em: '2026-10-12T14:00:00Z'}, release_proposal: {status: 'proposta', priority: 1, first_delivery: 'Assinatura mensal com bulário e CID.', reason: 'Maior prontidão documental e meta definida.', blockers: ['Revisão clínica das condutas'], distribution: ['commercial_candidate']}, metrics: {routes_declared: 12, routes_present: 11, documents_read: 34}, topics: ['CID-10', 'Bulário', 'Condutas'], gaps: ['Revisão clínica das condutas'], relations: [{target: 'bulario', type: 'usa'}], source_refs: [{label: 'mercado/MED-PAINEL-ESTRATEGIAS.md'}]},
        {id: 'bulario', name: 'Bulário de bolso', kind: 'component', category: 'Ensino e clínica', summary: 'Fichas de medicamentos com fonte e data, para consulta offline.', documented_state: 'Componente dentro do Med Painel; ainda sem app próprio.', distribution: ['free_candidate'], readiness: prontidao('em preparo', [18, 12, 8, 10, 4], 0, [{texto: 'Separar como app', proximo_passo: 'Empacotar como app gratuito'}]), decisao: {destino: 'produto', ajuste: 0, justificativa: 'Porta de entrada gratuita.', proximo_passo: 'Empacotar como app gratuito', autor: 'Bauer', em: '2026-10-14T10:00:00Z'}, metrics: {documents_read: 12}, topics: ['Bulas', 'Interações'], gaps: [], relations: [{target: 'med-painel', type: 'parte de'}], source_refs: [{label: 'bulario/README.md'}]},
        {id: 'ai-cask', name: 'AI Cask', kind: 'project', category: 'Ferramentas internas', summary: 'O app do Mac que reúne as IAs, os projetos e a aba Finanças.', documented_state: 'Em uso diário; código privado.', distribution: ['internal'], readiness: prontidao('uso interno', [16, 14, 12, 8, 10]), decisao: {destino: 'interno', ajuste: 0, justificativa: 'É a casa das ferramentas.', proximo_passo: '', autor: 'Bauer', em: '2026-10-10T10:00:00Z'}, metrics: {private_repository: true}, topics: [], gaps: [], relations: [], source_refs: [{label: 'AI Cask/README'}]},
        {id: 'portal-financas', name: 'Portal Finanças', kind: 'platform', category: 'Ferramentas internas', summary: 'A versão online e cifrada das finanças, para as sócias.', documented_state: 'Publicado; só leitura.', distribution: ['internal'], readiness: prontidao('uso interno', [16, 12, 10, 8, 16]), decisao: null, metrics: {}, topics: [], gaps: ['Edição pelas sócias'], relations: [{target: 'ai-cask', type: 'gerado por'}], source_refs: [{label: 'orquestrator-portal'}]},
        {id: 'orq-synch', name: 'Orquestrator Synch', kind: 'repository', category: 'Ferramentas internas', summary: 'Sincronia de arquivos entre as máquinas da equipe.', documented_state: 'Repositório com README; testes parciais.', distribution: ['open_source_candidate'], readiness: prontidao('documentado', [14, 10, 8, 10, 6]), decisao: {destino: 'open_source', ajuste: 0, justificativa: 'Útil fora da empresa.', proximo_passo: 'Escolher licença', autor: 'Bauer', em: '2026-10-11T10:00:00Z'}, metrics: {}, topics: [], gaps: ['Licença'], relations: [], source_refs: [{label: 'orquestrator-synch/README.md'}]},
        {id: 'ia-chat', name: 'IA Chat', kind: 'project', category: 'Ferramentas internas', summary: 'Conversa em grupo entre IAs e pessoas, com laboratório de maquetes.', documented_state: 'Em desenvolvimento ativo.', distribution: ['internal', 'open_source_candidate'], readiness: prontidao('em preparo', [16, 12, 14, 10, 6]), decisao: null, metrics: {}, topics: [], gaps: [], relations: [{target: 'lab-maquetes', type: 'hospeda'}], source_refs: [{label: 'ia-chat/README.md'}]},
        {id: 'lab-maquetes', name: 'Laboratório de maquetes', kind: 'collection', category: 'Ideias', summary: 'Protótipos visuais com dados fictícios: ideias que podem virar produto.', documented_state: 'Galeria com 9 maquetes.', distribution: ['free_candidate', 'commercial_candidate'], readiness: prontidao('ideia', [12, 6, 2, 8, 4]), decisao: null, metrics: {}, topics: ['Maquetes'], gaps: ['Escolher a próxima maquete a virar produto'], relations: [], source_refs: [{label: 'laboratorio/galeria'}]},
        {id: 'skill-diretor', name: 'Skill Diretor de Arte', kind: 'skill', category: 'Componentes', summary: 'Instruções de direção de arte reutilizáveis pelas IAs.', documented_state: 'Skill publicada para uso interno.', distribution: ['free_candidate'], readiness: prontidao('documentado', [16, 14, 4, 8, 10]), decisao: {destino: 'decidir', ajuste: 0, justificativa: '', proximo_passo: '', autor: 'Bauer', em: '2026-10-09T10:00:00Z'}, metrics: {}, topics: [], gaps: [], relations: [], source_refs: [{label: 'skills/diretor-de-arte'}]},
        {id: 'prontuario-teste', name: 'Prontuário de teste', kind: 'material', category: 'Ensino e clínica', summary: 'Documento fictício que faz as vezes de prontuário na mesa de teste.', documented_state: 'Usado na demonstração do Med Painel.', distribution: ['reference'], readiness: prontidao('referência', [10, 8, 0, 6, 8]), decisao: null, metrics: {}, topics: [], gaps: [], relations: [{target: 'med-painel', type: 'demonstra'}], source_refs: [{label: 'painel/mesa'}]},
        {id: 'mentoria', name: 'Mentoria de prova', kind: 'material', category: 'Ensino e clínica', summary: 'Trilhas de estudo para residência com questões comentadas.', documented_state: 'Esboço de trilha; sem conteúdo validado.', distribution: ['commercial_candidate'], readiness: prontidao('ideia', [12, 4, 0, 4, 0]), decisao: null, release_proposal: {status: 'proposta', priority: 2, first_delivery: 'Trilha de 4 semanas para clínica médica.', reason: 'Público já conhecido.', blockers: ['Validar interesse com 10 residentes'], distribution: ['commercial_candidate']}, metrics: {curriculum_total: 40, validated_topics: 0}, topics: ['Clínica médica'], gaps: ['Conteúdo'], relations: [], source_refs: [{label: 'mentoria/ESBOCO.md'}]},
      ],
    },
  },
};
