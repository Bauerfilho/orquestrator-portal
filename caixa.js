// Caixa (fatia F2-7): receitas, saldos, fluxo de 12 meses, cascata e fôlego em #caixa-calculado. Quando a parte
// calculada aparecer, fecha o <details class="registro-importado"> do pacote de 18/10 (que segue acessível).
import {registrarPagina} from './livro.js';

// Esqueleto: só se registra. O desenho entra na fatia indicada acima; até lá a página fica como está.
export function desenhar(D) {} // D = dados() do livro.js: {c, d, aplicado, lista}
registrarPagina(desenhar);
