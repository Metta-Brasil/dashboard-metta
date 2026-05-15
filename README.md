# Dashboard Metta

Dashboard interno de gestão de tráfego pago + funil de vendas high-ticket (mentoria). Lê os dados direto da planilha Google Sheets operacional, sem DB próprio.

**Produção:** https://dashboard-metta-perpetuo.vercel.app

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components/PPR) |
| Linguagem | TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui |
| Fonte de dados | Google Sheets API (Service Account, read-only) |
| Validação | Zod (schema por aba) |
| Cache | Upstash Redis (cache aplicacional manual) |
| Cron | GitHub Actions schedule (horário) |
| Hospedagem | Vercel (Hobby) |

---

## Arquitetura de dados

```
Google Sheets (planilha BASE DE DADOS - PALIATIVO)
        │  Sheets API v4 (Service Account JWT, read-only)
        ▼
refreshAllSheets()  ──grava──►  Upstash Redis  (gzip, key raw:<aba>, TTL 6h)
        ▲                              │
   cron horário                        │ readSheet / readAllSheets (GET)
   (GitHub Actions)                    ▼
                          React.cache() por request (dedup intra-request)
                                       ▼
                          calc<Page>(dados, filtros)  — funções puras
                                       ▼
                          Server Components + Suspense (PPR)
```

**Por que cache manual no Upstash (e não `'use cache'` do Next):**
o snapshot parseado das abas é ~31MB (`fb_todos` tem 51k linhas). O Vercel Data Cache nativo rejeita silenciosamente entradas > ~2MB e **ignora `cacheHandlers` custom** (só vale self-hosting). A solução é cache aplicacional explícito no Upstash com gzip (comprime ~13×, ~2,4MB) — fora do mecanismo do Next/Vercel. Detalhes e medições em `docs/audit-performance.md`.

**Frescor dos dados:** o cron horário (`.github/workflows/refresh-cache.yml`) chama `POST /api/revalidate`, que roda `refreshAllSheets()` e sobrescreve o Upstash. Dados nunca ficam > 1h velhos e o usuário final sempre pega cache quente (~0,7-2,5s) em vez do fetch frio (~6s+).

---

## Estrutura

```
dashboard-metta/
├── src/
│   ├── app/
│   │   ├── (dashboard)/            # route group — layout + 7 páginas
│   │   │   ├── layout.tsx          # SidebarProvider + AppSidebar + SiteHeader
│   │   │   ├── page.tsx            # Visão Geral (/)
│   │   │   ├── metas/page.tsx      # Metas vs Realizado
│   │   │   ├── trafego/page.tsx    # Tráfego Pago
│   │   │   ├── anuncios/page.tsx   # Anúncios
│   │   │   ├── sdr/page.tsx        # Comercial SDR
│   │   │   ├── closer/page.tsx     # Comercial Closer
│   │   │   └── origem/page.tsx     # Origem
│   │   ├── api/
│   │   │   ├── cron/route.ts       # GET — refresh do cache (Vercel Cron compat)
│   │   │   └── revalidate/route.ts # POST — refresh manual (cron externo)
│   │   ├── layout.tsx              # root: Inter + tokens Metta
│   │   └── globals.css             # tokens shadcn customizados (paleta Metta)
│   ├── components/
│   │   ├── ui/                     # shadcn primitives
│   │   ├── dashboard/              # shared do app
│   │   │   ├── toolbar.tsx         # DateRangePopover + FunilChips
│   │   │   ├── date-range-popover.tsx
│   │   │   ├── funil-chips.tsx
│   │   │   ├── kpi-grid.tsx
│   │   │   ├── funnel-vertical.tsx
│   │   │   ├── sdr-heatmap.tsx
│   │   │   └── metric-table.tsx
│   │   ├── app-sidebar.tsx · nav-main.tsx · nav-user.tsx
│   │   ├── site-header.tsx · page-shell.tsx
│   └── lib/
│       ├── sheets/
│       │   ├── client.ts           # Service Account JWT singleton
│       │   ├── schemas.ts          # Zod schemas das 6 abas + COLUMN_MAPs
│       │   ├── parse.ts            # parseSheetData genérico (log-and-drop)
│       │   └── read.ts             # readSheet/readAllSheets/refreshAllSheets
│       ├── cache/
│       │   └── upstash.ts          # cacheGet/cacheSet (gzip + reviver de Date)
│       ├── calc/
│       │   ├── types.ts            # FilterState, RawData, Result types
│       │   ├── shared.ts           # filtros, dedup, joins, formatters
│       │   ├── visao-geral.ts · trafego.ts · sdr.ts · closer.ts
│       │   ├── anuncios.ts · origem.ts · metas.ts
│       ├── page-data.ts            # loaders memoizados (React.cache) por página
│       ├── filters.ts              # parseFilters dos searchParams
│       └── utils.ts
├── scripts/
│   └── sanity-check-visao-geral.ts # valida calc vs aba Análise Geral (ao vivo)
├── .github/workflows/
│   └── refresh-cache.yml           # cron horário → POST /api/revalidate
├── docs/
│   ├── audit-performance.md        # diagnóstico + resultado da otimização
│   ├── inventario-completude.md    # mapeamento wireframe ↔ calc/types
│   └── STATUS-2026-05-15.md        # snapshot de progresso
└── next.config.ts                  # cacheComponents: true
```

