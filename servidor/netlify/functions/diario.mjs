// Função Netlify do diário: liga o núcleo (nucleo.mjs) ao Netlify Blobs, com consistência forte (a cabeça do log
// precisa ser lida sempre atualizada para o compare-and-swap valer).
import {getStore} from '@netlify/blobs';
import {criarDiario} from '../../nucleo.mjs';

const origens = (process.env.DIARIO_ORIGENS || 'https://bauerfilho.github.io').split(',').map(s => s.trim()).filter(Boolean);

export default async (req) => criarDiario(getStore({name: 'diario', consistency: 'strong'}), {origens})(req);
export const config = {path: ['/api/estado', '/api/chaves', '/api/iniciar', '/api/eventos']};
