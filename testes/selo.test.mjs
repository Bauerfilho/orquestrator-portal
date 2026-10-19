// node --test testes/ — o selo do mês: SHA-256 em JS puro igual ao node:crypto (acentos, emoji, tamanhos nas bordas
// dos blocos de 64 bytes) e o JSON canônico (chaves em ordem, só números inteiros). Plano: §4.2 closings e F16.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256Hex, sha256Bytes, canonico, seloDe, seloCurto} from '../selo.js';

const referencia = texto => createHash('sha256').update(texto, 'utf8').digest('hex');
// gerador determinístico (mulberry32): os mesmos 500 textos em toda execução
function sorteio(semente) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('sha256Hex: vetores conhecidos (FIPS 180-4)', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(sha256Bytes(new Uint8Array(0)), sha256Hex(''));
});

test('sha256Hex é igual ao node:crypto em 500 textos com acentos e emoji', () => {
  const rnd = sorteio(20261019);
  const pedacos = ['a', 'Z', '0', ' ', ';', '"', '\\', '\n', 'ç', 'ã', 'é', 'Ó', 'ü', 'ñ', '€', '—', '≈', '−', '·', 'R$ 1.388,47', '中', 'ß', '😀', '🇧🇷', '👩🏽‍💻', '🧾', '\u0000', ' ', '퟿', '', '￿'];
  const vistos = new Set();
  for (let k = 0; k < 500; k++) {
    // tamanhos que cruzam as bordas do enchimento (55, 56, 64 bytes) e textos longos de vários blocos
    const n = k < 130 ? k : Math.floor(rnd() * 400);
    let texto = '';
    while (texto.length < n) texto += pedacos[Math.floor(rnd() * pedacos.length)];
    if (k < 130) texto = 'x'.repeat(k);   // ASCII puro: k bytes exatos, todas as bordas de 0 a 129
    vistos.add(texto);
    assert.equal(sha256Hex(texto), referencia(texto), `texto ${k} (${JSON.stringify(texto).slice(0, 40)}…)`);
  }
  assert.ok(vistos.size > 450, 'os textos são variados');
  // um caractere sozinho de um par substituto vira U+FFFD dos dois lados
  assert.equal(sha256Hex('a\ud800b'), referencia('a\ud800b'));
});

test('canonico: chaves em ordem, sem espaços, e o mesmo texto com as chaves embaralhadas', () => {
  assert.equal(canonico({b: 1, a: [3, {d: null, c: 'ç'}], e: true}), '{"a":[3,{"c":"ç","d":null}],"b":1,"e":true}');
  const um = {mes: '2026-10', totais: {total: 138847, realizado: 116641, previsto: 22206}, partes: {bauer: 55539, ana: 41654}};
  const outro = {partes: {ana: 41654, bauer: 55539}, totais: {previsto: 22206, realizado: 116641, total: 138847}, mes: '2026-10'};
  assert.equal(canonico(um), canonico(outro));
  assert.equal(seloDe(um), seloDe(outro));
  assert.notEqual(seloDe(um), seloDe({...um, totais: {...um.totais, total: 138848}}), '1 centavo muda o selo');
  assert.equal(canonico({a: undefined, b: [undefined]}), '{"b":[null]}', 'undefined segue o JSON');
  assert.equal(canonico(-0), '0');
});

test('canonico recusa número quebrado, infinito e tipos que não são JSON', () => {
  assert.throws(() => canonico(1.5), /inteiros/);
  assert.throws(() => canonico({valor: 0.1}), /inteiros/);
  assert.throws(() => canonico([NaN]), /inteiros/);
  assert.throws(() => canonico(Infinity), /inteiros/);
  assert.throws(() => canonico(2 ** 53), /inteiros/);
  assert.throws(() => canonico(10n), /bigint/);
  assert.throws(() => canonico({f: () => 1}), /function/);
});

test('seloCurto: os 8 primeiros dígitos', () => {
  assert.equal(seloCurto('81babb05df4d' + '0'.repeat(52)), '81babb05');
  assert.equal(seloCurto('xyz'), '');
  assert.equal(seloCurto(null), '');
});
