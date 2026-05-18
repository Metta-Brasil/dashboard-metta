# Arquitetura — Dashboard Metta (guia de replicação)

Documento técnico completo de como o projeto funciona, front e back, para **replicar essa arquitetura em projetos futuros**. Padrão central: **planilha operacional como fonte de verdade + cache aplicacional + render server-side com PPR**, sem banco próprio.

> Visão rápida e operação no [`README.md`](../README.md). Aqui é o "como e por quê" detalhado.

---

## 1. Filosofia

1. **A planilha é o banco.** Os dados já vivem numa Google Sheet operacional (preenchida por tráfego/comercial). Migrar para um DB seria custo sem retorno. O dashboard **lê** a planilha, nunca escreve.
2. **Cache de dados crus, não de resultados.** As combinações de filtro são quase infinitas; cachear cada permutação é inviável. Cacheia-se o **snapshot bruto parseado** de cada aba; os filtros recalculam em TypeScript em cima do snapshot (rápido, em memória).
3. **O usuário nunca paga o fetch caro.** Um cron horário reidrata o cache. O fetch frio (~6s+ para 51k linhas) só acontece no cron, nunca no request do usuário.
4. **Cálculo é função pura.** `calc<Página>(dados, filtros) → resultado`. Testável, sem efeito colateral, independente de React/HTTP.
5. **Filtro é URL.** Estado de filtro vive em `searchParams` → compartilhável, navegável (back/forward), server-rendered.

---

## 2. Stack e versões

- **Next.js 16.2.6** App Router, `cacheComponents: true` (Partial Prerendering).
- **React 19.2**, **TypeScript 5**.
- **Tailwind CSS 4** (`@tailwindcss/postcss`) + **shadcn/ui** sobre **Base UI** (`@base-ui/react`).
- **Recharts 3** para gráficos.
- **googleapis 171** (Sheets API v4) + **google-auth-library** (JWT Service Account).
- **Zod 4** para parse/validação de cada linha.
- **Upstash Redis** via REST (sem SDK; `fetch` direto).
- **Auth.js v5** (`next-auth@5 beta`) + **bcryptjs**.
- **next-themes 0.4** (claro/escuro/sistema).
- **Vercel** (Fluid Compute) + **GitHub Actions** (cron).

`AGENTS.md` na raiz avisa: este Next 16 tem breaking changes — consultar `node_modules/next/dist/docs/` antes de escrever código Next.

---

## 3. Back-end — pipeline de dados

### 3.1 Cliente Sheets (`src/lib/sheets/client.ts`)
Service Account JWT (read-only) como singleton. `assertSheetsEnv()` valida `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` / `GOOGLE_SHEETS_ID`.

### 3.2 Schemas + COLUMN_MAP (`src/lib/sheets/schemas.ts`)
Um schema Zod por aba + um `COLUMN_MAP` que mapeia nome de campo → índice de coluna. **Gotcha crítico:** índices de coluna **não** seguem o cabeçalho em duas abas:
- `vendas`: coluna de e-mail extra no snapshot ausente no cabeçalho → offset **+1** a partir do idx 17; range `vendas!A:AE`.
- `sdr`: coluna "Horário da reunião" inserida no idx 13; range `sdr!A:AB`.

Os `COLUMN_MAP` já compensam. **Nunca derivar índices do cabeçalho** — quebra a atribuição de vendas/SDR.

### 3.3 Parse log-and-drop (`src/lib/sheets/parse.ts`)
`parseSheetData(schema, values, columnMap)` aplica o schema linha a linha. Linha inválida → **logada e descartada**, não derruba o build nem a página. Drift de schema vira erro descritivo, não crash.

### 3.4 Ranges e leitura (`src/lib/sheets/read.ts`)
```
fb_todos!A:R · leads!A:P · sdr!A:AB · vendas!A:AE · Metas!A:D · 'ads links'!A:C
```
- `valueRenderOption: UNFORMATTED_VALUE`, `dateTimeRenderOption: FORMATTED_STRING`.
- `fetchTabs()` busca várias abas num **único `batchGet`** (1 request HTTP).
- `readAllSheets(tabs)`: tenta o cache de cada aba; as que faltam vêm num batchGet e são gravadas.
- `refreshAllSheets()`: busca TODAS as abas fresco e sobrescreve o Upstash. Chamado pelo cron.

