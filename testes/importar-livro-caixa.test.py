"""Provas do importador com arquivos inteiramente fictícios."""
import hashlib
import importlib.util
import tempfile
import unittest
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
sys.dont_write_bytecode = True

RAIZ = Path(__file__).resolve().parents[1]

class ImportadorTest(unittest.TestCase):
    def carregar(self):
        arquivo = RAIZ / 'ferramentas' / 'importar-livro-caixa.py'
        self.assertTrue(arquivo.is_file(), 'Falta o importador local do livro-caixa')
        spec = importlib.util.spec_from_file_location('importador_caixa', arquivo)
        assert spec is not None and spec.loader is not None
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        return modulo

    def fonte(self, pasta):
        w = openpyxl.Workbook()
        assert w.active is not None
        w.remove(w.active)
        for nome, mes, cab, inicio, linhas in [
            ('Livro Caixa fictício A', '2031-10', 6, 0, [('Aporte fictício', 250, 0), ('Serviço fictício', 0, 12.34)]),
            ('Livro Caixa fictício B', '2031-11', 3, 237.66, [('Despesa fictícia', 0, 20)]),
            ('Livro Caixa fictício C', '2031-12', 6, 217.66, []),
        ]:
            s = w.create_sheet(nome)
            resumo = 2 if cab == 3 else 4
            s.cell(resumo, 1, datetime.fromisoformat(mes + '-01'))
            s.cell(resumo, 2, 'Saldo inicial do mês (R$)')
            s.cell(resumo, 3, inicio)
            s.cell(resumo, 6, sum(x[1] for x in linhas))
            s.cell(resumo, 7, sum(x[2] for x in linhas))
            s.cell(resumo, 8, round(inicio + sum(x[1] - x[2] for x in linhas), 2))
            for c, texto in enumerate(['Data', 'Descricao', 'Categoria', 'N. documento / NF', 'Forma de pagamento', 'Entrada (R$)', 'Saida (R$)', 'Saldo (R$)', 'Observacoes'], 1):
                s.cell(cab, c, texto)
            saldo = inicio
            for numero, (desc, entrada, saida) in enumerate(linhas, cab + 1):
                saldo = round(saldo + entrada - saida, 2)
                valores = [datetime.fromisoformat(mes + '-20'), desc, 'Aporte de capital' if entrada else 'Ferramentas e APIs de IA', 0, 'Pix', entrada or None, saida or None, saldo, 'Nota fictícia']
                for c, v in enumerate(valores, 1):
                    s.cell(numero, c, v)
            s.cell(500, 8, '=H499')  # formatação/fórmula futura não é movimento
        outra = w.create_sheet('PAGAMENTO FICTÍCIO')
        outra.append(['Serviço fictício', 12.34])  # não duplicar o quadro de planejamento
        destino = pasta / 'fonte-ficticia.xlsx'
        w.save(destino)
        return destino

    def test_cabecalhos_diferentes_e_totais_nunca_viram_movimentos(self):
        m = self.carregar()
        with tempfile.TemporaryDirectory() as p:
            fonte = self.fonte(Path(p))
            antes = fonte.read_bytes()
            livro = m.extrair(fonte)
            self.assertEqual([len(a['linhas']) for a in livro['meses']], [2, 1, 0])
            self.assertEqual(livro['meses'][0]['entradasMinor'], 25000)
            self.assertEqual(livro['meses'][0]['saidasMinor'], 1234)
            self.assertEqual(livro['meses'][1]['saldoFinalMinor'], 21766)
            self.assertEqual(livro['meses'][1]['linhas'][0]['linha'], 4)
            self.assertEqual(livro['fonte']['sha256'], hashlib.sha256(antes).hexdigest())
            self.assertEqual(fonte.read_bytes(), antes)

    def test_centavos_exatos_e_valores_invalidos(self):
        m = self.carregar()
        self.assertEqual(m.centavos(1.005), 101)
        self.assertEqual(m.centavos(39.900000000000006), 3990)
        for v in [True, float('inf'), 'nada']:
            with self.assertRaises(ValueError):
                m.centavos(v)

    def test_saldo_errado_nao_e_silenciado(self):
        m = self.carregar()
        with tempfile.TemporaryDirectory() as p:
            fonte = self.fonte(Path(p))
            w = openpyxl.load_workbook(fonte)
            w.worksheets[0]['H8'] = 999
            w.save(fonte)
            with self.assertRaisesRegex(ValueError, 'saldo|Saldo'):
                m.extrair(fonte)

    def test_formula_sem_cache_pede_recalculo_em_vez_de_inventar_zero(self):
        m = self.carregar()
        with tempfile.TemporaryDirectory() as p:
            fonte = self.fonte(Path(p))
            w = openpyxl.load_workbook(fonte)
            w.worksheets[0]['G4'] = '=SUM(G7:G8)'
            w.save(fonte)
            with self.assertRaisesRegex(ValueError, 'recalcul|cache'):
                m.extrair(fonte)

    def test_data_de_outro_mes_nao_e_importada_silenciosamente(self):
        m = self.carregar()
        with tempfile.TemporaryDirectory() as p:
            fonte = self.fonte(Path(p))
            w = openpyxl.load_workbook(fonte)
            w.worksheets[0]['A8'] = datetime(2031, 11, 1)
            w.save(fonte)
            with self.assertRaisesRegex(ValueError, 'mês|mes'):
                m.extrair(fonte)

    def test_saida_privada_recusa_webroot_e_nao_sobrescreve_arquivo(self):
        m = self.carregar()
        with self.assertRaisesRegex(ValueError, 'públic|repos'):
            m.gravar_privado(RAIZ / 'dados-reais.json', {})
        with tempfile.TemporaryDirectory() as p:
            saida = Path(p) / 'resultado.json'
            m.gravar_privado(saida, {'ficticio': True})
            self.assertEqual(saida.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                m.gravar_privado(saida, {})

if __name__ == '__main__':
    unittest.main()