---

## As 7 páginas

| Rota | Página | Abas usadas |
|---|---|---|
| `/` | Visão Geral | fb_todos, leads, sdr, vendas |
| `/metas` | Metas vs Realizado | + Metas |
| `/trafego` | Tráfego Pago | fb_todos, leads |
| `/anuncios` | Anúncios | fb_todos, leads, sdr, vendas, ads_links |
| `/sdr` | Comercial SDR | leads, sdr, vendas |
| `/closer` | Comercial Closer | fb_todos, leads, sdr, vendas, Metas |
| `/origem` | Origem | leads, sdr, vendas |

Filtros (período + funil) sincronizam via URL search params (`?from=...&to=...&funis=sala,sessao`) e recalculam em TypeScript sobre o cache, sem refazer o fetch.

---

## Variáveis de ambiente

Configuradas no Vercel (Production). Para rodar local, `vercel env pull .env.local`.

| Var | Uso |
|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Service Account (leitura Sheets) |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Service Account |
| `GOOGLE_SHEETS_ID` | ID da planilha fonte |
| `UPSTASH_REDIS_REST_URL` | Cache Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Cache Redis |
| `REVALIDATE_SECRET` | Auth do `/api/revalidate` (cron externo) |
| `CRON_SECRET` | Auth do `/api/cron` (opcional, Vercel Cron) |

GitHub Actions secret: `REVALIDATE_SECRET` (usado pelo workflow do cron).

---

## Rodar local

```bash
npm install
vercel env pull .env.local   # puxa as envs do Vercel
npm run dev                  # dev (cache sempre revalida)
# ou produção local:
npm run build && npm start
```

Validar números da Visão Geral contra a planilha:

```bash
npx tsx scripts/sanity-check-visao-geral.ts
```

(Lê a aba "Análise Geral" ao vivo e compara com `calcVisaoGeral` — auto-atualizável.)

---

## Estado atual

**Pronto:**
- 7 páginas implementadas com todos os campos do wireframe/PRD (visual cru).
- Camada de dados (Sheets + cache Upstash + cron horário). Performance: 0,7-2,5s, dados ≤1h.
- Visão Geral validada 100% contra a planilha (sanity ao vivo).

**Pendente:**
- **Fidelidade visual ao wireframe:** gráficos que deviam ser combo barra+linha, donut, área etc. estão como tabela. Próxima frente.
- **Refino de performance:** 5/7 páginas (as que usam `fb_todos` 51k) ficam ~2s; meta é < 1s. Otimização de baixo risco identificada (desserialização) — ainda não aplicada.
- **Validação de números das outras 6 páginas:** só Visão Geral tem baseline automático na planilha.

Deploy: push na `main` + `vercel deploy --prod`. O cron de cache é independente (GitHub Actions).
