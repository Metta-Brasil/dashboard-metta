# Dashboard Metta

Dashboard interno de gestão de **tráfego pago + funil de vendas high-ticket** (mentoria). Lê os dados **direto da planilha Google Sheets operacional** — sem banco de dados próprio — e renderiza KPIs, funis, séries temporais, heatmaps e rankings das 7 áreas do negócio.

- **Produção:** https://dashboard-metta-perpetuo.vercel.app — também em `https://dashboard.mettabrasil.com.br`
- **Acesso:** restrito ao domínio `@mettabrasil.com.br` (Google OAuth ou e-mail/senha).

> Documento técnico detalhado (front + back, para replicar a arquitetura em outros projetos): [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

---

## Stack e como cada ferramenta é usada

| Ferramenta | Para quê / como é usada |
|---|---|
| **Next.js 16** (App Router) | Framework. `cacheComponents: true` (PPR) — cada página é uma casca estática + ilhas dinâmicas em `<Suspense>`. Server Components fazem o data-fetch; Client Components só os filtros/gráficos interativos. |
| **React 19** | `React.cache()` deduplica o carregamento de dados por request (uma página tem N seções em Suspense; o loader roda 1× e todas compartilham). |
| **TypeScript** | Tipagem ponta a ponta. Tipos de domínio em `src/lib/calc/types.ts`. |
| **Tailwind CSS 4** | Estilo. Tokens de design (paleta Metta, claro/escuro) em `src/app/globals.css` via `@theme`/CSS vars. Mobile-first. |
| **shadcn/ui + Base UI** | Primitivos de UI (`src/components/ui/*`): sidebar, popover, dropdown, calendar, table, etc. |
| **Recharts** | Gráficos (combo barra+linha, multi-linha, donut, barras agrupadas, funil, projeção) em `src/components/dashboard/charts.tsx`. |
| **Google Sheets API v4** (`googleapis`) | Fonte de dados. Service Account (JWT, read-only) lê 6 abas via `batchGet`. |
| **Zod** | Valida e parseia cada linha da planilha contra um schema por aba (`log-and-drop`: linha inválida é logada e descartada, não derruba o build). |
| **Upstash Redis** | Cache aplicacional manual (REST). Snapshot de cada aba gravado com gzip. É o que torna o dashboard viável (a aba `fb_todos` tem ~51k linhas). |
| **Auth.js v5** (`next-auth` beta) | Autenticação. Google OAuth + Credentials (e-mail/senha). Sessão JWT, sem banco — usuários de e-mail/senha ficam no Upstash com hash bcrypt. Domínio restrito a `@mettabrasil.com.br`. |
| **bcryptjs** | Hash das senhas das contas de e-mail/senha. |
| **Brevo** (API) | Envio do e-mail de verificação no cadastro (single-sender, sem precisar de DNS). |
| **next-themes** | Tema claro / escuro / sistema (classe no `<html>`, persistente). Card seletor em `/configuracoes`. |
| **GitHub Actions** | Cron horário que mantém o cache Upstash quente (POST `/api/revalidate`). |
| **Vercel** | Hospedagem (Fluid Compute). Deploy via `vercel deploy --prod`. Cron nativo (1×/dia, backup do GitHub Actions). |

---

## Arquitetura de dados (o ponto-chave)

```
Google Sheets (planilha operacional, ~51k linhas em fb_todos)
        │  Sheets API v4 — Service Account JWT, read-only, batchGet
        ▼
refreshAllSheets()  ── grava ──►  Upstash Redis  (gzip, chave raw:<aba>, TTL 6h)
        ▲                                │
   cron horário                          │  readAllSheets() — GET no Upstash
   (GitHub Actions → POST /api/revalidate)
                                         ▼
                       React.cache() — dedup por request (1 fetch / N seções)
                                         ▼
                       calc<Página>(dados, filtros)  — funções TS puras
                                         ▼
                       Server Components + <Suspense> (PPR)
                                         ▼
                       Filtros (período/funil/SDR/status) via URL searchParams
                       → recalcula sobre o cache, SEM refazer o fetch
```

**Por que cache manual no Upstash (e não `'use cache'` do Next):** o snapshot parseado é grande (`fb_todos` ~21MB cru). O Vercel Data Cache nativo rejeita entradas grandes e ignora `cacheHandlers` custom em serverless. A solução é cache aplicacional explícito no Upstash com gzip. Diagnóstico e medições em [`docs/audit-performance.md`](docs/audit-performance.md).

**Frescor:** o cron horário (`.github/workflows/refresh-cache.yml`) repopula o Upstash a cada hora. O usuário final sempre pega cache quente (~0,7–2,5s) em vez do fetch frio (~6s+). Dados nunca ficam > 1h velhos.

---

## As 7 páginas

| Rota | Página | Abas usadas |
|---|---|---|
| `/` | Visão Geral | fb_todos, leads, sdr, vendas |
| `/metas` | Metas vs Realizado | + Metas |
| `/trafego` | TP Aquisição | fb_todos, leads |
| `/tp-distribuicao` | TP Distribuição de conteúdo | — (placeholder "Em breve") |
| `/anuncios` | Anúncios | fb_todos, leads, sdr, vendas, ads_links |
| `/sdr` | Comercial SDR | leads, sdr, vendas |
| `/closer` | Comercial Closer | fb_todos, leads, sdr, vendas, Metas |
| `/origem` | Origem | leads, sdr, vendas |
| `/configuracoes` | Configurações (perfil, segurança, tema) | — |

Filtros sincronizam via URL (`?from=…&to=…&funis=sala,sessao&sdr=Ana,Bia&status=…`) e recalculam em TypeScript sobre o cache. Todos os filtros usam um componente multiselect único (`MultiSelectFilter`) no mesmo padrão visual; o seletor de período usa o mesmo trigger.

---

## Autenticação

- **Auth.js v5**, sessão **JWT** (sem banco). `src/middleware.ts` protege tudo (sem sessão → `/login`).
- **Google OAuth** e **Credentials (e-mail/senha)**. Ambos restritos a `@mettabrasil.com.br`.
- Contas de e-mail/senha: cadastro em `/signup` → e-mail de verificação via **Brevo** → conta gravada no **Upstash** com **bcrypt**. Chaves: `auth:user:<email>`, `auth:pending:<email>`, `auth:profile:<email>`, `auth:emailchange:<email>`.

---

## Tema (claro / escuro / sistema)

`next-themes` no root layout (`attribute="class"`, `defaultTheme="system"`). Tokens claro e escuro definidos em `globals.css` (`:root` e `.dark`). Card seletor em `/configuracoes`. No escuro o fundo da página é levemente mais claro que a sidebar para manter a separação visual do tema claro.

---

## Variáveis de ambiente

Configuradas no Vercel (Production). Local: `vercel env pull .env.local`. Template em `.env.example`.

| Var | Uso |
|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Service Account (leitura Sheets) |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Service Account (chave privada) |
| `GOOGLE_SHEETS_ID` | ID da planilha fonte |
| `UPSTASH_REDIS_REST_URL` | Cache Redis (REST) |
| `UPSTASH_REDIS_REST_TOKEN` | Cache Redis (REST) |
| `AUTH_SECRET` | Assinatura da sessão JWT (Auth.js) |
| `AUTH_GOOGLE_ID` | Google OAuth client id |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `BREVO_API_KEY` | Envio do e-mail de verificação (cadastro) |
| `REVALIDATE_SECRET` | Auth do `POST /api/revalidate` (cron) |
| `CRON_SECRET` | Auth do `GET /api/cron` (Vercel Cron) |

Secret no GitHub Actions: `REVALIDATE_SECRET` (usado pelo workflow do cron).

---

## Rodar local

```bash
npm install
vercel env pull .env.local   # puxa as envs do Vercel
npm run dev                  # dev
# ou produção local:
npm run build && npm start
```

Validar números da Visão Geral contra a planilha (lê a aba "Análise Geral" ao vivo e compara com `calcVisaoGeral`):

```bash
npx tsx scripts/sanity-check-visao-geral.ts
```

---

## Deploy

```bash
vercel deploy --prod --yes
```

Auto-aliasa para `dashboard-metta-perpetuo.vercel.app` e `dashboard.mettabrasil.com.br`. Confirmar `readyState: READY`. O cron de cache é independente (GitHub Actions horário + Vercel Cron diário de backup).

---

## Estrutura

```
src/
├── app/
│   ├── (auth)/                 # login, signup, confirmação de código
│   ├── (dashboard)/            # layout (sidebar+header) + as páginas
│   ├── api/
│   │   ├── auth/[...nextauth]/ # handlers Auth.js
│   │   ├── cron/route.ts       # GET — refresh do cache (Vercel Cron compat)
│   │   └── revalidate/route.ts # POST — refresh (cron GitHub Actions)
│   ├── layout.tsx              # root: ThemeProvider + tokens
│   └── globals.css             # tokens claro/escuro (paleta Metta) + SF Pro
├── components/
│   ├── ui/                     # primitivos shadcn/Base UI
│   ├── dashboard/              # charts, toolbar, filtros, tabelas, heatmap
│   ├── app-sidebar.tsx · nav-main.tsx · nav-user.tsx · page-shell.tsx
│   └── theme-provider.tsx · theme-toggle.tsx
├── lib/
│   ├── sheets/                 # client (JWT) · schemas (Zod+COLUMN_MAP) · parse · read
│   ├── cache/upstash.ts        # cacheGet/cacheSet (gzip + reviver de Date)
│   ├── calc/                   # types + shared + 1 função pura por página
│   ├── auth/users.ts           # store de usuários no Upstash (bcrypt)
│   ├── email/brevo.ts          # envio do e-mail de verificação
│   ├── page-data.ts            # loaders memoizados (React.cache) por página
│   └── filters.ts              # parseFilters dos searchParams
├── middleware.ts               # proteção de rotas (Auth.js)
└── auth.ts                     # config Auth.js v5
.github/workflows/refresh-cache.yml   # cron horário → POST /api/revalidate
vercel.json                           # Vercel Cron diário (backup)
next.config.ts                        # cacheComponents: true
docs/                                 # ARQUITETURA, auditorias, status
```

---

## Gotchas conhecidos (importantes ao mexer nos dados)

- **Column-map com offset +1:** a aba `vendas` tem uma coluna de e-mail extra no snapshot que não existe no cabeçalho (idx 17, range `A:AE`); a aba `sdr` ganhou "Horário da reunião" (idx 13, range `A:AB`). Os `COLUMN_MAP` em `src/lib/sheets/schemas.ts` já compensam — **não reverter para o cabeçalho**.
- **Datas em BRT:** `parseFilters` e `eachDay` ancoram em meia-noite `-03:00`. Datas `YYYY-MM-DD` interpretadas como UTC perdem o último dia do período.
- **Cron:** Vercel Hobby só permite 1 cron/dia; por isso o frescor real vem do **GitHub Actions horário**. Não remover o workflow.
- **Segredos:** `.env*` e `.claude/` estão no `.gitignore`. Nunca commitar credenciais. As envs vivem no Vercel + secret do GitHub Actions.
