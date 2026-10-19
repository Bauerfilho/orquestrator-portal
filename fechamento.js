// Fechar o mês (fatia F2-9): o roteiro de 6 passos em #fechamento-content, o selo no topo do Livro do mês
// (registrarExtra 'livro-topo') e o 'Baixar CSV' de Parâmetros e do Histórico ('parametros-barra', 'historico-barra').
import {registrarPagina} from './livro.js';

// Esqueleto: só se registra. O desenho entra na fatia indicada acima; até lá a página fica como está.
export function desenhar(D) {} // D = dados() do livro.js: {c, d, aplicado, lista}
registrarPagina(desenhar);
