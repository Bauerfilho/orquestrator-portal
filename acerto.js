// Acerto, reembolso e aporte (fatia F2-6): quem paga quem e 'Recebi' na Sociedade (#sociedade-acerto, abaixo dos
// cartões de perfis) e o resumo 'O que você adiantou' no Meu painel (#acerto-resumo).
import {registrarPagina} from './livro.js';

// Esqueleto: só se registra. O desenho entra na fatia indicada acima; até lá a página fica como está.
export function desenhar(D) {} // D = dados() do livro.js: {c, d, aplicado, lista}
registrarPagina(desenhar);
