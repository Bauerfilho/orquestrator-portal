// Como fazer e Estado do portal (fatia F2-10): as 8 tarefas com o botão que faz, o primeiro acesso e a saúde do
// portal. As páginas entram prontas na gaveta só nessa fatia, para nenhuma página vazia ir ao ar.
import {registrarPagina} from './livro.js';

// Esqueleto: só se registra. O desenho entra na fatia indicada acima; até lá a página fica como está.
export function desenhar(D) {} // D = dados() do livro.js: {c, d, aplicado, lista}
registrarPagina(desenhar);