### 3.5 Cache Upstash (`src/lib/cache/upstash.ts`)
Cache **aplicacional manual** — *não* `'use cache'` do Next (o Vercel ignora `cacheHandlers` custom em serverless e rejeita entradas grandes; `fb_todos` ~21MB cru).
- `cacheGet`/`cacheSet`: REST do Upstash, valor **gzip** (comprime ~13×), com **reviver de `Date`** na desserialização (datas voltam como `Date`, não string).
- Chave `raw:<aba>`, **TTL 6h** (maior que o intervalo do cron de 1h → nunca expira para o usuário).
- `raw:lastRefresh`: timestamp do último refresh (banner de staleness).

### 3.6 Dedup por request (`src/lib/page-data.ts`)
Cada página tem N seções, cada uma no seu `<Suspense>`. Sem dedup, cada seção chamaria `readAllSheets` + `calc` → N fetches/cálculos por request (cache stampede).
`React.cache()` memoiza pelo argumento — todas as seções recebem a **mesma referência** de `searchParams` (vem do mesmo `Page`), então o loader roda **1× por request** e as N seções compartilham o resultado.
`getVisaoGeral`/`getTrafego`/`getSdr`/… = `cache(async (sp) => calc(await readAllSheets(...), parseFilters(await sp)))`.

### 3.7 Cálculo puro (`src/lib/calc/*`)
- `types.ts`: `FilterState`, `RawData`, e o tipo de resultado de cada página.
- `shared.ts`: `eachDay` (itera em BRT), `filterByDate`, `filter*ByFunil`, `dedupeLeadsByEmail`, `safeRate`, `sumBy`, formatters (`formatBRL`, `formatPercent`, `formatInt`, …).
- Uma função por página: `calcVisaoGeral`, `calcTrafego`, `calcSdr`, `calcCloser`, `calcAnuncios`, `calcOrigem`, `calcMetas`. Replicam a lógica de SUMIFS/COUNTIFS da planilha.

### 3.8 Filtros (`src/lib/filters.ts`)
`parseFilters(searchParams) → FilterState`. **Datas em BRT:** `YYYY-MM-DD` é ancorado em `T00:00:00-03:00` (sem isso o JS interpreta como UTC e o período perde o último dia). `funis`/`sdr`/`status` são listas (split por vírgula; vazio/"todos" = sem corte).

---

## 4. Front-end — apresentação

### 4.1 Route groups e PPR
- `src/app/(auth)/` — login, signup, confirmação de código (layout próprio).
- `src/app/(dashboard)/` — `layout.tsx` (`SidebarProvider` + `AppSidebar` + conteúdo) e as páginas.
- **Regra do PPR/`cacheComponents`:** qualquer coisa dinâmica (`cookies`, `searchParams`, `auth()`) **tem que estar dentro de `<Suspense>`** ou o build falha. Padrão de página: casca estática + seções assíncronas, cada uma `<Suspense fallback={…}>` com um componente `async` que chama o loader de `page-data.ts`.

### 4.2 `PageShell` (`src/components/page-shell.tsx`)
Header sticky compacto (SidebarTrigger + título + toolbar de filtros) + container do conteúdo. A toolbar no mobile usa `flex flex-wrap` (filtros lado a lado, 2/linha); no desktop layout em linha. **Não** colocar `overflow` no wrapper da toolbar — recorta os dropdowns absolute dos filtros.

### 4.3 Sidebar (`app-sidebar.tsx`, `nav-main.tsx`, `ui/sidebar.tsx`)
shadcn sidebar `collapsible="icon"`: no desktop colapsa para rail de ícones (tooltip com o nome via prop `tooltip`); no mobile vira sheet (inalterado). `SidebarRail` + `SidebarTrigger` (Cmd/Ctrl+B) alternam. Estado persiste em cookie. No modo colapsado o texto da marca some (`group-data-[collapsible=icon]:hidden`).

### 4.4 Gráficos (`src/components/dashboard/charts.tsx`)
Componentes Recharts: `ComboBarLineChart`, `MultiLineChart`, `DonutChart`, `GroupedBarChart`, `AreaLineChart`, `ProjectionChart`, `FunnelVertical`. `MultiLineChart`/`GroupedBarChart` aceitam `valueFormat: "number" | "percent" | "currency"` (formata eixo Y + tooltip via `makeValueFormatter`). Séries diárias usam `xKey="dia"` formatado em BRT. Donut mostra valor + %.

