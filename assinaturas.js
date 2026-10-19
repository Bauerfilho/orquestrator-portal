// Assinaturas (fatia F2-5): Nova assinatura, Confirmar, Encerrar e Marcar como paga, com autora e data, no
// contêiner #assinaturas-topo (antes de #subscriptions-content, que continua desenhado pelo app.js).
import {registrarPagina} from './livro.js';

// Esqueleto: só se registra. O desenho entra na fatia indicada acima; até lá a página fica como está.
export function desenhar(D) {} // D = dados() do livro.js: {c, d, aplicado, lista}
registrarPagina(desenhar);
