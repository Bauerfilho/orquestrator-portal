#!/usr/bin/env python3
"""Lê o livro-caixa sem alterá-lo; escreve a extração somente fora do site público.

Requer openpyxl. Uso: python importar-livro-caixa.py fonte.xlsx --saida /pasta/privada/livro.json
A extração é entrada privada para o empacotador cifrado, nunca um arquivo para publicar.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import unicodedata
import warnings
from io import BytesIO
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

import openpyxl

RAIZ_PUBLICA = Path(__file__).resolve().parents[1]
TETO = 10**12


def normalizar(valor):
    return ''.join(c for c in unicodedata.normalize('NFD', str(valor or '').casefold()) if not unicodedata.combining(c)).strip()


def centavos(valor):
    if isinstance(valor, bool) or not isinstance(valor, (int, float, Decimal)):
        raise ValueError('Valor monetário precisa ser numérico, não texto.')
    try:
        d = Decimal(str(valor))
        if not d.is_finite():
            raise ValueError('Valor monetário não finito.')
        n = int((d * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    except (InvalidOperation, OverflowError) as e:
        raise ValueError('Valor monetário inválido.') from e
    if abs(n) > TETO:
        raise ValueError('Valor monetário ultrapassa o limite seguro.')
    return n


def valor_de(formulas, valores, linha, coluna):
    celula = formulas.cell(linha, coluna)
    valor = valores.cell(linha, coluna).value
    if celula.data_type == 'f' and valor is None:
        raise ValueError(f'{formulas.title}!{celula.coordinate}: fórmula sem cache; recalcule e salve no Excel antes de importar.')
    if isinstance(valor, str) and valor.startswith(('#REF!', '#VALUE!', '#DIV/0!', '#N/A', '#NAME?', '#NUM!')):
        raise ValueError(f'{formulas.title}!{celula.coordinate}: erro na fórmula ({valor}).')
    return valor


def data_iso(valor, onde):
    if not isinstance(valor, (date, datetime)):
        raise ValueError(f'{onde}: data ausente ou inválida.')
    return valor.isoformat()[:10]


def ler_aba(sf, sv):
    cabecalhos = [i for i in range(1, min(sf.max_row, 20) + 1)
                  if normalizar(sf.cell(i, 1).value) == 'data' and normalizar(sf.cell(i, 2).value) in ('descricao', 'descrição')]
    if len(cabecalhos) != 1:
        raise ValueError(f'{sf.title}: cabeçalho de movimentos não identificado de forma única.')
    cab = cabecalhos[0]
    if not normalizar(sf.cell(cab, 6).value).startswith('entrada') or not normalizar(sf.cell(cab, 7).value).startswith('saida'):
        raise ValueError(f'{sf.title}: colunas de entrada/saída diferentes do livro-caixa.')
    resumos = [i for i in range(1, cab) if normalizar(sf.cell(i, 2).value).startswith('saldo inicial')]
    if len(resumos) != 1:
        raise ValueError(f'{sf.title}: saldo inicial não identificado.')
    resumo = resumos[0]
    mes = data_iso(valor_de(sf, sv, resumo, 1), sf.title)[:7]
    ler = lambda linha, coluna: valor_de(sf, sv, linha, coluna)
    inicio = centavos(ler(resumo, 3))
    linhas, avisos = [], []
    saldo = inicio
    for numero in range(cab + 1, sf.max_row + 1):
        # A fórmula do saldo pré-preenchida em centenas de linhas não é um movimento.
        if not any(sf.cell(numero, c).value is not None for c in (1, 2, 3, 4, 5, 6, 7, 9)):
            continue
        entrada = centavos(ler(numero, 6)) if ler(numero, 6) is not None else 0
        saida = centavos(ler(numero, 7)) if ler(numero, 7) is not None else 0
        if not entrada and not saida:
            if ler(numero, 1) is not None or ler(numero, 2) is not None:
                avisos.append(f'{sf.title}, linha {numero}: registro sem valor, não convertido em movimento.')
            continue
        if entrada < 0 or saida < 0 or bool(entrada) == bool(saida):
            raise ValueError(f'{sf.title}, linha {numero}: informe só entrada ou só saída positiva.')
        data = data_iso(ler(numero, 1), f'{sf.title}, linha {numero}')
        if data[:7] != mes:
            raise ValueError(f'{sf.title}, linha {numero}: data pertence a outro mês.')
        descricao, categoria = ler(numero, 2), ler(numero, 3)
        if not isinstance(descricao, str) or not descricao.strip() or not isinstance(categoria, str) or not categoria.strip():
            raise ValueError(f'{sf.title}, linha {numero}: descrição ou categoria ausente.')
        saldo += entrada - saida
        saldo_fonte = centavos(ler(numero, 8))
        if saldo_fonte != saldo:
            raise ValueError(f'{sf.title}, linha {numero}: saldo não confere com as linhas anteriores.')
        texto = lambda coluna: '' if ler(numero, coluna) is None else str(ler(numero, coluna))
        linhas.append({'id': f'lc-{mes}-{numero}', 'linha': numero, 'data': data, 'descricao': descricao,
                       'categoria': categoria, 'documento': texto(4), 'forma': texto(5),
                       'entradaMinor': entrada, 'saidaMinor': saida, 'saldoMinor': saldo_fonte,
                       'observacoes': texto(9), 'planoId': None})
    entradas, saidas = sum(l['entradaMinor'] for l in linhas), sum(l['saidaMinor'] for l in linhas)
    if [entradas, saidas, saldo] != [centavos(ler(resumo, c)) for c in (6, 7, 8)]:
        raise ValueError(f'{sf.title}: totais ou saldo final não conferem com os movimentos.')
    return {'mes': mes, 'aba': sf.title, 'saldoInicialMinor': inicio, 'entradasMinor': entradas,
            'saidasMinor': saidas, 'saldoFinalMinor': saldo, 'linhas': linhas}, avisos


def extrair(caminho):
    caminho = Path(caminho).resolve()
    conteudo = caminho.read_bytes()
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        formulas = openpyxl.load_workbook(BytesIO(conteudo), data_only=False)
        valores = openpyxl.load_workbook(BytesIO(conteudo), data_only=True)
    meses, avisos = [], []
    try:
        for sf in formulas:
            if not normalizar(sf.title).startswith('livro caixa'):
                continue
            mes, notas = ler_aba(sf, valores[sf.title])
            meses.append(mes)
            avisos.extend(notas)
    finally:
        formulas.close()
        valores.close()
    if not meses:
        raise ValueError('Nenhuma aba de livro-caixa encontrada.')
    meses.sort(key=lambda m: m['mes'])
    for anterior, atual in zip(meses, meses[1:]):
        if atual['mes'] <= anterior['mes'] or atual['saldoInicialMinor'] != anterior['saldoFinalMinor']:
            raise ValueError('Os meses se repetem ou o saldo inicial não continua o mês anterior.')
    avisos[:0] = [
        'Saldo escriturado é o resultado das linhas da planilha, não um saldo bancário conciliado.',
        'Aportes de capital não são receita de vendas; registros de rateio e vencimento não são novos pagamentos.',
        'A planilha não identifica quem lançou cada linha nem distingue cartão/conta da empresa de cartão/conta pessoal.',
    ]
    if any('aos poucos' in normalizar(l['observacoes']) for m in meses for l in m['linhas'] if l['entradaMinor']):
        avisos.append('Há aportes descritos como feitos aos poucos. Os valores foram preservados como escriturados; a integralização não foi confirmada no banco.')
    return {'versao': 1, 'fonte': {'arquivo': caminho.name, 'sha256': hashlib.sha256(conteudo).hexdigest(),
                                 'importadoEm': datetime.now(timezone.utc).isoformat()}, 'meses': meses, 'avisos': avisos}


def gravar_privado(caminho, livro):
    caminho = Path(caminho).resolve()
    if caminho.is_relative_to(RAIZ_PUBLICA):
        raise ValueError('A extração privada não pode ficar no repositório público. Use uma pasta privada fora dele.')
    caminho.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(caminho, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(livro, f, ensure_ascii=False, indent=2)
        f.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fonte', type=Path)
    parser.add_argument('--saida', type=Path, required=True)
    args = parser.parse_args()
    livro = extrair(args.fonte)
    gravar_privado(args.saida, livro)
    print(json.dumps({'saidaPrivada': str(args.saida.resolve()), 'sha256Fonte': livro['fonte']['sha256'],
                      'meses': len(livro['meses']), 'movimentos': sum(len(m['linhas']) for m in livro['meses'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