### 4.5 Filtros unificados (`MultiSelectFilter`)
Um componente único (`src/components/dashboard/multi-select-filter.tsx`) para **todos** os filtros: trigger `h-9` + label fixo + count pill + caret que gira; painel `absolute` com checkboxes custom (`appearance-none` + SVG check) + rodapé "Limpar"; fecha por clique-fora e Escape; a11y `listbox`/`aria-multiselectable`.
- Modo `"todos"` (funil): inclui "Todos"; param ausente = todos.
- Modo `"plain"` (SDR/Status): multiselect simples.
- Serializa em `?funis=`/`?sdr=`/`?status=` (vírgula) via `router.replace(..., { scroll: false })`.
- `funil-chips.tsx` e `filter-select.tsx` são wrappers finos por cima dele. O `date-range-popover.tsx` usa o mesmo trigger visual; no mobile a seleção rápida vira um dropdown no mesmo padrão e o calendário mostra 1 mês.

### 4.6 Tabelas / KPIs / funil / heatmap
`MetricTable` (server: totais/inferência) + `MetricTableInteractive` (client: sort, sticky, maxRows). `KpiGrid` (cards responsivos, 2/linha no mobile). `FunnelVertical`, `SdrHeatmap`. Tudo mobile-first: classes base = mobile, `sm:`/`lg:` restauram desktop.

