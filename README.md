# Portal Orquestrator · Finanças

O portal da empresa: finanças, assinaturas, projetos, sociedade e o Laboratório de maquetes. Ele é publicado pelo
GitHub Pages a partir da branch `main`.

**Este repositório é a fonte da interface** (decisão do Bauer em 19/10/2026). O `montar.mjs` do AI Cask continua
gerando o **pacote cifrado de dados** (`bundle-*.bin`, `manifest.json`, `painel/`). Ele não deve sobrescrever a
interface: `app.js`, `domain.js`, `razao.js`, `diario.js`, `livro.js`, `graficos.js`, os `.css` e o `index.html`.

O conteúdo é cifrado no navegador. Sem a senha, não há nada legível aqui.

## O que há em cada arquivo

| Arquivo | O que faz |
|---|---|
| `index.html` | A página, com a política de segurança (CSP). Só fala com o próprio site, com o servidor do diário e com a PTAX do BCB. |
| `static-bridge.js` · `portal-crypto.js` | Abrem o pacote cifrado com a senha e abrem o diário. |
| `domain.js` | O domínio que já existia: assinaturas, cobranças e rateio, em centavos inteiros. |
| `razao.js` | O livro-razão:<br>· parâmetros com vigência (câmbio, spread, IOF, impostos, taxas);<br>· lançamentos das sócias;<br>· o mês calculado, o acerto entre sócias e o CSV para o contador. |
| `diario.js` | O diário cifrado: cada gravação é cifrada (AES-GCM) e assinada (ECDSA) no navegador, e o servidor só guarda texto cifrado. |
| `livro.js` · `graficos.js` · `livro.css` | As páginas Livro do mês, Lançamentos, Parâmetros e Histórico, o botão "+ Lançar" e os gráficos. |
| `app.js` · `style.css` · `tema.css` | A interface que já existia. |
| `servidor/` | O servidor do diário (função Netlify com Blobs). Como publicar: `servidor/LEIA.md`. |
| `docs/` | `PLANO-PORTAL.md` (o plano aprovado) e `CHECKLIST.md` (o que foi feito e o que falta). |

## Conferir

```zsh
node --test testes/*.test.mjs                                 # livro-razão, servidor e diário (cifra, conflito, adulteração)
node ferramentas/arnes/servir.mjs 8765                        # o portal local, sem senha: http://127.0.0.1:8765/?demo=1
node ferramentas/arnes/fotografar.mjs --query "demo=1"        # fotos de todas as páginas, claro/escuro, desktop/celular
```

No arnês, `?diario=local` grava de verdade, cifrado, num servidor do diário em memória. `?membro=m-ana` mostra o portal
como a Ana. As fotos falham se a página registrar erro de script ou violação de CSP.
