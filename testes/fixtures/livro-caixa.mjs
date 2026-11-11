// Fonte exclusivamente fictícia para provas do domínio e do navegador. Não contém dados da empresa.
export function estadoComLivro() {
  const linha = (mes, numero, dados) => ({id: `lc-${mes}-${numero}`, linha: numero, data: `${mes}-20`, descricao: 'Item fictício',
    categoria: 'Ferramentas e APIs de IA', documento: '0', forma: 'Pix', entradaMinor: 0, saidaMinor: 0,
    saldoMinor: 0, observacoes: '', planoId: null, ...dados});
  return {
    schemaVersion: 1, revision: 0, members: [{id: 'm-dona', displayName: 'Sócia fictícia A', role: 'owner', participationPct: 60},
      {id: 'm-par', displayName: 'Sócia fictícia B', role: 'member', participationPct: 40}],
    plans: [{id: 'pl-mensal', servico: 'Aurora', plano: 'Mensal', amountMinor: 1234, currency: 'BRL', period: 'mensal', monthlyDay: 20,
      confirmed: true, subscriptionState: 'active'},
      {id: 'pl-unico', servico: 'Configuração', plano: 'Pagamento único', amountMinor: 2000, currency: 'BRL', period: 'unico',
        nextDate: '2031-11-20', confirmed: true, subscriptionState: 'active'}],
    charges: null, benefits: [], selling: {steps: []}, staticBlocks: {},
    livroCaixa: {versao: 1, fonte: {arquivo: 'Livro fictício.xlsx', sha256: 'a'.repeat(64), importadoEm: '2031-11-21T12:00:00Z'}, avisos: ['Registro contábil, não extrato bancário.'],
      meses: [
        {mes: '2031-10', aba: 'Outubro fictício', saldoInicialMinor: 0, entradasMinor: 30000, saidasMinor: 1234, saldoFinalMinor: 28766,
          linhas: [linha('2031-10', 7, {descricao: 'Aporte fictício', categoria: 'Aporte de capital', entradaMinor: 30000, saldoMinor: 30000}),
            linha('2031-10', 8, {data: '2031-10-02', descricao: 'Renovação Aurora', saidaMinor: 1234, saldoMinor: 28766, planoId: 'pl-mensal', observacoes: 'Ordem da planilha não é ordem de data.'})]},
        {mes: '2031-11', aba: 'Novembro fictício', saldoInicialMinor: 28766, entradasMinor: 0, saidasMinor: 2000, saldoFinalMinor: 26766,
          linhas: [linha('2031-11', 4, {descricao: 'Configuração única', saidaMinor: 2000, saldoMinor: 26766, planoId: 'pl-unico'})]},
        {mes: '2031-12', aba: 'Dezembro fictício', saldoInicialMinor: 26766, entradasMinor: 0, saidasMinor: 0, saldoFinalMinor: 26766, linhas: []},
      ]},
  };
}
