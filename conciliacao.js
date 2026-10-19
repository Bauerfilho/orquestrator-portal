// Conciliar a fatura (fatia F2-8): botão 'Conciliar fatura' na barra de Lançamentos (registrarExtra
// 'lancamentos-barra') e a folha comum (abrirFolha) com os gastos em moeda estrangeira e a PTAX do dia.
import {registrarPagina} from './livro.js';

// Esqueleto: só se registra. O desenho entra na fatia indicada acima; até lá a página fica como está.
export function desenhar(D) {} // D = dados() do livro.js: {c, d, aplicado, lista}
registrarPagina(desenhar);
