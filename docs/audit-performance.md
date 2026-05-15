# Audit de Performance — dashboard-metta (2026-05-15)

> Só medição/leitura. Zero alteração de código. Base pra plano de correção.

## Fatos medidos

### 1. CRÍTICO — Cache não retém entre requests
Prod, 2 rodadas seguidas (`dashboard-metta-perpetuo.vercel.app`):

| Rota | Rodada 1 (cold) | Rodada 2 (warm) |
|---|---|---|
| `/` | 25,2s | 22,1s |
| `/trafego` | 18,2s | 18,2s |
| `/metas` | 6,7s | 5,5s |

Warm ≈ Cold. Se `'use cache'` persistisse, rodada 2 seria < 1s. **Conclusão: o cache não está retendo nada em runtime — todo request refaz fetch+parse+calc do zero.**

### 2. CRÍTICO — Cache stampede intra-request
`readAllSheets` + `calc` chamados por seção, sem dedup por request:

| Página | readAllSheets | calc | Suspense |
|---|---|---|---|
| Visão Geral | ~6 (loadVisaoGeral ×6 seções) | 6 | 7 |
| **Tráfego** | **6** | **6** | **6** |
| SDR | 2 | 2 | 2 |
| Closer | 2 | 2 | 1 |
| Anúncios | 2 | 2 | 2 |
| Origem | 2 | 2 | 2 |
| Metas | 2 | 2 | 1 |

No cache frio, N fetches concorrentes de 51k linhas disparam antes de qualquer um popular o cache. Sem `React.cache()` pra dedupar no render.

### 3. CRÍTICO — Cache expira 23h antes do warming (design)
- `cacheLife({ revalidate: 600, expire: 3600 })` → cache vive no máx 1h
- `vercel.json` cron `0 11 * * *` → reaquece 1×/dia às 11h
- PRD §4.3 desenhou cron `*/10` (10min); Hobby plan bloqueia (limite 1×/dia). **Conflito de plano nunca resolvido.**
- Efeito: mesmo que o cache retivesse, expira em 1h e só reaquece em ~24h → ~95% dos acessos pagam fetch frio.

### 4. Custo unitário fetch+parse ≈ 3–5s
Script local (`sanity-check-visao-geral.ts`): fetch `fb_todos` (51k) + leads + sdr + vendas + parse Zod linha-a-linha + calc 14 dias ≈ 6,1s (inclui ~1-2s node startup). Aceitável SE cache quente e 1×/request. Fatal ×6 frio.

### 5. CRÍTICO — Regressão nos números (backend correto faz parte do "problema 2")
Sanity check Visão Geral vs aba `Análise Geral`:
- Antes (commit `3c22c24`): **48 OK / 0 FAIL**
- Agora (commit `ed2639c`): **44 OK / 1 WARN / 3 FAIL** — `2026-05-14 Investimento 29,5% divergente`

Algum dos 6 refactors paralelos de calc (commit `5aa651b`) quebrou a Visão Geral. **Backend "garantido" = rápido E correto** — não adianta otimizar número errado.

## Metas PRD §6 vs realidade

| Métrica | Meta PRD | Real |
|---|---|---|
| First load cache hit | < 1s | ~22s |
| Mudança de filtro | < 500ms | ~18-22s (refaz tudo) |
| Cache miss (cron warmup) | < 15s | 22-25s |
| Lighthouse Performance | > 85 | não medido (irrelevante enquanto trava) |

## Plano de correção — camada de dados (fundação permanente)

Ordem proposta (cada passo tem critério objetivo de "pronto"):

1. **Reverter a regressão dos números.** `git diff 3c22c24..ed2639c` nos calcs, achar o que quebrou Visão Geral, corrigir até sanity voltar a **48 OK / 0 FAIL**. Sem dados corretos, otimizar é otimizar lixo.
2. **Estender sanity check às outras 6 páginas.** Baseline da planilha (`Análise Geral`, `Análise Tráfego`) pra cada calc. Critério: cada página com diff < 1% vs planilha.
3. **Eliminar stampede.** `React.cache()` (não `next/cache`) por request envolvendo a função leitura+calc de cada página. 6 fetches/calcs → 1. Critério: logs mostram 1 fetch por request, não N.
4. **Fazer o cache persistir.** Investigar por que `'use cache'` não retém (cache key instável via searchParams Promise? Vercel Data Cache não provisionado? config?). Critério objetivo: rodada warm < 1s.
5. **Resolver cron vs expire.** Hobby limita cron 1×/dia. Decisão do Alisson (tem custo $): (a) `expire` 24h+ servindo stale até próximo cron, (b) Pro plan p/ cron 10min, (c) revalidação on-demand. Critério: cache nunca frio pro usuário final.
6. **Re-medir vs PRD §6.** Cache hit < 1s, filtro < 500ms, cache miss < 15s.

Tudo isso é `lib/sheets` + `lib/calc` + cache config + cron — **permanente, não refeito na fase de charts**. Orquestração de página (Suspense) mexida só o mínimo.