### 4.7 Tema (`theme-provider.tsx`, `theme-toggle.tsx`, `globals.css`)
`next-themes` no root layout: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`, `<html suppressHydrationWarning>`. Tokens claro em `:root`, escuro em `.dark` (CSS vars: `--background`, `--card`, `--sidebar`, `--border`, `--chart-*`, …). No escuro `--background` é levemente mais claro que `--sidebar` para manter a separação visual. Seletor segmentado (Claro/Escuro/Sistema) em `/configuracoes`. Tipografia: **SF Pro** (família única, subset variável self-hosted) — decisão fechada (versão expandida foi testada e rejeitada).

---

## 5. Autenticação

- **`src/auth.ts`** — Auth.js v5. Providers: **Google** + **Credentials**. Sessão **JWT** (`strategy: "jwt"`), `trustHost: true`, `pages.signIn: "/login"`.
- **Domínio restrito:** callback `signIn` exige `email_verified` e `@mettabrasil.com.br` (Google); Credentials valida no `authorize` (import dinâmico de `verifyUser` para manter bcrypt fora do bundle do middleware).
- **`src/middleware.ts`** — `auth()` protege tudo; sem sessão → `/login`; logado em `/login`/`/signup` → `/`. Matcher exclui `api/auth`, `api/cron`, `api/revalidate` (têm secret próprio), estáticos e `/fonts`,`/brand`.
- **Store sem banco (`src/lib/auth/users.ts`):** usuários de e-mail/senha no Upstash com bcrypt. Chaves: `auth:user:<email>` (conta), `auth:pending:<email>` (código de verificação), `auth:profile:<email>` (overlay de perfil — também p/ contas Google), `auth:emailchange:<email>`.
- **Verificação de e-mail (`src/lib/email/brevo.ts`):** Brevo single-sender (sem DNS necessário). Cadastro `/signup` → código no Upstash `auth:pending` → `/confirm` → conta criada.

---

## 6. Deploy e operação

- **Deploy:** `vercel deploy --prod --yes`. Auto-aliasa `dashboard-metta-perpetuo.vercel.app` e `dashboard.mettabrasil.com.br`. Confirmar `readyState: READY`. Deploys de prod paralelos se sobrescrevem (cada deploy é o app inteiro daquele tree) — consolidar e fazer um deploy só.
- **Cron (duplo):**
  - **GitHub Actions** `.github/workflows/refresh-cache.yml` — `0 * * * *` (horário). `POST /api/revalidate` com header `x-revalidate-secret`. **Mecanismo principal de frescor** (Vercel Hobby só permite 1 cron/dia).
  - **Vercel Cron** `vercel.json` — `0 11 * * *` (diário, backup). `GET /api/cron` com `Authorization: Bearer CRON_SECRET`.
  - Ambos chamam `refreshAllSheets()`. `maxDuration = 120`.
- **Endpoints de refresh:** `/api/revalidate` (POST, `REVALIDATE_SECRET`) e `/api/cron` (GET, aceita `CRON_SECRET` ou `REVALIDATE_SECRET`). Fora do matcher do middleware.
- **Env:** tudo no Vercel (Production) + secret `REVALIDATE_SECRET` no GitHub Actions. `vercel env pull .env.local` para rodar local. `.env*` e `.claude/` no `.gitignore`.
- **Vercel CLI não-interativo:** `vercel env add` via pipe grava VAZIO (lê do TTY) — setar secret via API REST do Vercel.

---

## 7. Replicar do zero (playbook)

1. **Setup:** `create-next-app` (Next 16, TS, Tailwind, App Router). `next.config.ts` → `cacheComponents: true`. `shadcn init` + primitivos (sidebar, popover, calendar, table, dropdown, …).
2. **Acesso à fonte:** Google Cloud → habilitar Sheets API → Service Account read-only → compartilhar a planilha com o e-mail da SA. Guardar `CLIENT_EMAIL`/`PRIVATE_KEY`/`SHEET_ID`.
3. **Camada de dados:** `sheets/client.ts` (JWT singleton) → `sheets/schemas.ts` (Zod + COLUMN_MAP por aba, conferindo offsets reais vs cabeçalho) → `sheets/parse.ts` (log-and-drop) → `sheets/read.ts` (ranges, batchGet, `readAllSheets`, `refreshAllSheets`).
4. **Cache:** Upstash Redis (REST). `cache/upstash.ts` com gzip + reviver de `Date`, TTL > intervalo do cron. Chaves `raw:<aba>`.
5. **Dedup:** `page-data.ts` — um loader `React.cache(async (sp) => calc(await readAllSheets(...), parseFilters(await sp)))` por página.
6. **Cálculo:** `calc/shared.ts` (helpers BRT, dedup, formatters) + uma função pura por página espelhando a lógica da planilha. Script de sanity comparando com uma aba de "Análise Geral" ao vivo.
7. **Filtros:** `filters.ts` (`parseFilters`, datas em BRT) + `MultiSelectFilter` serializando em searchParams.
8. **Páginas:** casca estática + seções em `<Suspense>` chamando os loaders. `PageShell` + sidebar shadcn `collapsible="icon"`.
9. **Auth:** Auth.js v5 (Google + Credentials), middleware protegendo tudo, store no Upstash com bcrypt, verificação de e-mail via Brevo single-sender.
10. **Tema:** `next-themes` + tokens claro/escuro em `globals.css`.
11. **Frescor:** cron externo (GitHub Actions horário) → `POST /api/revalidate`. Vercel Cron diário como backup.
12. **Deploy:** Vercel; um deploy de prod por vez; validar `READY`.

---

## 8. Decisões deliberadas e lições

- **Cache Upstash manual > `'use cache'`/Data Cache do Next** — entradas grandes e `cacheHandlers` custom não funcionam em serverless Vercel. Medições em [`audit-performance.md`](audit-performance.md).
- **Dados crus cacheados > resultados por filtro** — recalcular em memória é mais rápido que cachear permutações.
- **searchParams > estado client** — filtros viram URLs compartilháveis; back/forward funciona.
- **Funções puras de cálculo** — testáveis e validáveis contra a planilha sem subir a app.
- **Datas SEMPRE em BRT** — o bug recorrente é `new Date("YYYY-MM-DD")` virar UTC e perder o último dia; ancorar em `-03:00` no `parseFilters` e iterar dias em BRT no `eachDay`.
- **Cron no GitHub Actions** porque Vercel Hobby limita a 1/dia; o frescor real depende do workflow horário — não removê-lo.
- **COLUMN_MAP com offset** nas abas `vendas`/`sdr` — conferir índice real, não confiar no cabeçalho. Errar isso corrompe atribuição de vendas silenciosamente.
- **Um deploy de prod por vez** — deploys paralelos se sobrescrevem.
- **Mobile-first**: classes base = mobile; `sm:`/`lg:` restauram desktop; mudança mobile não pode regredir desktop (e vice-versa — overflow no wrapper da toolbar recortava dropdowns no desktop).
