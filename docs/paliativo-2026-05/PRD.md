# PRD — Dashboard Metta Paliativo

**Versão:** 1.0
**Status:** Rascunho para revisão
**Autor:** Alisson Oliveira (com apoio do assistente)
**Última atualização:** 2026-05-13

---

## 0. Histórico de versões

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-05-13 | Versão inicial do PRD, derivada do plano de execução |

---

## 1. Contexto e objetivo

### 1.1 Por que existe esse projeto

O time de marketing/comercial da Metta opera sobre uma planilha Google Sheets — **BASE DE DADOS - PALIATIVO - FUNIS PAGOS - JANEIRO 2026** (ID `1m_oCjgeMPfEaplFNvK0oLRwYR9yoS3AkYzWkO3uWXvY`) — que centraliza dados de tráfego pago (Meta Ads), captação de leads, pré-venda (SDR), fechamento (Vendas) e metas. A planilha hoje serve como fonte de dados e visualização ao mesmo tempo, com fórmulas pesadas (SUMIFS/COUNTIFS) gerando KPIs por funil em abas como "Análise Geral" e "Análise Tráfego".

Os problemas:

1. **Performance**: 50k+ linhas e dezenas de fórmulas matriciais deixam a planilha lenta.
2. **Visualização limitada**: Sheets não entrega a experiência de um dashboard moderno (gráficos ricos, navegação, filtros responsivos, mobile).
3. **Ergonomia de uso**: cada análise pede esforço (filtrar, navegar entre abas, interpretar tabelões).
4. **Manutenção frágil**: fórmulas IF aninhadas, dependência manual de nomes de campanha bem formados.

### 1.2 Objetivo

Construir um **dashboard interno em aplicação web** que:

- Lê os dados crus diretamente da planilha (sem migração para outro banco)
- Apresenta KPIs, gráficos e tabelas com a experiência do wireframe HTML em `/Users/alisson/Documents/dashboard metta paliativo/dashboard-wireframes.html`
- Permite filtrar dinamicamente por período e funil sem perda de performance
- Roda em produção sob domínio próprio, acessado pelo time
- Mantém o Google Sheets como **fonte única de verdade** (consistente com a decisão de não criar DB próprio nessa fase)

### 1.3 Critérios de sucesso (definição de "pronto")

1. As 7 páginas do wireframe estão implementadas e visualmente fiéis.
2. Filtros (período, funil) respondem em < 500ms após o cache estar quente.
3. Primeira carga do dia: < 2s para o usuário (cache pré-aquecido pelo Vercel Cron).
4. Os números do dashboard batem com os da planilha (margem 0%) em uma comparação cega.
5. Login Google funciona.
6. Deploy em domínio de produção.

### 1.4 Não-objetivos (v1)

- Edição de dados pelo dashboard (read-only)
- Sincronização com outros sistemas (HubSpot, Meta Ads API direto, etc.)
- Notificações/alertas automáticos (Slack, e-mail)
- Mobile-first (otimizado pra desktop primeiro, mobile só se sobrar tempo)
- Multi-tenant (uma instância só, dados da Metta)

---

## 2. Glossário

| Sigla | Significado |
|---|---|
| MQL | Marketing Qualified Lead (lead com qualificação MQL 1, MQL 2 ou Enterprise) |
| Enterprise | Lead qualificado de faturamento acima de R$ 4M e cargo decisor |
| SDR | Sales Development Representative — equipe de pré-venda que agenda reuniões |
| Closer | Equipe de fechamento que conduz a reunião com o lead qualificado |
| CPL | Custo por Lead (= Investimento ÷ Leads) |
| CMQL | Custo por MQL (= Investimento ÷ MQL) |
| Show | Taxa de comparecimento = Reuniões realizadas ÷ Reuniões agendadas |
| Tx prop. | Taxa de propostas enviadas ÷ Reuniões realizadas |
| Close | Taxa de fechamento = Vendas ÷ Propostas enviadas |
| Funil | Um dos 6 fluxos de aquisição: Sala, Aplicação, Sessão, Isca, Reality, ou "Todos" (união) |
| MTD | Month-to-date (acumulado do mês até a data atual) |
| ISR | Incremental Static Regeneration (Next.js) |
| SA | Service Account (Google Cloud) |

---

## 3. Stack e decisões técnicas

### 3.1 Stack

| Camada | Tecnologia | Versão | Justificativa |
|---|---|---|---|
| Framework | Next.js | 16+ (App Router) | Cache Components nativos, Server Components, deploy automático no Vercel |
| Linguagem | TypeScript | 5+ | Tipos estáticos, validação de schema da planilha |
| Estilo | Tailwind CSS | 4+ | Já usado no wireframe, integração nativa com shadcn |
| UI Kit | shadcn/ui | latest | Wireframe usa padrões shadcn (sidebar-08, popover, etc); permite customização total |
| Gráficos | Recharts | 2+ | Melhor docs, integração com shadcn `<Chart>` wrapper |
| Tabelas | TanStack Table | 8+ | Sort/filter/pagination prontos, headless (estilo via Tailwind) |
| Cliente Sheets | googleapis | latest | Cliente oficial Google, suporte completo à Sheets API v4 |
| Validação | Zod | 3+ | Schema runtime das colunas da planilha |
| Auth | Supabase Auth (`@supabase/ssr`) | latest | Google OAuth + Magic Link nativos; painel admin de usuários; free tier 50k MAU |
| Hospedagem | Vercel | — | Fluid Compute (timeout 800s+), Cron Jobs, ISR/Cache Components |
| Versionamento | GitHub | — | Push direto na `main`, Vercel deploya automaticamente |
| Testes | Vitest | latest | Mais rápido que Jest, integração com Next/TS |

### 3.2 Decisões deliberadas

| Decisão | Alternativa rejeitada | Por quê |
|---|---|---|
| **Cache Components (`use cache`)** | ISR / `unstable_cache` | Next 16 introduziu como padrão recomendado; invalidação fine-grained por tag |
| **Cachear dados crus, não calculados** | Cachear cada combinação de filtro | Combinações são quase infinitas; recálculo TS é < 50ms |
| **Filtros via URL search params** | State client-side | URLs compartilháveis, back/forward funciona, sem hydration mismatch |
| **Recharts** | Tremor | Mais maduro, melhor docs, menos opinativo |
| **Supabase Auth** | Auth.js v5 / Clerk | Magic Link nativo (sem provider de email separado); painel admin; configuração do Google OAuth via UI (5 min); free tier resolve; abre porta pra migrar Sheets→DB no v2 |
| **Sem DB próprio (v1)** | ETL pra Postgres | Já decidido pelo usuário: simplicidade e fonte única |
| **Solo + push direto na main** | Fluxo de PRs | Velocidade; Vercel já dá preview por commit |
| **Recharts + shadcn Chart wrapper** | Chart.js / Victory | shadcn fornece tema unificado |

---

## 4. Arquitetura de dados

### 4.1 Fluxo end-to-end

```
┌─────────────────────────────────────────────────────────────┐
│  Google Sheets — "BASE DE DADOS - PALIATIVO"                │
│  ID: 1m_oCjgeMPfEaplFNvK0oLRwYR9yoS3AkYzWkO3uWXvY            │
│  Abas-fonte: fb_todos, leads, sdr, vendas (+ Metas)         │
└─────────────────────────────────────────────────────────────┘
                            │
              Sheets API v4 (Service Account, read-only)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Vercel Function (Server Component / Route Handler)         │
│  - "use cache" directive                                    │
│  - cacheLife({ revalidate: 600, expire: 3600 })             │
│  - cacheTag('sheets-data')                                  │
│  - Lê só colunas necessárias (range A:R, A:AA, etc)         │
│  - Valida via Zod                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
            Cache em memória (Vercel edge, 10min freshness)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Camada de cálculo (lib/calc/*)                             │
│  - Funções puras TypeScript                                 │
│  - Recebem: rawData + filtros (date range, funis)           │
│  - Retornam: KPIs, agregações, séries pra gráfico           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Server Components renderizam a página                      │
│  - Filtros (Client Component) lêem/escrevem search params   │
│  - Mudança de filtro → re-render do servidor com cache hit  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                       Browser (HTML pronto)
```

### 4.2 Schemas das abas-fonte

#### 4.2.1 `fb_todos` (tráfego pago)

| # | Coluna | Tipo | Notas |
|---|---|---|---|
| A | Account Name | string | ex: "METTA - CA 01" |
| B | Day | date | dd/mm/yyyy ou número serial Sheets |
| C | Campaign Name | string | **filtro principal**: contém marcadores `PERP\|CAPT\|<funil>\|<temperatura>` |
| D | Ad Set Name | string | |
| E | Ad Name | string | |
| F | Alcance | number | |
| G | Impressions | number | |
| H | Link Clicks | number | |
| I | Landing Page Views | number | |
| J | Leads | number | (do Meta, não usado pra cálculo; usar `leads` aba) |
| K | Visitas ao Perfil | number | |
| L | Seguidores | number | |
| M | Vídeo 3s | number | |
| N | Vídeo 25% | number | |
| O | Vídeo 95% | number | |
| P | Checkouts | number | |
| Q | Compras | number | |
| R | Amount Spent | currency (string com vírgula) | **investimento; converter "6,38" → 6.38** |

**Range a ler:** `fb_todos!A:R` (18 colunas).
**Volume atual:** ~51.000 linhas. Cresce diariamente.

#### 4.2.2 `leads` (captação)

| # | Coluna | Tipo | Notas |
|---|---|---|---|
| A | data de inscrição | date | original do form |
| B | Nome | string | |
| C | e-mail | string | |
| D | Telefone | string | pode vir como "p:+5524..." (HubSpot) |
| E | cargo | string | ver §5.1.4 (valores possíveis) |
| F | faturamento | string | ver §5.1.5 (10 faixas) |
| G | Seguemento de mercado | string | ver §5.1.6 (note typo no header original) |
| H | qualificação | string | **chave**: "MQL 1", "MQL 2", "Enterprise" (ou "Interprise" — variação histórica), "No ICP", "Interprise" |
| I | funil | string | **chave**: "Sala Secreta", "Sessão Estratégica", "Diagnóstico", "Aplicação", "Isca", "Reality" |
| J | utm_source | string | ex: "ig", "fb", "MetaAds_Adv" |
| K | utm_medium | string | ex: "paid", "3% Alunos Mentoria Meta Batida" |
| L | utm_campaign | string | nome longo |
| M | utm_id | string | |
| N | utm_content | string | |
| O | utm_term | string | |
| P | Data de inscrição | date | **versão normalizada (DATE), usar essa pra filtro** |

**Range a ler:** `leads!A:P` (16 colunas).
**Volume:** ~35.000 linhas.

#### 4.2.3 `sdr` (pré-venda)

| # | Coluna | Tipo | Notas |
|---|---|---|---|
| A | Data de agendamento | date | quando o SDR criou o agendamento |
| B | Data da reunião | date | quando a reunião está/foi marcada |
| C | Quem agendou? | string | nome do SDR |
| D | Responsável da Reunião | string | nome do Closer |
| E | Qualificação | string | "Q1", "Q2", etc. (qualificação interna do SDR, diferente da coluna H de leads) |
| F | Lead | string | nome do lead |
| G | Cargo | string | |
| H | Email | string | join key com `leads` |
| I | Origem | string | "Perpétuo", "LANÇAMENTO", etc. |
| J | Funil | string | "Sessão Estratégica", "Sala", "Aplicação", etc. |
| K | Status | string | **chave**: "Realizada", "No-show", "Reagendada", "Cancelada", ou vazio |
| L | Houve envio de proposta? | string | "Sim", "Fechada", "Recusada" (proposta enviada); outros valores ou vazio = não |
| M | Valor da proposta? | currency | |
| N-AB | dados copiados de leads (snapshot) | — | data de inscrição, Nome, Telefone, cargo, faturamento, segmento, qualificação, funil, utm_*  |

**Range a ler:** `sdr!A:AB` (28 colunas).
**Volume:** ~3.000 linhas.

#### 4.2.4 `vendas` (fechamento)

| # | Coluna | Tipo | Notas |
|---|---|---|---|
| A | Nome do comprador | string | |
| B | Empresa | string | |
| C | Email | string | join key |
| D | Valor do contrato | currency | **chave: faturamento** — formato "R$ 11.200,00" |
| E | Data estimada de entrada na base | date | |
| F | Data de aceite de proposta | date | **chave**: usada pra "Aceites" |
| G | Data de criação de contrato | date | |
| H | Data de assinatura de contrato | date | |
| I | Cargo do comprador | string | |
| J | Origem do funil de compra | string | |
| K | Funil de compra | string | **chave**: filtro de funil ("Sessão Estratégica", "Aplicação", etc., "Up-sell" também aparece) |
| L | Produto | string | "Mentoria", "Up-sell", etc. |
| M | Pix de aceite de proposta | string | |
| N | Forma de pagamento | string | "Pix", "Cartão 12x", "Boleto", etc. |
| O | Data de compra | date | **chave**: usada pra "Vendas" e "Faturamento" |
| P-AC | dados copiados de leads (snapshot) | — | mesmos campos UTM/perfil |

**Range a ler:** `vendas!A:AC` (29 colunas).
**Volume:** ~1.000 linhas.

#### 4.2.5 `Metas` (a criar — não existe ainda)

Aba a criar pelo usuário antes de implementar a página "Metas vs Realizado". Estrutura proposta:

| # | Coluna | Tipo | Notas |
|---|---|---|---|
| A | Mês | date | primeiro dia do mês (ex: 2026-05-01) |
| B | Funil | string | "Sala", "Aplicação", "Sessão", "Isca", "Reality", "Todos" |
| C | Métrica | string | "Investimento", "MQL", "CMQL", "Agendamentos", "Reuniões agendadas", "Reuniões realizadas", "Vendas", "Conversão", "Faturamento" |
| D | Valor | number/currency | meta absoluta do mês |

**Comportamento month-to-date:** a aplicação calcula a meta proporcional ao número de dias do filtro. Ex: meta R$ 30.000 em mês de 30 dias, filtro 1-14 → meta = R$ 14.000.

#### 4.2.6 Schemas Zod consolidados

Toda leitura da planilha passa por validação Zod. Erro de schema = rejeição com mensagem clara (NÃO ignorar silenciosamente). Tipos derivados via `z.infer<typeof schema>`.

```typescript
// lib/sheets/schemas.ts
import { z } from 'zod';

// Helpers ---------------------------------------------------------------------

/** Converte "6,38" | 6.38 | "" | null → number. Vazio/inválido → 0. */
const zCurrency = z.union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const cleaned = v.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  });

/** Converte número inteiro/string → number. Vazio → 0. */
const zInt = z.union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === '') return 0;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
  });

/** Converte "01/05/2026" | serial number Sheets | ISO string → Date. Vazio/inválido → null. */
const zDate = z.union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      // Sheets serial: dias desde 1899-12-30
      const ms = (v - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const str = String(v).trim();
    // dd/mm/yyyy
    const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      const [, d, m, y] = br;
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T03:00:00.000Z`);
    }
    // ISO (yyyy-mm-dd...)
    const iso = new Date(str);
    return Number.isNaN(iso.getTime()) ? null : iso;
  });

const zString = z.union([z.string(), z.number(), z.null()])
  .transform((v) => (v == null ? '' : String(v).trim()));

// Schemas ---------------------------------------------------------------------

export const FbTodosRowSchema = z.object({
  accountName: zString,            // A
  day:         zDate,              // B — DATA-CHAVE pra Investimento
  campaignName: zString,           // C — filtro de funil/temperatura
  adSetName:   zString,            // D
  adName:      zString,            // E
  alcance:     zInt,               // F
  impressions: zInt,               // G
  linkClicks:  zInt,               // H
  landingPageViews: zInt,          // I
  leadsMeta:   zInt,               // J (do Meta — não usar pra cálculo)
  visitasPerfil: zInt,             // K
  seguidores:  zInt,               // L
  video3s:     zInt,               // M
  video25:     zInt,               // N
  video95:     zInt,               // O
  checkouts:   zInt,               // P
  compras:     zInt,               // Q
  amountSpent: zCurrency,          // R — INVESTIMENTO
});
export type FbTodosRow = z.infer<typeof FbTodosRowSchema>;

export const LeadRowSchema = z.object({
  dataInscricaoOriginal: zDate,    // A
  nome:          zString,          // B
  email:         zString.transform((s) => s.toLowerCase()), // join key normalizado
  telefone:      zString,          // D
  cargo:         zString,          // E
  faturamento:   zString,          // F
  segmento:      zString,          // G ("Seguemento" — typo na planilha)
  qualificacao:  zString,          // H — chave (MQL 1/2/Enterprise/Interprise/No ICP)
  funil:         zString,          // I — chave
  utmSource:     zString,          // J
  utmMedium:     zString,          // K
  utmCampaign:   zString,          // L
  utmId:         zString,          // M
  utmContent:    zString,          // N
  utmTerm:       zString,          // O
  dataInscricao: zDate,            // P — DATA-CHAVE normalizada
});
export type LeadRow = z.infer<typeof LeadRowSchema>;

export const SdrRowSchema = z.object({
  dataAgendamento: zDate,          // A — DATA-CHAVE pra "Agendamentos"
  dataReuniao:     zDate,          // B — DATA-CHAVE pra "Reuniões"
  quemAgendou:     zString,        // C — nome do SDR
  responsavel:     zString,        // D — nome do Closer
  qualificacaoSdr: zString,        // E — Q1/Q2 (interno SDR)
  lead:            zString,        // F
  cargo:           zString,        // G
  email:           zString.transform((s) => s.toLowerCase()),
  origem:          zString,        // I
  funil:           zString,        // J — chave
  status:          zString,        // K — chave (Realizada/No-show/etc)
  envioProposta:   zString,        // L — Sim/Fechada/Recusada/vazio
  valorProposta:   zCurrency,      // M
  // N-AB: snapshot de leads (mesmo schema da aba leads, suffixo "Snap")
  dataInscricaoSnap: zDate,
  nomeSnap:        zString,
  telefoneSnap:    zString,
  cargoSnap:       zString,
  faturamentoSnap: zString,
  segmentoSnap:    zString,
  qualificacaoSnap: zString,
  funilSnap:       zString,
  utmSourceSnap:   zString,
  utmMediumSnap:   zString,
  utmCampaignSnap: zString,
  utmIdSnap:       zString,
  utmContentSnap:  zString,
  utmTermSnap:     zString,
});
export type SdrRow = z.infer<typeof SdrRowSchema>;

export const VendaRowSchema = z.object({
  nomeComprador:   zString,        // A
  empresa:         zString,        // B
  email:           zString.transform((s) => s.toLowerCase()),
  valorContrato:   zCurrency,      // D — CHAVE: faturamento
  dataEntradaBase: zDate,          // E
  dataAceite:      zDate,          // F — DATA-CHAVE pra "Aceites"
  dataCriacaoContrato: zDate,      // G
  dataAssinatura:  zDate,          // H
  cargoComprador:  zString,        // I
  origemFunil:     zString,        // J
  funilCompra:     zString,        // K — chave
  produto:         zString,        // L
  pixAceite:       zString,        // M
  formaPagamento:  zString,        // N
  dataCompra:      zDate,          // O — DATA-CHAVE pra "Vendas" e "Faturamento"
  // P-AC: snapshot de leads
  dataCadastroSnap: zDate,
  nomeSnap:         zString,
  telefoneSnap:     zString,
  cargoSnap:        zString,
  faturamentoSnap:  zString,
  segmentoSnap:     zString,
  qualificacaoSnap: zString,
  funilSnap:        zString,
  utmSourceSnap:    zString,
  utmMediumSnap:    zString,
  utmCampaignSnap:  zString,
  utmIdSnap:        zString,
  utmContentSnap:   zString,
  utmTermSnap:      zString,
});
export type VendaRow = z.infer<typeof VendaRowSchema>;

export const MetaRowSchema = z.object({
  mes:     zDate,                  // primeiro dia do mês
  funil:   zString,                // "Sala" | "Aplicação" | "Sessão" | "Isca" | "Reality" | "Todos"
  metrica: zString,                // "Investimento" | "MQL" | "Faturamento" | ...
  valor:   zCurrency,
});
export type MetaRow = z.infer<typeof MetaRowSchema>;
```

#### 4.2.7 Parser e validação

```typescript
// lib/sheets/parse.ts
const HEADER_ROW = 1; // dados começam na linha 2

export function parseSheetData<S extends z.ZodTypeAny>(
  schema: S,
  values: unknown[][],
  columnMap: Record<string, number>,
  context: { tab: string }
): z.infer<S>[] {
  if (!values || values.length < 2) return [];
  const rows = values.slice(HEADER_ROW);
  const errors: string[] = [];
  const parsed = rows.map((row, idx) => {
    const obj: Record<string, unknown> = {};
    for (const [key, colIdx] of Object.entries(columnMap)) {
      obj[key] = row[colIdx] ?? null;
    }
    const result = schema.safeParse(obj);
    if (!result.success) {
      errors.push(`[${context.tab}] linha ${idx + 2}: ${result.error.message}`);
      return null;
    }
    return result.data;
  }).filter((x): x is z.infer<S> => x !== null);

  if (errors.length > 0) {
    console.warn(`[parse] ${errors.length} linhas rejeitadas`, errors.slice(0, 5));
    // Não falha o request — registra e segue. Erro fatal só se 0 linhas válidas.
  }
  if (parsed.length === 0 && rows.length > 0) {
    throw new Error(`[${context.tab}] todas as ${rows.length} linhas falharam validação. Verifique schema.`);
  }
  return parsed;
}
```

**Decisão deliberada:** linhas inválidas são **logadas e descartadas**, não fazem o request inteiro falhar. Apenas se 0 linhas passam é erro fatal — sinaliza schema drift grave.

### 4.3 Estratégia de cache

#### 4.3.1 Cache de dados crus

Cada aba é cacheada independentemente:

```typescript
// lib/sheets/read.ts
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache';

export async function readSheet(tab: 'fb_todos' | 'leads' | 'sdr' | 'vendas' | 'Metas') {
  'use cache';
  cacheLife({ revalidate: 600, expire: 3600 }); // 10 min fresh, 1h stale
  cacheTag('sheets-data', `sheets-${tab}`);

  const range = RANGES[tab]; // 'fb_todos!A:R', etc
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return parseAndValidate(tab, data.values); // Zod
}
```

#### 4.3.2 Revalidação proativa (Vercel Cron)

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/refresh-sheets", "schedule": "*/10 * * * *" }
  ]
}
```

```typescript
// app/api/cron/refresh-sheets/route.ts
import { revalidateTag } from 'next/cache';

export async function GET(req: Request) {
  // Vercel envia header de auth automático em produção
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  revalidateTag('sheets-data');
  return Response.json({ ok: true, at: new Date().toISOString() });
}
```

**Resultado:** usuário nunca paga o fetch caro. Cache fresco a cada 10 min.

#### 4.3.3 Detalhes operacionais do cache

**`cacheLife` — semântica:**
- `revalidate: 600` (10 min) → após 10 min, próxima request **dispara revalidação em background** e ainda serve o cache antigo (stale-while-revalidate).
- `expire: 3600` (1h) → após 1h sem revalidação bem-sucedida, cache **expira de vez**. Próxima request é forçada a buscar (síncrono).
- Cron a cada 10 min mantém `revalidate` sempre satisfeito → usuário nunca espera fetch.

**Tamanho em memória:**
- `fb_todos` parsed (~51k linhas × 18 campos): estimativa ~15-25 MB
- `leads` (~35k × 16): ~10-15 MB
- `sdr` (~3k × 28): ~1 MB
- `vendas` (~1k × 29): <1 MB
- **Total cacheado por região:** ~30-45 MB. Limite Vercel: 2 GB de cache por projeto. Folga enorme.

**Hierarquia de cache no Next 16:**
- `readSheet()` é cacheado **por argumento** (`tab`). Funções com argumentos diferentes têm entradas distintas.
- Server Components que chamam `readSheet` herdam o cache (não criam nível adicional).
- Cálculos puros (`calcVisaoGeral`) NÃO devem ter `'use cache'` — rápidos demais (microsegundos) e dependem de filtros que mudam por request.

**Em desenvolvimento (`pnpm dev`):**
- Cache Components em dev **revalida em cada request** por padrão (Hot Reload friendly).
- Pra simular cache em dev: `NEXT_CACHE_COMPONENTS_IN_DEV=true` (env local).
- Pra invalidar manualmente: `curl -X POST http://localhost:3000/api/revalidate -H "x-revalidate-secret: $SECRET"`.

**Build (CI/preview deploys):**
- Build do Next executa render estático/dinâmico. Se Sheets API estiver inacessível durante o build, a função `readSheet` falha → build falha.
- **Mitigação:** marcar páginas como `export const dynamic = 'force-dynamic'` ou tratar erro de Sheets durante build (retornar dados vazios + flag). Ver §14.
- Para builds em PRs (preview deploy), env vars são herdadas se configuradas como "Preview" no Vercel.

**Comportamento com Suspense / streaming:**
- Server Component que chama `readSheet()` dentro de `<Suspense>` permite streaming — o resto da página renderiza enquanto os dados carregam.
- Skeleton/Loading state pode ser servido instantaneamente.

**Concorrência (múltiplos usuários, cache vazio):**
- Cache Components **deduplica** chamadas idênticas dentro do mesmo request lifecycle.
- Entre requests, se 5 usuários abrem simultaneamente com cache vazio:
  - O Next.js NÃO deduplica entre requests por padrão.
  - Cada um pode disparar fetch da Sheets. Mitigação: cron warmup + `expire` mais alto (1h) garante que sempre tem cache, mesmo stale.

**Cache em dev local + produção: divergência:**
- Em dev, sempre fresh (revalida toda request). Em prod, segue `cacheLife`. **Sempre testar comportamento de cache em preview deploy antes de promover.**

#### 4.3.4 Endpoint manual de revalidação

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const secret = req.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const tag = url.searchParams.get('tag') ?? 'sheets-data';
  revalidateTag(tag);
  return NextResponse.json({ ok: true, tag, at: new Date().toISOString() });
}
```

Útil em dev pra forçar refresh; em prod pra debugar problemas de cache stale.

#### 4.3.5 Mapeamento aba → página (lazy load)

| Página | Abas necessárias |
|---|---|
| Visão Geral | fb_todos, leads, sdr, vendas |
| Metas vs Realizado | mesmo + Metas |
| Tráfego Pago | fb_todos, leads |
| Anúncios | fb_todos, leads, vendas |
| Comercial SDR | leads, sdr |
| Comercial Closer | sdr, vendas |
| Origem | leads, sdr, vendas |

Cada página chama `readSheet(...)` apenas para o que precisa.

#### 4.3.6 Cache Components: detalhes críticos (Next.js 16+)

**Habilitar Cache Components no `next.config.ts`** — obrigatório pra que `'use cache'` funcione:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
};
export default nextConfig;
```

Sem isso, `'use cache'` é silenciosamente ignorado.

**Runtime data constraint — REGRA CRÍTICA:**

Funções/componentes marcados com `'use cache'` **NÃO podem chamar** `cookies()`, `headers()` ou acessar `searchParams`. Tentativa = erro de build.

**Estratégia adotada no dashboard:**

- `readSheet(tab)` — sem cookies/headers. Apenas argumento `tab`. **Cacheável.**
- `calcVisaoGeral(rawData, filters)` — função pura. Não cacheada (rápida, depende dos filtros que mudam por request).
- Componentes que dependem do usuário logado (`<UserInfo />`, `<StaleBanner />`) — chamam `cookies()` via Supabase. **NÃO cacheáveis.**

**Hierarquia sugerida:**

```tsx
// app/(dashboard)/page.tsx — Server Component, NÃO cacheado
import { Suspense } from 'react';

export default async function VisaoGeralPage({ searchParams }) {
  const filters = parseFilters(await searchParams);
  return (
    <>
      {/* Dados crus do cache (cacheável) */}
      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards filters={filters} />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <TabelaDiaria filters={filters} />
      </Suspense>
    </>
  );
}

// Server Component dentro de Suspense — usa cache via readSheet
async function KpiCards({ filters }) {
  const data = await readAllSheets(['fb_todos', 'leads', 'sdr', 'vendas']); // cacheada
  const result = calcVisaoGeral(data, filters); // cálculo puro, não cacheado
  return <div>{/* render */}</div>;
}
```

**Página /dashboard NÃO marcada com `'use cache'`** porque depende de `searchParams` (filtros) e indiretamente de cookies (auth no middleware). Apenas as **funções de leitura** (`readSheet`/`readAllSheets`) são cacheadas.

**Distinção `revalidateTag` vs `updateTag`:**

| Função | Quando | Uso no dashboard |
|---|---|---|
| `revalidateTag('sheets-data')` | Background, próxima request vê fresh | **Cron a cada 10 min** + endpoint manual de debug |
| `updateTag('sheets-data')` | Síncrono, mesma request vê fresh | Não usado v1 (não temos mutations) |

**Profiles built-in disponíveis:**

| Profile | Stale | Revalidate | Uso típico |
|---|---|---|---|
| `'default'` | 5min | 15min | curto prazo |
| `'minutes'` | 1min | 5min | quase-realtime |
| `'hours'` | 1h | 24h | quase-estático |
| `'days'` | 24h | 7d | conteúdo público |
| `'weeks'` | 7d | 30d | docs |
| `'max'` | nunca | manual | conteúdo imutável |

**Decisão:** usar `cacheLife({ revalidate: 600, expire: 3600 })` (inline, custom) em vez de profile built-in. Razão: 10 min revalidate é entre `'default'` (15 min) e `'minutes'` (5 min) — sweet spot pro caso.

**`'use cache: private'`** — disponível pra cachear conteúdo dependente de cookies/headers, mas **NÃO usar v1**. Adiciona complexidade desnecessária; cálculos no servidor já são rápidos sem cache adicional.

**Edge runtime não suportado por Cache Components.** Deploy em Node.js runtime (Vercel default). NÃO usar `export const runtime = 'edge'` em rotas com `'use cache'`.

**Build-time vs runtime:**
- Funções `'use cache'` chamadas em pre-render do build → executadas no build, valor cacheado.
- Se Sheets API falha no build → build falha (a menos que página seja marcada com fallback).
- **Mitigação:** páginas do dashboard NÃO são pre-renderizadas (são dinâmicas, dependem de searchParams). Build não chama `readSheet`. Cron warmup popula cache em runtime depois do deploy.

### 4.4 Estratégia detalhada de leitura da Sheets API

#### 4.4.1 Cliente autenticado

```typescript
// lib/sheets/client.ts
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

export const sheets = google.sheets({ version: 'v4', auth });
```

**Nota crítica:** `GOOGLE_SHEETS_PRIVATE_KEY` armazenado no Vercel preserva `\n` literais. O `.replace(/\\n/g, '\n')` converte de volta. Sem isso, JWT signing falha com erro críptico.

#### 4.4.2 Ranges otimizados

```typescript
const RANGES = {
  fb_todos: 'fb_todos!A:R',  // 18 colunas (corta colunas vazias S-Z)
  leads:    'leads!A:P',     // 16 colunas
  sdr:      'sdr!A:AB',      // 28 colunas
  vendas:   'vendas!A:AC',   // 29 colunas
  Metas:    'Metas!A:D',     // 4 colunas
} as const;
```

**Por que limitar ao range específico:**
- Sheets API tem limite de **10 MB por response**. Range `A:Z` em `fb_todos` com 51k linhas × 26 colunas pode estourar (ler 10 colunas a mais é ~25% mais payload).
- Latência cresce linearmente com tamanho da response.
- Algumas colunas (S-Z em `fb_todos`) podem ter dados de teste ou métricas obsoletas.

#### 4.4.3 Estratégia de leitura paralela (batchGet)

Pra páginas que precisam de múltiplas abas (ex: Visão Geral usa 4):

```typescript
// lib/sheets/read.ts
export async function readAllSheets(tabs: Tab[]): Promise<Record<Tab, unknown[][]>> {
  'use cache';
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag('sheets-data');

  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
    ranges: tabs.map((t) => RANGES[t]),
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const result = {} as Record<Tab, unknown[][]>;
  data.valueRanges?.forEach((vr, i) => {
    result[tabs[i]] = vr.values ?? [];
  });
  return result;
}
```

**Vantagem do `batchGet`:** 1 request HTTP em vez de N. Latência total ≈ max(latência individual), não soma.

#### 4.4.4 Opções de leitura

| Opção | Valor | Por quê |
|---|---|---|
| `valueRenderOption` | `'UNFORMATTED_VALUE'` | Retorna número puro em vez de string formatada. CPU mais barata no parse. |
| `dateTimeRenderOption` | `'FORMATTED_STRING'` | Retorna data como string "01/05/2026". Numérico (serial) também funciona — schema Zod aceita ambos. |
| `majorDimension` | `'ROWS'` (default) | Cada item do array externo = uma linha. |

#### 4.4.5 Timeout e retry

```typescript
const MAX_RETRIES = 2;
const BASE_TIMEOUT_MS = 30_000; // 30s

async function fetchWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const start = Date.now();
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`[${label}] timeout after ${BASE_TIMEOUT_MS}ms`)), BASE_TIMEOUT_MS)
        ),
      ]);
      console.log(`[sheets] ${label} ok`, { attempt, durationMs: Date.now() - start });
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[sheets] ${label} fail attempt ${attempt}`, err);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}
```

**Política:**
- Timeout por tentativa: 30s
- Retries: 2 (total 3 tentativas)
- Backoff: linear (1s, 2s)
- Erro 429 (quota): retry com backoff maior (5s, 15s) — detectar pela `err.response.status`
- Erro 401/403 (auth): NÃO retry — flag fatal

#### 4.4.6 Detecção de mudança (otimização opcional v2)

Sheets API expõe `spreadsheets.get(... fields='properties.title,sheets.properties')` que retorna metadados rápidos. **Mas NÃO expõe `modifiedTime` por aba**. Pra detectar mudança real:

- **Opção A:** Google Drive API → `files.get(fileId, fields='modifiedTime')` — retorna em ms desde epoch. Comparar com último timestamp armazenado. Se igual, pular fetch. **Tradeoff:** adiciona 1 request leve antes de cada cron, mas economiza fetch caro quando planilha não mudou.
- **Opção B (v2):** Apps Script no Sheets dispara webhook pro Vercel em `onEdit`. Eficiente mas precisa manter script Apps Script.

**Decisão v1:** Não implementar. Cron a cada 10 min é simples e custo da Sheets API é zero. Reavaliar se quota virar problema.

#### 4.4.7 Quotas Sheets API v4

- **Quota por projeto:** 300 requests/min (read) — Google Cloud Console
- **Quota por usuário/SA:** 60 requests/min — começamos com 1 SA, default suficiente
- **Quota diária:** ilimitada pra leitura

Com cron a cada 10 min lendo 4 abas em batchGet: **1 request/10min = 6/hora = 144/dia**. Folga absurda (0.05% da quota).

Se virar problema (ex: dev local + preview + prod compartilhando SA): criar SA separada por ambiente.

---

## 5. Cálculos e lógica de negócio

> **Esta seção é a mais crítica do PRD.** Cada KPI/métrica do dashboard tem que mapear 1:1 com a planilha. Bugs aqui = perda de confiança no produto.

### 5.1 Filtros base (compartilhados entre páginas)

#### 5.1.1 Filtro por funil

A planilha trata o filtro de funil como **substring no Campaign Name** (`fb_todos.C`) e **valor da coluna `funil`** (em `leads.I`, `sdr.J`, `vendas.K`).

```typescript
// lib/calc/shared.ts
type Funil = 'sala' | 'aplica' | 'sessao' | 'isca' | 'reality' | 'todos';

const FUNIL_CAMPAIGN_MARKERS: Record<Funil, string[]> = {
  sala:    ['PERP', 'CAPT', 'SALA'],
  aplica:  ['PERP', 'CAPT', 'APLICA'],
  sessao:  ['PERP', 'CAPT', 'SESSAO'],
  isca:    ['PERP', 'CAPT', 'ISCA'],
  reality: ['PERP', 'CAPT', 'REALITY'],
  todos:   ['PERP', 'CAPT'],
};

const FUNIL_LEAD_PATTERNS: Record<Funil, RegExp> = {
  sala:    /sala/i,
  aplica:  /aplica/i,
  sessao:  /sessão|sessao|diagn/i, // Sessão = Sessão + Diagnóstico
  isca:    /isca/i,
  reality: /real/i,
  todos:   /sala|aplica|sessão|sessao|diagn|isca|real/i,
};

export function filterFbTodosByFunil(rows: FbTodosRow[], funis: Funil[]): FbTodosRow[] {
  return rows.filter(r =>
    funis.some(f => FUNIL_CAMPAIGN_MARKERS[f].every(m => r.campaignName.includes(m)))
  );
}

export function filterLeadsByFunil(rows: LeadRow[], funis: Funil[]): LeadRow[] {
  return rows.filter(r => funis.some(f => FUNIL_LEAD_PATTERNS[f].test(r.funil)));
}
```

**Casos especiais:**
- **Sessão** sempre inclui leads/SDR/vendas cuja coluna `funil` contém "Sessão" OU "Diagnóstico" (operação histórica).
- **Todos** = união. NÃO é um valor separado da planilha; é cliente-side.
- A campanha precisa ter `PERP` (Perpétuo) E `CAPT` (Captação) E o marcador do funil. Sem isso, ignora (filtra fora lançamentos, distribuição, engajamento).

#### 5.1.2 Filtro por data

Cada origem tem coluna de data diferente:

| Métrica | Coluna usada |
|---|---|
| Investimento | `fb_todos.B` (Day) |
| Leads | `leads.P` (Data de inscrição normalizada) |
| MQL | `leads.P` |
| Agendamentos | `sdr.A` (Data de agendamento) |
| Reuniões agendadas | `sdr.B` (Data da reunião) |
| Reuniões realizadas | `sdr.B` |
| Propostas | `sdr.B` |
| Aceites | `vendas.F` (Data de aceite) |
| Vendas | `vendas.O` (Data de compra) |
| Faturamento | `vendas.O` |

#### 5.1.3 Filtro por qualificação (apenas leads MQL)

```typescript
const MQL_PATTERNS = /mql|inter|enterprise/i;
const MQL1_PATTERNS = /1|inter|enterprise/i; // MQL 1 inclui Enterprise/Interprise
const MQL2_PATTERNS = /2/;

export function isMql(qualificacao: string): boolean {
  return MQL_PATTERNS.test(qualificacao);
}
```

#### 5.1.4 Valores de cargo (do form-sessao-v3)

```typescript
const CARGOS_DECISORES = ['Empresário', 'Sócio', 'CEO', 'Diretor de vendas'];
const CARGOS_NAO_DECISORES = ['Gerente', 'Outros'];
const TODOS_CARGOS = [...CARGOS_DECISORES, ...CARGOS_NAO_DECISORES];
```

#### 5.1.5 Valores de faturamento (10 faixas, do form)

```typescript
const FATURAMENTO_FAIXAS = [
  'Até 50 mil',
  'De 51 mil a 70 mil',
  'De 71 mil a 100 mil',
  'De 101 mil a 200 mil',
  'De 201 mil a 300 mil',
  'De 301 mil a 500 mil',
  'De 501 mil a 700 mil',
  'De 701 mil a 1 milhão',
  'De 1 milhão a 4 milhões',
  'Acima de 4 milhões',
];

const QUALIFICACAO_POR_FATURAMENTO: Record<string, 'Enterprise' | 'MQL 1' | 'MQL 2' | 'No ICP'> = {
  'Acima de 4 milhões':       'Enterprise',
  'De 1 milhão a 4 milhões':  'MQL 1',
  'De 701 mil a 1 milhão':    'MQL 1',
  'De 501 mil a 700 mil':     'MQL 1',
  'De 301 mil a 500 mil':     'MQL 1',
  'De 201 mil a 300 mil':     'MQL 1',
  'De 101 mil a 200 mil':     'MQL 2',
  'De 71 mil a 100 mil':      'No ICP',
  'De 51 mil a 70 mil':       'No ICP',
  'Até 50 mil':               'No ICP',
};
```

A qualificação real do lead também depende do cargo: se cargo ∉ decisores → "No ICP" independente do faturamento.

#### 5.1.6 Valores de segmento (do form)

```typescript
const SEGMENTOS = ['Indústria', 'Varejo', 'Serviços', 'Tecnologia', 'Agronegócio', 'Marketing'];
```

#### 5.1.7 Timezone e normalização de datas

**Premissa:** todas as datas da operação Metta são em **America/Sao_Paulo (UTC-3)**. Mas a Sheets API retorna datas como string ou número sem timezone explícito.

```typescript
// lib/calc/shared.ts
export const TZ = 'America/Sao_Paulo';

/** Normaliza data pra início do dia em BRT (UTC-3). */
export function startOfDayBrt(d: Date): Date {
  // converte instante pra "dia" do calendário BR, retorna 00:00 BR (= 03:00 UTC)
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return new Date(`${iso}T00:00:00-03:00`);
}

/** Comparação de dia (ignora hora/timezone). */
export function isSameDayBrt(a: Date, b: Date): boolean {
  return startOfDayBrt(a).getTime() === startOfDayBrt(b).getTime();
}

/** Filtro inclusivo: data >= from E data <= to (ambos em BRT). */
export function filterByDate<T>(rows: T[], getDate: (r: T) => Date | null, from: Date, to: Date): T[] {
  const f = startOfDayBrt(from).getTime();
  const t = startOfDayBrt(to).getTime() + 24 * 60 * 60 * 1000 - 1; // 23:59:59.999 BRT
  return rows.filter((r) => {
    const d = getDate(r);
    if (!d) return false;
    const ts = d.getTime();
    return ts >= f && ts <= t;
  });
}
```

**Por que isso importa:**
- Sheets retorna "01/05/2026" sem timezone. Parsing default JS interpreta como UTC → fica 1 dia antes no fuso BR.
- Filtros do dashboard são em datas brasileiras. Sem normalização, dia 01/05 inclui vendas de 30/04 noite.
- Métricas diárias agregadas por dia BR, não UTC.

#### 5.1.8 Deduplicação de leads

Um mesmo email pode aparecer múltiplas vezes em `leads` (preencheu form duas vezes, ou em funis diferentes). Política:

```typescript
/** Dedupe por email, mantendo a entrada mais recente (data de inscrição). */
export function dedupeLeadsByEmail(leads: LeadRow[]): LeadRow[] {
  const map = new Map<string, LeadRow>();
  for (const lead of leads) {
    if (!lead.email) continue;
    const existing = map.get(lead.email);
    if (!existing || (lead.dataInscricao && existing.dataInscricao && lead.dataInscricao > existing.dataInscricao)) {
      map.set(lead.email, lead);
    }
  }
  return Array.from(map.values());
}
```

**Decisão deliberada:**
- Dedupe SÓ quando contar **leads únicos** (KPI "Leads", "MQL"). NÃO dedupe quando o objetivo é "quantos preencheram form" (raro — não está no v1).
- Mantém a mais recente porque a qualificação atual reflete o estado mais novo (lead pode ter mudado de cargo/faturamento).

**Edge cases:**
- Email vazio: ignorado (não conta).
- Email com case diferente: schema já normaliza pra lowercase no parse.
- Email malformado (ex: "p:+5511..."): conta mesmo assim — `leads.email` é coluna livre, validação fica fora.

#### 5.1.9 Join lead × sdr × vendas

Múltiplas abas compartilham o **email** como chave de junção.

```typescript
/** Constrói índice email → lead. */
export function indexLeadsByEmail(leads: LeadRow[]): Map<string, LeadRow> {
  const idx = new Map<string, LeadRow>();
  for (const l of leads) {
    if (l.email) idx.set(l.email, l);
  }
  return idx;
}

/** Join SDR row → lead correspondente (pode retornar null). */
export function joinSdrWithLead(sdr: SdrRow, leadIdx: Map<string, LeadRow>): LeadRow | null {
  return leadIdx.get(sdr.email) ?? null;
}
```

**Edge cases:**
- SDR/venda sem email correspondente em leads → lead = null. Métricas por origem (UTM, cargo) usam o **snapshot** que está em SDR/vendas (colunas N-AB em SDR, P-AC em vendas).
- Lead mudou de email entre inscrição e venda → não joina. Tratar como dois leads distintos (limitação aceita do v1).

#### 5.1.10 Reagendamento de reuniões

Quando SDR muda `dataReuniao` (coluna B), a planilha sobrescreve o valor. Implicação:

- **Não há histórico de "esta reunião foi reagendada".**
- Métricas de "Reuniões agendadas no dia X" usam o valor ATUAL de `dataReuniao`. Se foi reagendada de 05/05 pra 10/05, conta em 10/05.
- Métricas de "Agendamentos no dia X" usam `dataAgendamento` (coluna A) que é imutável após criação.

**Não tratar como bug** — é a verdade da planilha. Se quiser histórico, precisa de aba de eventos (fora do escopo v1).

#### 5.1.11 Campanhas multi-funil

Em teoria, uma campanha não deveria ter múltiplos marcadores (`PERP|CAPT|SALA|SESSAO`). Mas se acontecer:

- O matching usa `every` (todos os marcadores precisam estar presentes). Campanha `PERP|CAPT|SALA|SESSAO` matcheia tanto Sala quanto Sessão.
- Filtro "Sala" inclui essa campanha. Filtro "Sessão" também. Filtro "Todos" inclui uma vez (não duplica).
- **Risco:** dupla contagem de investimento se usuário soma KPIs entre funis individuais. Mitigação: tabela "Distribuição por funil" usa atribuição majoritária (primeiro marcador match) — implementar depois se virar problema real.

#### 5.1.12 Parsing de valores monetários

A planilha retorna valores como "6,38" (sem moeda) ou "R$ 11.200,00". A função:

```typescript
export function parseValor(v: string | number): number {
  if (typeof v === 'number') return v;
  return parseFloat(
    v.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')
  );
}
// parseValor("6,38") → 6.38
// parseValor("R$ 11.200,00") → 11200
// parseValor("R$ 290k") → NaN (formato não suportado; tratar como bug e flagar)
```

### 5.2 Cálculos por página

#### 5.2.1 Página: Visão Geral

**Filtros aplicáveis:** Período (date range), Funis (multi-select)

**KPIs (top — linha 1):**

| KPI | Fórmula |
|---|---|
| Investido | `sum(fb_todos.amountSpent)` filtrado por funil + data |
| Leads | `count(leads)` filtrado por funil + data (em `leads.P`) |
| MQL | `count(leads where qualificacao matches MQL_PATTERNS)` filtrado por funil + data |
| Reuniões realizadas | `count(sdr where status="Realizada")` filtrado por funil + data (em `sdr.B`) |
| Vendas | `count(vendas)` filtrado por funil + data (em `vendas.O`) |

**KPIs (linha 2):**

| KPI | Fórmula |
|---|---|
| Receita | `sum(vendas.valorContrato)` filtrado por funil + data |
| Ticket médio | `Receita / Vendas` |
| ROAS | `Receita / Investido` |
| CAC | `Investido / Vendas` |
| Pipeline (proposta) | `sum(sdr.valorProposta where propostaEnviada=true)` filtrado |

**Sub-KPIs (texto pequeno em cada card):**

| KPI principal | Sub-info |
|---|---|
| Investido | CPL = `Investido / Leads` |
| Leads | Delta vs mês anterior (%) |
| MQL | CMQL = `Investido / MQL`, Tx L→M = `MQL / Leads` |
| Reuniões realizadas | Show = `Reuniões realizadas / Reuniões agendadas` |
| Vendas | Conv R→V = `Vendas / Reuniões realizadas` |

**Gráfico — Evolução: MQL · Reuniões Realizadas · Vendas (combo barras + linha):**

- Eixo X: dias do período
- Barras agrupadas: MQL (cinza), Reuniões realizadas (azul), Vendas (verde)
- Linha (eixo secundário): % Conversão MQL → Venda (vermelha)

**Gráfico — Funil (do mês):**

| Etapa | Valor | % anterior |
|---|---|---|
| Leads | `count(leads)` | 100% |
| MQL | `count(leads MQL)` | MQL/Leads |
| Agendamentos | `count(sdr by sdr.A)` | Agend/MQL |
| Reuniões realizadas | `count(sdr where status="Realizada")` | Reun/Agend |
| Vendas | `count(vendas)` | Vendas/Reun |

**Gráfico — Custo por etapa (linha multi):**

- Eixo X: dias
- 3 linhas: CPL, CMQL, CAC (diários acumulados ou por dia — a definir)

**Gráfico — Distribuição por funil (barra empilhada 100%):**

- Eixo X: etapa (Leads, MQL, Reuniões, Vendas)
- Empilhamento por funil (Sala, Aplicação, Sessão, Isca, Reality)

**Tabela diária — 13 colunas com fórmulas explícitas:**

| Coluna | Fórmula |
|---|---|
| Data | dia do período filtrado |
| Investimento | `sum(fb_todos.amountSpent where day = D)` |
| MQL | `count(leads where dataInscricao = D AND qualificacao MQL)` |
| Custo por MQL | `safeDiv(Investimento, MQL)` |
| Agendamentos | `count(sdr where dataAgendamento = D)` |
| MQL → Agend. (%) | `safeRatio(Agendamentos, MQL)` |
| Reuniões agendadas | `count(sdr where dataReuniao = D)` |
| MQL → Reun. ag. (%) | `safeRatio(Reuniões agendadas, MQL)` |
| Reuniões realizadas | `count(sdr where dataReuniao = D AND status="Realizada")` |
| Show (%) | `safeRatio(Realizadas, Agendadas)` |
| Vendas | `count(vendas where dataCompra = D)` |
| Conversão (%) | `safeRatio(Vendas, Realizadas)` |
| Faturamento | `sum(vendas.valorContrato where dataCompra = D)` |

Todos filtrados por funil. Última linha **TOTAL**: soma de absolutos para colunas de quantidade/valor; recalculo da taxa para colunas %, (NÃO média das taxas — taxa do total: `Total Agend / Total MQL`).

**Acceptance criteria:**
- Filtrando Sessão + período do mês, os KPIs batem com a aba "Análise Geral" da planilha (com D3 = "SESSAO") — margem 0.
- Tabela diária mostra mesmas linhas que a planilha.
- Mudança de filtro responde em < 500ms (após cache quente).

##### 5.2.1.E Especificação execução-ready — Visão Geral

> Esta sub-seção transforma a §5.2.1 acima em referência execução-ready. Cada elemento do wireframe é especificado com função TS, formato visual, edge case e exemplo numérico. **Dev que pega este bloco consegue implementar sem precisar olhar pra mais nada.**

###### Estrutura geral da página

| Item | Valor |
|---|---|
| Rota | `/dashboard` |
| Arquivo | `app/(dashboard)/page.tsx` |
| Tipo | Server Component |
| Abas Sheets consumidas | `fb_todos`, `leads`, `sdr`, `vendas` |
| Função de cálculo | `calcVisaoGeral(rawData, filters): VisaoGeralResult` em `lib/calc/visao-geral.ts` |
| Layout | Filtros → 2 linhas de 5 KPIs → Grid 2:1 (combo chart + funil) → Grid 2 colunas (custo por etapa + distribuição) → Tabela diária |

###### Filtros

| Filtro | Componente | Search param | Default | Validação |
|---|---|---|---|---|
| Período | `<DateRangePopover />` | `from=YYYY-MM-DD&to=YYYY-MM-DD` | Mês corrente (BRT) | `from` ≤ `to`; range ≤ 365 dias |
| Funis | `<FunnelChips />` multi-select | `funis=sala,sessao` (csv) | Todos (sala,aplica,sessao,isca,reality) | Subset dos 5 funis válidos |

###### Tipo de dados de entrada (rawData)

```typescript
type RawDataVisaoGeral = {
  fbTodos: FbTodosRow[];   // 51k linhas, schema §4.2.6
  leads: LeadRow[];        // 35k linhas, dedup por email
  sdr: SdrRow[];           // 3k linhas
  vendas: VendaRow[];      // 1k linhas
};

type Filters = {
  from: Date;              // já em BRT 00:00
  to: Date;                // já em BRT 23:59:59.999
  funis: Funil[];          // 1+ funil; "todos" = união
};
```

###### Tipo de saída (`VisaoGeralResult`)

```typescript
type VisaoGeralResult = {
  kpis: {
    investido: number;          // R$
    leads: number;
    leadsDelta: { value: number; direction: 'up' | 'down' } | null;
    mql: number;
    reunioesRealizadas: number;
    vendas: number;
    receita: number;            // R$
    ticketMedio: number | null; // null se Vendas=0
    roas: number | null;        // null se Investido=0
    cac: number | null;         // null se Vendas=0
    pipeline: number;           // R$
    propostasEmAberto: number;
    cpl: number | null;
    cmql: number | null;
    txLeadParaMql: number | null;    // 0..1
    show: number | null;
    convReunParaVenda: number | null;
  };
  evolucaoDiaria: Array<{
    date: Date;
    mql: number;
    reunioesRealizadas: number;
    vendas: number;
    convMqlVenda: number | null;
  }>;
  funil: {
    leads: number;
    mql: number;
    agendamentos: number;
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    vendas: number;
  };
  custoPorEtapa: Array<{ date: Date; cpl: number | null; cmql: number | null; cac: number | null }>;
  distribuicaoPorFunil: Array<{
    funil: Funil;
    leads: number;
    mql: number;
    reunioes: number;
    vendas: number;
  }>;
  tabelaDiaria: Array<{
    date: Date;
    investido: number;
    mql: number;
    custoPorMql: number | null;
    agendamentos: number;
    mqlParaAgend: number | null;
    reunioesAgendadas: number;
    mqlParaReunAg: number | null;
    reunioesRealizadas: number;
    show: number | null;
    vendas: number;
    conversao: number | null;
    faturamento: number;
  }>;
  totalTabelaDiaria: /* mesma shape sem date */;
};
```

###### Função `calcVisaoGeral` — pseudocódigo

```typescript
// lib/calc/visao-geral.ts
import { filterByDate, filterByFunilFbTodos, filterByFunilLeads, /* ... */, safeDiv, safeRatio, dedupeLeadsByEmail } from './shared';

export function calcVisaoGeral(raw: RawDataVisaoGeral, filters: Filters): VisaoGeralResult {
  // 1. Filtros base (executados uma vez)
  const fbFiltered    = filterByFunilFbTodos(raw.fbTodos, filters.funis);
  const fbInPeriod    = filterByDate(fbFiltered, r => r.day, filters.from, filters.to);
  const leadsFiltered = filterByFunilLeads(dedupeLeadsByEmail(raw.leads), filters.funis);
  const leadsInPeriod = filterByDate(leadsFiltered, r => r.dataInscricao, filters.from, filters.to);
  const sdrFiltered   = filterByFunilSdr(raw.sdr, filters.funis);
  const sdrAgendInPeriod = filterByDate(sdrFiltered, r => r.dataAgendamento, filters.from, filters.to);
  const sdrReunInPeriod  = filterByDate(sdrFiltered, r => r.dataReuniao, filters.from, filters.to);
  const vendasFiltered = filterByFunilVendas(raw.vendas, filters.funis);
  const vendasInPeriod = filterByDate(vendasFiltered, r => r.dataCompra, filters.from, filters.to);

  // 2. KPIs
  const investido = sum(fbInPeriod, r => r.amountSpent);
  const leadsCount = leadsInPeriod.length;
  const mqlList = leadsInPeriod.filter(l => isMql(l.qualificacao));
  const mql = mqlList.length;
  const reunioesRealizadas = sdrReunInPeriod.filter(r => /realizada/i.test(r.status)).length;
  const reunioesAgendadas = sdrReunInPeriod.length;
  const agendamentos = sdrAgendInPeriod.length;
  const vendas = vendasInPeriod.length;
  const receita = sum(vendasInPeriod, v => v.valorContrato);
  const propostas = sdrReunInPeriod.filter(s => /realizada/i.test(s.status) && /sim|fechada|recusada/i.test(s.envioProposta));
  const pipeline = sum(propostas, p => p.valorProposta);

  // 3. Período anterior (pra delta de Leads)
  const lengthDays = daysBetween(filters.from, filters.to);
  const prevFrom = addDays(filters.from, -lengthDays);
  const prevTo = addDays(filters.to, -lengthDays);
  const prevLeadsCount = filterByDate(leadsFiltered, r => r.dataInscricao, prevFrom, prevTo).length;
  const leadsDelta = calcMoMDelta(leadsCount, prevLeadsCount);

  // 4. Evolução diária (agrupar por dia)
  const evolucaoDiaria = groupByDay(filters.from, filters.to, (day) => ({
    date: day,
    mql: leadsInPeriod.filter(l => isSameDayBrt(l.dataInscricao!, day) && isMql(l.qualificacao)).length,
    reunioesRealizadas: sdrReunInPeriod.filter(r => r.dataReuniao && isSameDayBrt(r.dataReuniao, day) && /realizada/i.test(r.status)).length,
    vendas: vendasInPeriod.filter(v => v.dataCompra && isSameDayBrt(v.dataCompra, day)).length,
    convMqlVenda: /* calcular */,
  }));

  // 5. Funil consolidado (do período inteiro, não por dia)
  const funil = { leads: leadsCount, mql, agendamentos, reunioesAgendadas, reunioesRealizadas, vendas };

  // 6. Custo por etapa (diário)
  const custoPorEtapa = evolucaoDiaria.map(({ date }) => {
    const investidoDia = sum(fbInPeriod.filter(r => isSameDayBrt(r.day, date)), r => r.amountSpent);
    const mqlDia = /* count */;
    const vendasDia = /* count */;
    return {
      date,
      cpl: safeDiv(investidoDia, /* leadsDia */),
      cmql: safeDiv(investidoDia, mqlDia),
      cac: safeDiv(investidoDia, vendasDia),
    };
  });

  // 7. Distribuição por funil (5 funis individuais)
  const distribuicaoPorFunil = (['sala', 'aplica', 'sessao', 'isca', 'reality'] as Funil[]).map(f => ({
    funil: f,
    leads: filterByFunilLeads(leadsInPeriod, [f]).length,
    mql: /* idem MQL */,
    reunioes: /* idem */,
    vendas: /* idem */,
  }));

  // 8. Tabela diária (cada dia do período)
  const tabelaDiaria = evolucaoDiaria.map(({ date }) => /* 13 colunas calculadas por dia */);

  // 9. Total da tabela (recalcula taxas em cima dos totais, não média)
  const totalTabelaDiaria = aggregateTotal(tabelaDiaria);

  return { kpis: { investido, leads: leadsCount, leadsDelta, mql, reunioesRealizadas, vendas, receita,
    ticketMedio: safeDiv(receita, vendas),
    roas: safeDiv(receita, investido),
    cac: safeDiv(investido, vendas),
    pipeline,
    propostasEmAberto: propostas.length,
    cpl: safeDiv(investido, leadsCount),
    cmql: safeDiv(investido, mql),
    txLeadParaMql: safeRatio(mql, leadsCount),
    show: safeRatio(reunioesRealizadas, reunioesAgendadas),
    convReunParaVenda: safeRatio(vendas, reunioesRealizadas),
  }, evolucaoDiaria, funil, custoPorEtapa, distribuicaoPorFunil, tabelaDiaria, totalTabelaDiaria };
}
```

###### Especificação de cada componente visível

**KPI 1 — Investido**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.investido` |
| Formato | `R$ {valor com separador de milhar, sem decimais}` ex: `R$ 45.230` |
| Sub-info | `CPL R$ {safeDiv(invest, leads) com 2 decimais}` ex: `CPL R$ 19,67` ou `CPL —` se Leads=0 |
| Empty (valor=0) | mostra `R$ 0`, sub-info `CPL —` |
| Loading | Skeleton (`<KpiCardSkeleton />`) |
| Error | Card com `⚠ Erro` (não trava a página) |
| Identidade visual | bg `#FFFFFF`, border `#EFF3F5`, radius 12px; label SF Pro 540 11px uppercase letter-spacing +9% `#435965`; valor SF Pro 870 24px tabular-nums `#0C161B`; sub SF Pro 400 12px `#688594` |
| Exemplo numérico | dataset fb_todos com 100 linhas filtradas, Σ amountSpent = 45.230,40 → renderiza `R$ 45.230` |

**KPI 2 — Leads**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.leads` + `result.kpis.leadsDelta` |
| Formato | `{n com separador}` ex: `2.300` |
| Sub-info | `{delta} vs mês anterior` ex: `+12% vs mês anterior` em verde (`.delta.up`) ou `-5%` em vermelho (`.delta.down`); ou ocultar se delta=null |
| Empty | `0` + sub `—` |
| Identidade visual | igual KPI 1 |
| Exemplo | leads no período=2300, leads no período anterior=2053 → `+12% vs mês anterior` (verde) |

**KPI 3 — MQL**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.mql` + `cmql` + `txLeadParaMql` |
| Formato | `{n}` |
| Sub-info (texto combinado) | `CMQL R$ {cmql c/ 2 decimais} · L→M {txLeadParaMql como %}` ex: `CMQL R$ 93,84 · L→M 20,9%` |
| Empty | `0` + sub `—` |
| Exemplo | mql=482, cmql=93.84, tx=0.209 → `CMQL R$ 93,84 · L→M 20,9%` |

**KPI 4 — Reuniões realizadas**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.reunioesRealizadas` + `show` |
| Sub-info | `Show {show como %}` ex: `Show 65,0%` ou `Show —` se sem agendamentos |
| Exemplo | reuniões=38, agendadas=58 → `Show 65,5%` |

**KPI 5 — Vendas**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.vendas` + `convReunParaVenda` |
| Sub-info | `R→V {conv como %}` ex: `R→V 18,4%` |

**KPI 6 — Receita**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.receita` |
| Formato | `R$ {valor com separador, sem decimais}` ex: `R$ 290.000` |
| Sub-info | "soma do contrato" (estática, só explicativa) |

**KPI 7 — Ticket médio**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.ticketMedio` |
| Formato | `R$ {valor com separador, sem decimais}` ex: `R$ 41.428` |
| Empty (vendas=0) | `—` (não `R$ 0`) |

**KPI 8 — ROAS**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.roas` |
| Formato | `{valor c/ 1 decimal}x` ex: `6,4x` |
| Sub-info | "acima da meta" em verde se >= meta; "abaixo da meta" em vermelho — meta vem de `Metas` ou hardcoded (5x default) |
| Empty (invest=0) | `—` |

**KPI 9 — CAC**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.cac` |
| Formato | `R$ {valor com separador, sem decimais}` ex: `R$ 6.461` |
| Empty | `—` |

**KPI 10 — Pipeline**

| Campo | Valor |
|---|---|
| Fonte | `result.kpis.pipeline` + `propostasEmAberto` |
| Formato | `R$ {valor c/ k abreviado se ≥1M}` ex: `R$ 780k` |
| Sub-info | `{n} propostas em aberto` |

**Gráfico — Evolução: MQL · Reuniões Realizadas · Vendas (Recharts ComposedChart)**

```tsx
<ResponsiveContainer width="100%" height={280}>
  <ComposedChart data={result.evolucaoDiaria}>
    <CartesianGrid strokeDasharray="3 3" stroke="#EFF3F5" vertical={false} />
    <XAxis dataKey="date" tickFormatter={d => format(d, 'dd/MM', { locale: ptBR })} stroke="#688594" fontSize={11} />
    <YAxis yAxisId="left" stroke="#688594" fontSize={11} />
    <YAxis yAxisId="right" orientation="right" stroke="#FFBE18" fontSize={11} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
    <Tooltip /* custom Metta */ />
    <Bar yAxisId="left" dataKey="mql" name="MQL" fill="#0C161B" radius={[3,3,0,0]} />
    <Bar yAxisId="left" dataKey="reunioesRealizadas" name="Reuniões realizadas" fill="#435965" radius={[3,3,0,0]} />
    <Bar yAxisId="left" dataKey="vendas" name="Vendas" fill="#16A34A" radius={[3,3,0,0]} />
    <Line yAxisId="right" type="monotone" dataKey="convMqlVenda" name="% Conversão" stroke="#FFBE18" strokeWidth={2} dot={false} />
  </ComposedChart>
</ResponsiveContainer>
```

- **Vazio:** se 0 dias com dados, exibe `<EmptyState>` com mensagem "Sem dados no período"
- **Mobile:** rotacionar labels do eixo X em 45° quando < 768px

**Gráfico — Funil (custom component `<FunnelVertical />`)**

```tsx
<FunnelVertical
  variant="blue"  // gradient azul-noite → amarelo
  steps={[
    { label: 'Leads', value: result.funil.leads, pct: '100%' },
    { label: 'MQL', value: result.funil.mql, pct: formatPct(safeRatio(result.funil.mql, result.funil.leads)) },
    { label: 'Agendamentos', value: result.funil.agendamentos, pct: formatPct(safeRatio(result.funil.agendamentos, result.funil.mql)) },
    { label: 'Reuniões realizadas', value: result.funil.reunioesRealizadas, meta: `show ${formatPct(...)}` },
    { label: 'Vendas', value: result.funil.vendas, meta: 'fechamento' },
  ]}
/>
```

Cores dos steps (de cima pra baixo):
- Leads: bg `#0C161B`, text `#FFFFFF`
- MQL: bg gradient `#1E2A30 → #435965`, text `#FFFFFF`
- Agendamentos: bg `#435965`, text `#FFFFFF`
- Reuniões: bg `#688594`, text `#0C161B`
- Vendas: bg `#FFBE18`, text `#0C161B` (destaque amarelo no topo do funil)

Largura decrescente: 100%, 82%, 64%, 46%, 28%.

**Gráfico — Custo por etapa (LineChart multi-série)**

```tsx
<LineChart data={result.custoPorEtapa}>
  <Line dataKey="cpl" name="CPL" stroke="#0C161B" />
  <Line dataKey="cmql" name="CMQL" stroke="#435965" />
  <Line dataKey="cac" name="CAC" stroke="#FFBE18" />
</LineChart>
```

Valores `null` (divisão por zero em algum dia) ficam como gap na linha (Recharts `connectNulls={false}`).

**Gráfico — Distribuição por funil (BarChart empilhado 100%)**

```tsx
<BarChart data={result.distribuicaoPorFunil.flatMap(/* transformar em "Leads/MQL/Reuniões/Vendas" como categorias */)}
         layout="horizontal" stackOffset="expand">
  <XAxis type="category" dataKey="etapa" />
  <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} />
  <Bar dataKey="sala" stackId="1" fill="#0C161B" />
  <Bar dataKey="aplica" stackId="1" fill="#435965" />
  <Bar dataKey="sessao" stackId="1" fill="#688594" />
  <Bar dataKey="isca" stackId="1" fill="#A8B3B9" />
  <Bar dataKey="reality" stackId="1" fill="#FFBE18" />
</BarChart>
```

**Tabela diária — célula a célula**

Componente: `<MetricTable />` com TanStack Table. Card wrapper com `min-height: 500px` (classe `.tall`).

| # | Coluna | dataKey | Tipo | Formato | Align | Sortable |
|---|---|---|---|---|---|---|
| 1 | Data | `date` | Date | `dd/MM` | left | sim |
| 2 | Investimento | `investido` | number | `R$ {n com sep, 0 dec}` | center | sim |
| 3 | MQL | `mql` | number | `{n}` | center | sim |
| 4 | Custo por MQL | `custoPorMql` | number\|null | `R$ {n c/ 2 dec}` ou `—` | center | sim |
| 5 | Agendamentos | `agendamentos` | number | `{n}` | center | sim |
| 6 | MQL → Agend. | `mqlParaAgend` | number\|null | `{n*100 c/ 0 dec}%` ou `—` | center | sim |
| 7 | Reuniões agendadas | `reunioesAgendadas` | number | `{n}` | center | sim |
| 8 | MQL → Reun. ag. | `mqlParaReunAg` | number\|null | `{n*100}%` ou `—` | center | sim |
| 9 | Reuniões realizadas | `reunioesRealizadas` | number | `{n}` | center | sim |
| 10 | Show | `show` | number\|null | `{n*100 c/ 0 dec}%` ou `—` | center | sim |
| 11 | Vendas | `vendas` | number | `{n}` | center | sim |
| 12 | Conversão | `conversao` | number\|null | `{n*100 c/ 0 dec}%` ou `—` | center | sim |
| 13 | Faturamento | `faturamento` | number | `R$ {n com sep, 0 dec}` | center | sim |

Header: SF Pro 540 11px uppercase, letter-spacing +9%, `#435965`, align-left.

**Linha TOTAL** (última, sticky no rodapé):
- Background `#FAFCFD`
- Font weight 600
- Não recalcula média das taxas — **recalcula taxa em cima dos totais**: `total.mqlParaAgend = safeRatio(sum(agendamentos), sum(mql))`
- Mostra `—` quando taxa é null

Estado **empty** (0 dias com dados): mostra mensagem dentro do card "Sem dados no período selecionado" + ícone leve.

###### Identidade visual aplicada — checklist de execução

| Elemento | Token / Classe |
|---|---|
| Card wrapper | `bg-white border border-[#EFF3F5] rounded-card shadow-sm` |
| KPI label | `text-[11px] font-medium uppercase tracking-[0.09em] text-[#435965]` |
| KPI valor | `text-[24px] font-[870] tabular-nums tracking-[-0.02em] text-[#0C161B]` |
| KPI sub | `text-[12px] text-[#688594] mt-1` |
| KPI delta up | `text-[#16A34A] font-medium` |
| KPI delta down | `text-[#DC2626] font-medium` |
| Card title | `text-[13px] font-semibold tracking-[-0.005em]` |
| Tabela header | `text-[11px] font-medium uppercase tracking-[0.09em] text-[#435965] border-b border-[#EFF3F5]` |
| Tabela row | `border-b border-[#F0F0F0] hover:bg-[#FAFCFD]` |
| Tabela total | `bg-[#FAFCFD] font-semibold border-t border-[#EFF3F5]` |

Fundo geral do `<main>`: branco puro `#FFFFFF` (preservar — decisão Metta-design).

###### Acceptance final — execução-ready

Dev terminou a página quando:

1. **Render OK**: rota `/dashboard` renderiza sem erro em dev e prod.
2. **Filtros funcionam**: mudar período/funil atualiza KPIs sem refetch da Sheets (cache hit).
3. **Números batem** (sanity check):
   - Filtrar Sessão + mês fechado (ex: Abril/2026)
   - Comparar 10 KPIs principais com Análise Geral da planilha (D3="SESSAO", período idêntico)
   - **Diff: 0** em todos os valores
4. **Estados de UI**: testar 4 cenários
   - Cache vazio (Sentry/Vercel preview com `revalidate` manual) → loading skeleton aparece
   - Filtro impossível (período sem dados) → empty state
   - Sheets API down → cache anterior + banner stale
   - Schema drift (renomear coluna na planilha) → error boundary com mensagem
5. **Visual Metta aplicado**: spot check em 3 elementos (sidebar, KPI card, tabela) — paleta correta, SF Pro carregada, cantos 12px.
6. **Performance**: Lighthouse desktop ≥ 90; mudança de filtro < 500ms (DevTools Performance).
7. **Responsivo**: testar em 1440px, 768px, 375px — sem overflow horizontal, layout adapta conforme §17.

#### 5.2.2 Página: Tráfego Pago

**Filtros globais:** Período, Funis (multi-select chips)

**Fonte de dados:** aba **`fb_todos`** (não `fb`). A planilha tem duas abas de tráfego pago — `fb_todos` (consolidada, usada pela Análise Geral) e `fb` (estrutura legada, usada pela Análise Tráfego com layout de cabeçalho diferente). Pro v1 do dashboard, usar **`fb_todos`** por consistência. Diferenças mapeadas:

| Aba | Day | Campaign | Spent | Notas |
|---|---|---|---|---|
| `fb_todos` | col B | col C | col R | Usada pela Visão Geral. **Adotada no dashboard.** |
| `fb` | col A | col B | col I | Usada pela Análise Tráfego. **Não adotada.** Resultado: P2 do dashboard usa mesmo fonte que P1, sem inconsistência. |

**KPIs (5 colunas) com fórmulas:**

| KPI | Fórmula | Sub-info |
|---|---|---|
| Investido | `sum(fb_todos.amountSpent)` filtrado | CPL = `Investido / Leads` |
| Impressões | `sum(fb_todos.impressions)` | CPM = `(Investido / Impressões) × 1000` |
| Cliques | `sum(fb_todos.linkClicks)` | CTR = `Cliques / Impressões`, CPC = `Investido / Cliques` |
| Leads | `count(leads)` filtrado | CPL = `Investido / Leads`, Conv. LP→Lead = `Leads / Landing Page Views` |
| MQL | `count(leads MQL)` filtrado | CMQL = `Investido / MQL`, Tx L→M = `MQL / Leads` |

**Layout principal:** grid 2:1
- **Esquerda (2/3):** dois cards empilhados
  1. Investimento, MQL e CMQL · diário (combo barras + linha)
  2. MQL e CMQL por funil (barras duplas)
- **Direita (1/3):** Funil de tráfego (5 etapas)

**Gráfico — Combo "Investimento, MQL e CMQL · diário":**
- Eixo X: dias do período
- Barras: Investimento (R$, eixo Y primário), MQL (unidade, eixo Y secundário)
- Linha: CMQL (R$, eixo Y primário)

**Gráfico — "MQL e CMQL por funil" (barras duplas):**
- Eixo X: 5 funis (Sala, Aplicação, Sessão, Isca, Reality)
- Barras agrupadas por funil: MQL (escura) + CMQL (azul accent)
- Apenas para os 3 funis com campanha em fb_todos (Sala, Aplicação, Sessão); Isca/Reality sem dados de gasto (não há campanha Meta direta) — mostrar como barra vazia + label "—"

**Funil de tráfego (5 etapas) — fórmulas:**

| Etapa | Valor | % da anterior | Métrica secundária |
|---|---|---|---|
| Impressões | `sum(fb_todos.impressions)` filtrado | 100% | CPM = `(Investido × 1000) / Impressões` |
| Cliques | `sum(fb_todos.linkClicks)` filtrado | CTR = `Cliques / Impressões` | CPC = `Investido / Cliques` |
| Visualizações de página | `sum(fb_todos.landingPageViews)` filtrado | `LP Views / Cliques` | — |
| Leads | `count(leads filtrados por funil + data)` | `Leads / LP Views` | CPL = `Investido / Leads` |
| MQL | `count(leads MQL)` | `MQL / Leads` | CMQL = `Investido / MQL` |

**Nota sobre o join Leads × Tráfego:** Leads vêm de `leads` (aba), não de `fb_todos.J` (que é a contagem do Meta, com tracking limitado). Diferença esperada: 5-15% (atribuição diferente). Documentar essa diferença na primeira tela quando aplicável.

**Tabela "Ranking de mídia" (card full-width, altura mínima 500px):**

Toolbar interno:
- Toggle segmented: Campanha | Conjunto de anúncio
- Select Temperatura (Todas, Frio, Quente, Advantage)
- Input de busca

**Como filtrar por Temperatura:** a temperatura aparece como substring no Campaign Name. Padrão: `<CONTA>|<ESTRATÉGIA>|<FUNIL>|<CAPT>|<TEMPERATURA>|<NOME>`. Ex: `TIAGO01|PERP|SESSAO|CAPT|FRIO|Teste_criativos`. Match por substring `FRIO`, `QUENTE`, `ADV` (case-insensitive). "Todas" = sem filtro.

**Colunas da tabela:** Campanha (ou Adset), Invest., Impr., CTR, CPC, CPM, LP Views, Leads, CPL, MQL, CMQL.

- Agrupamento "Campanha": `groupBy(fb_todos.campaignName)` — soma métricas, recalcula taxas.
- Agrupamento "Conjunto de anúncio": `groupBy(fb_todos.adSetName)` + manter `campaignName` como contexto.
- Leads/MQL por campanha: cruzar via `leads.utm_campaign` (substring match com `fb_todos.campaignName`) — pode ter divergência se UTM mal preenchido.

10 linhas visíveis + "..." (placeholder de paginação futura). Implementar virtual scroll se passar de 50 linhas.

**Acceptance:**
- KPIs batem com Visão Geral filtrando o mesmo período + funil (consistência interna).
- Toggle Campanha/Adset reorganiza a tabela sem refetch (mesmo cache cru, agregação diferente).
- Busca filtra a tabela client-side em < 100ms.
- Filtro de Temperatura reduz a tabela coerentemente.

##### 5.2.2.E Especificação execução-ready — Tráfego Pago

###### Estrutura geral

| Item | Valor |
|---|---|
| Rota | `/dashboard/trafego` |
| Arquivo | `app/(dashboard)/trafego/page.tsx` |
| Tipo | Server Component |
| Abas Sheets | `fb_todos`, `leads` |
| Função | `calcTrafego(rawData, filters): TrafegoResult` em `lib/calc/trafego.ts` |
| Layout | Filtros → 5 KPIs (linha única) → Grid 2:1 (col esquerda 2 cards empilhados em 1:1 + col direita funil) → Tabela ranking |

###### Filtros

| Filtro | Componente | Search param | Default |
|---|---|---|---|
| Período | `<DateRangePopover />` | `from`, `to` | Mês corrente |
| Funis | `<FunnelChips />` multi | `funis=...` | Todos |

###### Type signatures

```typescript
type RawDataTrafego = { fbTodos: FbTodosRow[]; leads: LeadRow[] };

type TrafegoResult = {
  kpis: {
    investido: number;
    impressoes: number;
    cliques: number;
    leads: number;
    mql: number;
    cpm: number | null;       // (invest * 1000) / impressoes
    cpc: number | null;       // invest / cliques
    ctr: number | null;       // cliques / impressoes
    cpl: number | null;
    cmql: number | null;
    txLpLead: number | null;  // leads / lpViews
    txLeadMql: number | null;
  };
  evolucaoDiaria: Array<{ date: Date; investido: number; mql: number; cmql: number | null }>;
  mqlCmqlPorFunil: Array<{ funil: Funil; mql: number; cmql: number | null }>;
  funilTrafego: {
    impressoes: number;
    cliques: number;
    lpViews: number;
    leads: number;
    mql: number;
    cpm: number | null;
    cpc: number | null;
  };
  ranking: Array<{
    nome: string;            // campaignName ou adSetName
    investido: number;
    impressoes: number;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    lpViews: number;
    leads: number;
    cpl: number | null;
    mql: number;
    cmql: number | null;
  }>;
};

type TrafegoFilters = Filters & {
  rankingBy: 'campanha' | 'adset';   // toolbar interno da tabela
  temperatura: 'todas' | 'frio' | 'quente' | 'adv';
  busca: string;                     // toolbar interno, filtro client-side
};
```

###### Função `calcTrafego` — pseudocódigo

```typescript
export function calcTrafego(raw: RawDataTrafego, filters: TrafegoFilters): TrafegoResult {
  // 1. Filtros base
  const fbFiltered = filterByFunilFbTodos(raw.fbTodos, filters.funis);
  const fbInPeriod = filterByDate(fbFiltered, r => r.day, filters.from, filters.to);
  const fbByTemp = filterByTemperatura(fbInPeriod, filters.temperatura);

  const leadsFiltered = filterByFunilLeads(dedupeLeadsByEmail(raw.leads), filters.funis);
  const leadsInPeriod = filterByDate(leadsFiltered, r => r.dataInscricao, filters.from, filters.to);

  // 2. KPIs
  const investido = sum(fbByTemp, r => r.amountSpent);
  const impressoes = sum(fbByTemp, r => r.impressions);
  const cliques = sum(fbByTemp, r => r.linkClicks);
  const lpViews = sum(fbByTemp, r => r.landingPageViews);
  const leadsCount = leadsInPeriod.length;
  const mqlCount = leadsInPeriod.filter(l => isMql(l.qualificacao)).length;

  const kpis = {
    investido, impressoes, cliques, leads: leadsCount, mql: mqlCount,
    cpm: safeDiv(investido * 1000, impressoes),
    cpc: safeDiv(investido, cliques),
    ctr: safeRatio(cliques, impressoes),
    cpl: safeDiv(investido, leadsCount),
    cmql: safeDiv(investido, mqlCount),
    txLpLead: safeRatio(leadsCount, lpViews),
    txLeadMql: safeRatio(mqlCount, leadsCount),
  };

  // 3. Evolução diária (combo chart)
  const evolucaoDiaria = groupByDay(filters.from, filters.to, day => {
    const fbDia = fbByTemp.filter(r => isSameDayBrt(r.day, day));
    const leadsDiaMql = leadsInPeriod.filter(l => isSameDayBrt(l.dataInscricao!, day) && isMql(l.qualificacao)).length;
    const investidoDia = sum(fbDia, r => r.amountSpent);
    return { date: day, investido: investidoDia, mql: leadsDiaMql, cmql: safeDiv(investidoDia, leadsDiaMql) };
  });

  // 4. MQL e CMQL por funil (dual bars)
  const mqlCmqlPorFunil = (['sala', 'aplica', 'sessao', 'isca', 'reality'] as Funil[]).map(f => {
    const fbF = filterByFunilFbTodos(fbInPeriod, [f]);
    const leadsF = filterByFunilLeads(leadsInPeriod, [f]);
    const mqlF = leadsF.filter(l => isMql(l.qualificacao)).length;
    const investidoF = sum(fbF, r => r.amountSpent);
    return { funil: f, mql: mqlF, cmql: safeDiv(investidoF, mqlF) };
  });

  // 5. Funil de tráfego (5 etapas)
  const funilTrafego = { impressoes, cliques, lpViews, leads: leadsCount, mql: mqlCount,
    cpm: kpis.cpm, cpc: kpis.cpc };

  // 6. Ranking (agregação por campanha ou adset)
  const groupKey = filters.rankingBy === 'campanha' ? 'campaignName' : 'adSetName';
  const ranking = groupBy(fbByTemp, r => r[groupKey])
    .map(([nome, rows]) => {
      const investido = sum(rows, r => r.amountSpent);
      const impressoes = sum(rows, r => r.impressions);
      const cliques = sum(rows, r => r.linkClicks);
      const lpViews = sum(rows, r => r.landingPageViews);
      // leads/MQL por substring match
      const leadsCamp = leadsInPeriod.filter(l => l.utmCampaign.includes(nome) || nome.includes(l.utmCampaign));
      const mqlCamp = leadsCamp.filter(l => isMql(l.qualificacao)).length;
      return {
        nome, investido, impressoes,
        ctr: safeRatio(cliques, impressoes),
        cpc: safeDiv(investido, cliques),
        cpm: safeDiv(investido * 1000, impressoes),
        lpViews,
        leads: leadsCamp.length,
        cpl: safeDiv(investido, leadsCamp.length),
        mql: mqlCamp,
        cmql: safeDiv(investido, mqlCamp),
      };
    })
    .sort((a, b) => (a.cmql ?? Infinity) - (b.cmql ?? Infinity)); // ascendente CMQL = melhor

  // 7. Busca client-side (filter no ranking pelo nome)
  // Aplica no client após render — não no calc (preserva cache)

  return { kpis, evolucaoDiaria, mqlCmqlPorFunil, funilTrafego, ranking };
}
```

###### KPIs (5)

| KPI | Fonte | Formato | Sub-info |
|---|---|---|---|
| Investido | `kpis.investido` | `R$ {sep, 0 dec}` ex `R$ 45.230` | — |
| Impressões | `kpis.impressoes` | `{n com sep}` ou `{abreviado k/M}` ex `1,2M` | `CPM R$ {2 dec}` |
| Cliques | `kpis.cliques` | `{n com sep}` | `CTR {%} · CPC R$ {2 dec}` |
| Leads | `kpis.leads` | `{n}` | `CPL R$ {2 dec} · Conv {LP→Lead %}` |
| MQL | `kpis.mql` | `{n}` | `CMQL R$ {2 dec}` |

Empty: cada um mostra `—` em sub-info quando denominador é 0.

###### Gráfico — Investimento, MQL e CMQL · diário (Recharts ComposedChart)

```tsx
<ComposedChart data={evolucaoDiaria}>
  <CartesianGrid strokeDasharray="3 3" stroke="#EFF3F5" vertical={false} />
  <XAxis dataKey="date" tickFormatter={fmtDay} stroke="#688594" />
  <YAxis yAxisId="left" stroke="#688594" tickFormatter={fmtCurrency} />     {/* Investimento R$ */}
  <YAxis yAxisId="right" orientation="right" stroke="#0C161B" />            {/* MQL (unidade) */}
  <Tooltip /* custom */ />
  <Bar yAxisId="left" dataKey="investido" name="Investimento" fill="#0C161B" radius={[3,3,0,0]} />
  <Bar yAxisId="right" dataKey="mql" name="MQL" fill="#435965" radius={[3,3,0,0]} />
  <Line yAxisId="left" type="monotone" dataKey="cmql" name="CMQL" stroke="#FFBE18" strokeWidth={2} dot={false} />
</ComposedChart>
```

###### Gráfico — MQL e CMQL por funil (dual bars custom)

```tsx
<DualBars
  data={mqlCmqlPorFunil}
  groups={[
    { key: 'mql', label: 'MQL', color: '#0C161B' },
    { key: 'cmql', label: 'CMQL', color: '#FFBE18' },
  ]}
  labelKey="funil"
  emptyValue="—" // Isca/Reality sem fb dados
/>
```

Escala dupla: MQL em unidade (esquerda), CMQL em R$ (direita).

###### Funil de tráfego (5 etapas — `<FunnelVertical />`)

```tsx
<FunnelVertical
  variant="blue"
  steps={[
    { label: 'Impressões', value: fmtNumber(funilTrafego.impressoes), pct: '100%', meta: `CPM R$ ${fmt2(funilTrafego.cpm)}` },
    { label: 'Cliques', value: fmtNumber(funilTrafego.cliques), pct: `CTR ${fmtPct(safeRatio(funilTrafego.cliques, funilTrafego.impressoes))}`, meta: `CPC R$ ${fmt2(funilTrafego.cpc)}` },
    { label: 'Visualizações de página', value: fmtNumber(funilTrafego.lpViews), pct: fmtPct(safeRatio(funilTrafego.lpViews, funilTrafego.cliques)) },
    { label: 'Leads', value: fmtNumber(funilTrafego.leads), pct: fmtPct(safeRatio(funilTrafego.leads, funilTrafego.lpViews)) },
    { label: 'MQL', value: fmtNumber(funilTrafego.mql), pct: fmtPct(safeRatio(funilTrafego.mql, funilTrafego.leads)) },
  ]}
/>
```

Larguras: 100%, 75%, 55%, 35%, 22%.

###### Tabela Ranking de mídia

Wrapper: `<Card className="tall">` (min-height 500px).

Toolbar (Client Component):
- Segmented: Campanha (active default) | Conjunto de anúncio → muda `rankingBy` em search params
- Select Temperatura → `temperatura` em search params: Todas (default), Frio, Quente, Advantage
- Input busca → estado local Client; filtra rows do array em memória

Colunas:

| # | Coluna | dataKey | Tipo | Formato | Align |
|---|---|---|---|---|---|
| 1 | Campanha/Adset | `nome` | string | truncate 60 chars + tooltip | left |
| 2 | Invest. | `investido` | number | `R$ {sep, 0 dec}` | center |
| 3 | Impr. | `impressoes` | number | `{abreviado k/M}` | center |
| 4 | CTR | `ctr` | number\|null | `{%2 dec}` ou `—` | center |
| 5 | CPC | `cpc` | number\|null | `R$ {2 dec}` ou `—` | center |
| 6 | CPM | `cpm` | number\|null | `R$ {0 dec}` ou `—` | center |
| 7 | LP Views | `lpViews` | number | `{n com sep}` | center |
| 8 | Leads | `leads` | number | `{n}` | center |
| 9 | CPL | `cpl` | number\|null | `R$ {2 dec}` ou `—` | center |
| 10 | MQL | `mql` | number | `{n}` | center |
| 11 | CMQL | `cmql` | number\|null | `R$ {0 dec}` ou `—` | center |

Ordenação default: CMQL ascendente. 10 linhas visíveis + "..." (paginação futura).

###### Identidade visual

Idêntica à Visão Geral. Adicional:
- Toolbar segmented (Campanha/Adset): `bg-[#FAFCFD] border border-[#EFF3F5] rounded-md`; segmento ativo `bg-white shadow-sm`
- Select Temperatura: classe `.select` (definida em §6.2)
- Input busca: ícone SVG lucide `<Search />` + input com `bg-white border border-[#EFF3F5]`

###### Acceptance

1. KPIs batem com a aba "Análise Tráfego" da planilha (filtrando D3=Sessão, F3=TODOS, E3=Data).
2. Toggle Campanha/Adset NÃO dispara refetch (URL muda, recálculo server-side em cima do cache cru).
3. Busca filtra rows client-side em < 100ms (sem chamar server).
4. Funil de tráfego: soma de Investimento × CTR × Conv LP × Conv Lead bate com KPI MQL (verificação cruzada).
5. Mobile (375px): tabela vira lista de cards (1 por linha), filtros empilhados.

#### 5.2.3 Página: Comercial / SDR

**Filtros:**

| Filtro | Tipo | Opções | Default |
|---|---|---|---|
| Período | Date range | presets 7/14/30/90/Este mês/Mês passado | Mês atual |
| Funis | Chips multi-select | Todos · Sala · Aplicação · Sessão · Isca · Reality | Todos |
| SDR | Select | "Todos" + `distinct(sdr.quemAgendou)` ordenado alfabético | Todos |
| Status | Select | Todos · Agendada · Realizada · Não realizada (No-show) · Reagendada · Cancelada | Todos |

**KPIs (5) com fórmulas:**

| KPI | Fórmula |
|---|---|
| Agendamentos | `count(sdr where dataAgendamento BETWEEN dates AND funilMatch AND sdrMatch)` |
| Reuniões agendadas | `count(sdr where dataReuniao BETWEEN dates AND funilMatch AND sdrMatch)` |
| Realizadas | `count(... AND status="Realizada")` |
| Propostas enviadas | `count(... AND status="Realizada" AND envioProposta IN {"Sim", "Fechada", "Recusada"})` |
| Valor em propostas | `sum(sdr.valorProposta where mesma condição que Propostas)` |

**Gráfico — Funil SDR (5 etapas):**

| Etapa | Fórmula | % anterior |
|---|---|---|
| Agendamentos | `count(sdr by dataAgendamento)` | 100% |
| Reuniões marcadas | `count(sdr by dataReuniao)` | Marcadas / Agendamentos |
| Realizadas | `count(...status="Realizada")` | Realizadas / Marcadas |
| Propostas | `count(... envioProposta IN {...})` | Propostas / Realizadas |
| Vendas | `count(vendas where email matches sdr.email)` | Vendas / Propostas |

**Gráfico — Heatmap dia × hora:** 7 dias × 14 horas (07h–20h). Intensidade por número de reuniões marcadas em `sdr.dataReuniao` (não agendamentos).

- Hora extraída: `dataReuniao.getHours()` em timezone BRT.
- Buckets de cor (sugestão): 0, 1-2, 3-5, 6-9, 10+. Configurável.

**Tabela "Performance por SDR" — fórmulas:**

| Coluna | Fórmula |
|---|---|
| SDR | `distinct(sdr.quemAgendou)` |
| Agendou | `count(sdr where quemAgendou = SDR AND dataAgendamento BETWEEN dates)` |
| Realizou | `count(sdr where quemAgendou = SDR AND status="Realizada" AND dataReuniao BETWEEN dates)` |
| Show | `safeRatio(Realizou, Agendou)` |
| Propostas | `count(... AND envioProposta IN {Sim, Fechada, Recusada})` |
| Tx prop. | `safeRatio(Propostas, Realizou)` |
| Valor prop. | `sum(sdr.valorProposta where mesmas condições)` |
| Vendas | `count(vendas where email matches lead from SDR's reuniões)` |
| Close | `safeRatio(Vendas, Propostas)` |

Mínimo 6 linhas (`distinct(quemAgendou)` ordenado por Agendou desc). Sortável por qualquer coluna.

**Acceptance:**
- Heatmap reflete distribuição real de `sdr.dataReuniao` por dia/hora.
- Ranking de SDR ordena por # de agendamentos (default), mas sortável por qualquer coluna.
- Filtro de SDR (select) restringe heatmap e ranking simultaneamente.
- Filtro de Status restringe os KPIs (ex: Status="No-show" mostra zero em "Realizadas").

##### 5.2.3.E Especificação execução-ready — Comercial SDR

###### Estrutura geral

| Item | Valor |
|---|---|
| Rota | `/dashboard/sdr` |
| Arquivo | `app/(dashboard)/sdr/page.tsx` |
| Abas Sheets | `leads`, `sdr` |
| Função | `calcSdr(rawData, filters): SdrResult` em `lib/calc/sdr.ts` |
| Layout | Filtros → 5 KPIs → Grid 2 (funil SDR + heatmap) → Tabela performance por SDR |

###### Filtros

| Filtro | Componente | Search param | Default | Opções |
|---|---|---|---|---|
| Período | DateRangePopover | `from`, `to` | Mês corrente | — |
| Funis | FunnelChips multi | `funis=...` | Todos | Todos · Sala · Aplica · Sessão · Isca · Reality |
| SDR | Select | `sdr=Vanessa` | Todos | Todos + `distinct(sdr.quemAgendou)` ordenado A-Z |
| Status | Select | `status=Realizada` | Todos | Todos · Agendada · Realizada · Não realizada · Reagendada · Cancelada |

###### Type signatures

```typescript
type RawDataSdr = { leads: LeadRow[]; sdr: SdrRow[] };
type SdrFilters = Filters & { sdrFilter: string | 'todos'; status: string | 'todos' };

type SdrResult = {
  kpis: {
    agendamentos: number;
    reunioesAgendadas: number;
    realizadas: number;
    propostas: number;
    valorPropostas: number;
    show: number | null;
    txProposta: number | null;
  };
  funil: {
    agendamentos: number;
    reunioesMarcadas: number;
    realizadas: number;
    propostas: number;
    vendas: number;
  };
  heatmap: Array<{ dia: 0|1|2|3|4|5|6; hora: number; count: number }>;
  porSdr: Array<{
    sdr: string;
    agendou: number;
    realizou: number;
    show: number | null;
    propostas: number;
    txProposta: number | null;
    valorProp: number;
    vendas: number;
    close: number | null;
  }>;
};
```

###### Função `calcSdr` — pseudocódigo

```typescript
export function calcSdr(raw: RawDataSdr, filters: SdrFilters): SdrResult {
  // 1. Filtros base
  const sdrFiltered = raw.sdr
    .filter(s => filters.funis.some(f => FUNIL_LEAD_PATTERNS[f].test(s.funil)))
    .filter(s => filters.sdrFilter === 'todos' || s.quemAgendou === filters.sdrFilter)
    .filter(s => filters.status === 'todos' || s.status === filters.status);

  const sdrAgendadosPeriod = filterByDate(sdrFiltered, s => s.dataAgendamento, filters.from, filters.to);
  const sdrReuniaoPeriod = filterByDate(sdrFiltered, s => s.dataReuniao, filters.from, filters.to);

  // 2. KPIs
  const realizadas = sdrReuniaoPeriod.filter(s => /realizada/i.test(s.status)).length;
  const reunioesAgendadas = sdrReuniaoPeriod.length;
  const agendamentos = sdrAgendadosPeriod.length;
  const propostasArr = sdrReuniaoPeriod.filter(s => /realizada/i.test(s.status) && /sim|fechada|recusada/i.test(s.envioProposta));
  const propostas = propostasArr.length;
  const valorPropostas = sum(propostasArr, p => p.valorProposta);

  // 3. Funil
  const leadIdx = indexLeadsByEmail(raw.leads);
  const vendasFromSdr = countVendasFromSdr(sdrReuniaoPeriod, leadIdx, raw.vendas /* passar tb */);

  // 4. Heatmap (dia da semana × hora)
  const heatmap: Array<{ dia: number; hora: number; count: number }> = [];
  for (let d = 0; d < 7; d++) for (let h = 7; h <= 20; h++) {
    const count = sdrReuniaoPeriod.filter(s => {
      const date = s.dataReuniao!;
      return date.getDay() === d && date.getHours() === h;
    }).length;
    heatmap.push({ dia: d as any, hora: h, count });
  }

  // 5. Performance por SDR
  const sdrNomes = uniq(sdrFiltered.map(s => s.quemAgendou)).sort();
  const porSdr = sdrNomes.map(nome => {
    const meusAgend = sdrAgendadosPeriod.filter(s => s.quemAgendou === nome);
    const minhasReun = sdrReuniaoPeriod.filter(s => s.quemAgendou === nome);
    const realizou = minhasReun.filter(s => /realizada/i.test(s.status)).length;
    const minhasProp = minhasReun.filter(s => /realizada/i.test(s.status) && /sim|fechada|recusada/i.test(s.envioProposta));
    const propostasN = minhasProp.length;
    const vendasN = /* count vendas from minhasReun.map(email) */;
    return {
      sdr: nome,
      agendou: meusAgend.length,
      realizou,
      show: safeRatio(realizou, meusAgend.length),
      propostas: propostasN,
      txProposta: safeRatio(propostasN, realizou),
      valorProp: sum(minhasProp, p => p.valorProposta),
      vendas: vendasN,
      close: safeRatio(vendasN, propostasN),
    };
  }).sort((a, b) => b.agendou - a.agendou);

  return { kpis: /* ... */, funil: /* ... */, heatmap, porSdr };
}
```

###### KPIs (5)

| KPI | Fonte | Formato | Sub-info |
|---|---|---|---|
| Agendamentos | `kpis.agendamentos` | `{n}` | — |
| Reuniões agendadas | `kpis.reunioesAgendadas` | `{n}` | "no calendário" |
| Realizadas | `kpis.realizadas` | `{n}` | `Show {%}` |
| Propostas enviadas | `kpis.propostas` | `{n}` | `{% das realizadas}` |
| Valor em propostas | `kpis.valorPropostas` | `R$ {sep, 0 dec}` | — |

###### Funil SDR (5 etapas — `<FunnelVertical variant="dark" />`)

Cores em tons de azul-noite (não amarelo, é "dark" não "blue"):
- Agendamentos: bg `#0C161B`, text `#FFFFFF`
- Reuniões marcadas: bg `#1E2A30`, text `#FFFFFF`
- Realizadas: bg `#435965`, text `#FFFFFF`
- Propostas: bg `#688594`, text `#FFFFFF`
- Vendas: bg `#A8B3B9`, text `#0C161B`

Larguras: 100%, 85%, 50%, 32%, 18%.

###### Heatmap (Custom `<Heatmap />`)

```tsx
<Heatmap
  data={result.heatmap}
  xAxis={['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']}
  yAxis={[7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(h => `${String(h).padStart(2,'0')}h`)}
  buckets={[
    { max: 0, color: '#F4F4F5' },     // sem reuniões
    { max: 2, color: '#DBEAFE' },     // 1-2
    { max: 5, color: '#93C5FD' },     // 3-5
    { max: 9, color: '#3B82F6' },     // 6-9
    { max: Infinity, color: '#1D4ED8' }, // 10+
  ]}
  legend
/>
```

Hover na célula → tooltip com `Seg 10h · 4 reuniões`. Em mobile (<768px): reduzir range pra 09h-18h.

###### Tabela "Performance por SDR"

Card `.tall` (min-height 500px) ou `.normal` se houver < 6 SDRs.

| # | Coluna | dataKey | Formato | Align | Sortable |
|---|---|---|---|---|---|
| 1 | SDR | `sdr` | string | left | sim |
| 2 | Agendou | `agendou` | `{n}` | center | sim (default desc) |
| 3 | Realizou | `realizou` | `{n}` | center | sim |
| 4 | Show | `show` | `{%}` ou `—` | center | sim |
| 5 | Propostas | `propostas` | `{n}` | center | sim |
| 6 | Tx prop. | `txProposta` | `{%}` ou `—` | center | sim |
| 7 | Valor prop. | `valorProp` | `R$ {sep, 0 dec}` | center | sim |
| 8 | Vendas | `vendas` | `{n}` | center | sim |
| 9 | Close | `close` | `{%}` ou `—` | center | sim |

###### Identidade visual

Idêntica às anteriores. Heatmap fora da paleta Metta no v1 (azul/cinza neutro pra clareza visual de intensidade — substituir por gradient amarelo Metta no v2 se preferir).

###### Acceptance

1. Filtros SDR/Status restringem heatmap E ranking simultaneamente.
2. Heatmap mostra concentração esperada (manhã 09-11h + tarde 14-16h).
3. Ranking ordena por Agendou desc por default; sortable por qualquer coluna.
4. KPI "Realizadas" = soma da coluna Realizou da tabela.
5. Mobile: heatmap reduz pra 09h-18h; tabela vira lista de cards.

#### 5.2.4 Página: Comercial / Closer (ex-Vendas/Receita)

**Filtros:**

| Filtro | Tipo | Opções | Default |
|---|---|---|---|
| Período | Date range | presets | Mês atual |
| Funis | Chips multi-select | Todos · Sala · Aplicação · Sessão · Isca · Reality | Todos |
| Produto | Select | Todos · Mentoria · Up-sell · Down-sell · (distinct de `vendas.produto`) | Todos |
| Pagamento | Select | Todos · Pix · Cartão à vista · Cartão parcelado · Boleto · Transferência | Todos |

**KPIs (5) com fórmulas:**

| KPI | Fórmula |
|---|---|
| Vendas | `count(vendas where dataCompra BETWEEN dates AND funilMatch AND produtoMatch AND pagamentoMatch)` |
| Receita | `sum(vendas.valorContrato where mesma condição)` |
| Ticket médio | `safeDiv(Receita, Vendas)` |
| ROAS | `safeDiv(Receita, Investimento do período)` |
| Ciclo médio | média de `dias(dataCompra - dataInscricaoLead)` quando lead existir; senão `dias(dataCompra - dataCadastroSnap)`. Ignora cicloVenda < 0 |

**Gráficos:**
- **Receita por funil (donut):** segmentos = funis com `sum(vendas.valorContrato)` por funil. Centro do donut = Receita total.
- **Evolução de receita 12 meses (linha + área):** eixo X = mês (rolling 12 meses), eixo Y = receita do mês. Linha tracejada = meta mensal (de aba `Metas`, métrica="Faturamento"). Áreas sombreadas = abaixo da meta (vermelho), acima (verde).

**Tabela "Vendas do período" (card tall, min 500px):**

| Coluna | Fórmula |
|---|---|
| Data | `vendas.dataCompra` |
| Comprador | `vendas.nomeComprador` |
| Funil | `vendas.funilCompra` (normalizado: Sala/Aplicação/Sessão/Isca/Reality/Up-sell) |
| Produto | `vendas.produto` |
| Valor | `vendas.valorContrato` (formatado R$) |
| SDR | quem agendou a reunião → join com `sdr.quemAgendou` via `sdr.email = lead.email = vendas.email` |
| Pagamento | `vendas.formaPagamento` |
| Ciclo | `dias(dataCompra - dataInscricao)` |

Min 10 linhas + "..." (paginação no v2).

**Tabela "Performance por closer":**

Estrutura idêntica à de SDR, mas agregada por `sdr.responsavel` (Closer) cruzado com `vendas`.

| Coluna | Fórmula |
|---|---|
| Closer | `distinct(sdr.responsavel)` |
| Agendou (recebeu) | `count(sdr where responsavel = Closer AND dataReuniao BETWEEN dates)` |
| Realizou | `count(... AND status="Realizada")` |
| Show | `safeRatio(Realizou, Agendou)` |
| Propostas | `count(... AND envioProposta IN {Sim, Fechada, Recusada})` |
| Tx prop. | `safeRatio(Propostas, Realizou)` |
| Valor prop. | `sum(sdr.valorProposta where condições acima)` |
| Vendas | `count(vendas where email IN (emails de SDR onde responsavel=Closer))` |
| Close | `safeRatio(Vendas, Propostas)` |

**Acceptance:**
- Ticket médio coincide com `sum(vendas.valor) / count(vendas)`.
- Closer "Vanessa" agrega só reuniões onde `sdr.responsavel = "Vanessa"`.
- Filtro de Produto restringe Vendas + Faturamento + Ticket médio + ROAS.
- Soma de Receita por funil no donut = Receita do KPI top.

##### 5.2.4.E Especificação execução-ready — Comercial Closer

###### Estrutura geral

| Item | Valor |
|---|---|
| Rota | `/dashboard/closer` |
| Arquivo | `app/(dashboard)/closer/page.tsx` |
| Abas Sheets | `sdr`, `vendas` |
| Função | `calcCloser(rawData, filters): CloserResult` em `lib/calc/closer.ts` |
| Layout | Filtros → 5 KPIs → Grid 2 (donut + linha 12 meses) → Tabela vendas (tall) → Tabela performance closers |

###### Filtros

| Filtro | Opções | Default |
|---|---|---|
| Período | DateRangePopover | Mês corrente |
| Funis | multi-select | Todos |
| Produto | Todos · Mentoria · Up-sell · Down-sell · (distinct de `vendas.produto`) | Todos |
| Pagamento | Todos · Pix · Cartão à vista · Cartão parcelado · Boleto · Transferência | Todos |

###### Type signatures

```typescript
type RawDataCloser = { sdr: SdrRow[]; vendas: VendaRow[]; leads?: LeadRow[] /* opcional pra ciclo */ };
type CloserFilters = Filters & { produto: string | 'todos'; pagamento: string | 'todos' };

type CloserResult = {
  kpis: {
    vendas: number;
    receita: number;
    ticketMedio: number | null;
    roas: number | null;     // precisa de Investido — buscar de fb_todos OU mostrar — se não houver
    cicloMedio: number | null;
  };
  receitaPorFunil: Array<{ funil: Funil | 'up-sell' | 'outros'; receita: number; pct: number }>;
  evolucao12Meses: Array<{ mes: Date; receita: number; meta: number | null }>;
  vendasDoPeriodo: Array<{
    data: Date;
    comprador: string;
    funil: string;
    produto: string;
    valor: number;
    sdr: string | null;
    pagamento: string;
    ciclo: number | null;
  }>;
  performanceClosers: Array<{
    closer: string;
    agendou: number;
    realizou: number;
    show: number | null;
    propostas: number;
    txProposta: number | null;
    valorProp: number;
    vendas: number;
    close: number | null;
  }>;
};
```

###### Função `calcCloser` — pseudocódigo

```typescript
export function calcCloser(raw: RawDataCloser, filters: CloserFilters): CloserResult {
  // 1. Filtros base
  const vendasFiltered = raw.vendas
    .filter(v => filters.funis.some(f => FUNIL_VENDAS_PATTERNS[f].test(v.funilCompra)) ||
                 (filters.funis.length === 5 /* todos */ && /up-sell/i.test(v.funilCompra)))
    .filter(v => filters.produto === 'todos' || v.produto === filters.produto)
    .filter(v => filters.pagamento === 'todos' || v.formaPagamento === filters.pagamento);

  const vendasInPeriod = filterByDate(vendasFiltered, v => v.dataCompra, filters.from, filters.to);

  // 2. KPIs
  const receita = sum(vendasInPeriod, v => v.valorContrato);
  const ticketMedio = safeDiv(receita, vendasInPeriod.length);
  const ciclos = vendasInPeriod.map(v => calcCicloVenda(v, /* lead opcional */));
  const cicloMedio = ciclos.length ? mean(ciclos.filter(c => c !== null)) : null;
  // ROAS requer fb_todos — pra simplificar v1, ROAS é placeholder (recalcular separadamente)

  // 3. Receita por funil (donut)
  const funisCounts = new Map<string, number>();
  for (const v of vendasInPeriod) {
    const f = normalizeFunilVenda(v.funilCompra); // 'sala' | 'aplica' | ... | 'up-sell' | 'outros'
    funisCounts.set(f, (funisCounts.get(f) ?? 0) + v.valorContrato);
  }
  const receitaPorFunil = Array.from(funisCounts.entries()).map(([funil, r]) => ({
    funil, receita: r, pct: receita > 0 ? r / receita : 0,
  })).sort((a, b) => b.receita - a.receita);

  // 4. Evolução 12 meses (rolling)
  const evolucao12Meses = last12Months(filters.to).map(mes => {
    const startMes = startOfMonth(mes);
    const endMes = endOfMonth(mes);
    const vendasMes = filterByDate(vendasFiltered, v => v.dataCompra, startMes, endMes);
    return {
      mes,
      receita: sum(vendasMes, v => v.valorContrato),
      meta: getMetaFaturamento(mes), // de aba Metas; null se não houver
    };
  });

  // 5. Vendas do período (lista)
  const sdrIndex = indexSdrByEmail(raw.sdr);
  const vendasDoPeriodo = vendasInPeriod.map(v => {
    const ciclo = calcCicloVenda(v, null);
    const sdrRecord = sdrIndex.get(v.email);
    return {
      data: v.dataCompra!,
      comprador: v.nomeComprador,
      funil: normalizeFunilLabel(v.funilCompra),
      produto: v.produto,
      valor: v.valorContrato,
      sdr: sdrRecord?.quemAgendou ?? null,
      pagamento: v.formaPagamento,
      ciclo,
    };
  }).sort((a, b) => b.data.getTime() - a.data.getTime());

  // 6. Performance closers (agrupar SDR por responsavel)
  const closers = uniq(raw.sdr.map(s => s.responsavel)).sort();
  const performanceClosers = closers.map(closer => {
    const minhas = raw.sdr.filter(s => s.responsavel === closer);
    const minhasInPeriod = filterByDate(minhas, s => s.dataReuniao, filters.from, filters.to);
    const realizadas = minhasInPeriod.filter(s => /realizada/i.test(s.status));
    const propostasArr = realizadas.filter(s => /sim|fechada|recusada/i.test(s.envioProposta));
    const meusEmails = new Set(realizadas.map(s => s.email));
    const minhasVendas = vendasInPeriod.filter(v => meusEmails.has(v.email));
    return {
      closer,
      agendou: minhasInPeriod.length,
      realizou: realizadas.length,
      show: safeRatio(realizadas.length, minhasInPeriod.length),
      propostas: propostasArr.length,
      txProposta: safeRatio(propostasArr.length, realizadas.length),
      valorProp: sum(propostasArr, p => p.valorProposta),
      vendas: minhasVendas.length,
      close: safeRatio(minhasVendas.length, propostasArr.length),
    };
  }).sort((a, b) => b.vendas - a.vendas);

  return { kpis: /* ... */, receitaPorFunil, evolucao12Meses, vendasDoPeriodo, performanceClosers };
}
```

###### KPIs (5)

| KPI | Formato | Sub-info |
|---|---|---|
| Vendas | `{n}` | — |
| Receita | `R$ {sep, 0 dec}` | — |
| Ticket médio | `R$ {sep, 0 dec}` | — |
| ROAS | `{n c/ 1 dec}x` | "acima da meta" / "abaixo da meta" |
| Ciclo médio | `{n} dias` | "inscrição → aceite" |

###### Gráfico — Receita por funil (Donut)

```tsx
<ResponsiveContainer width="100%" height={260}>
  <PieChart>
    <Pie data={receitaPorFunil} dataKey="receita" nameKey="funil" innerRadius={70} outerRadius={100}
         paddingAngle={2}>
      {receitaPorFunil.map((entry, i) => <Cell key={i} fill={FUNIL_COLORS[entry.funil]} />)}
    </Pie>
    <Tooltip formatter={(v, name) => [fmtCurrency(v), name]} />
  </PieChart>
</ResponsiveContainer>
{/* Label central com Receita total */}
```

Cores `FUNIL_COLORS`: Sala `#0C161B`, Aplicação `#435965`, Sessão `#688594`, Isca `#A8B3B9`, Reality `#FFBE18`, Up-sell `#FFCE50`, Outros `#EFF3F5`.

###### Gráfico — Evolução de receita 12 meses (Area + Line)

```tsx
<ComposedChart data={evolucao12Meses}>
  <Area type="monotone" dataKey="receita" fill="#FFBE18" fillOpacity={0.2} stroke="#FFBE18" strokeWidth={2} />
  <Line type="monotone" dataKey="meta" stroke="#0C161B" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
</ComposedChart>
```

###### Tabela "Vendas do período" (tall, min 500px)

| # | Coluna | dataKey | Formato | Align |
|---|---|---|---|---|
| 1 | Data | `data` | `dd/MM` | left |
| 2 | Comprador | `comprador` | string truncate 30 | left |
| 3 | Funil | `funil` | badge colorido por funil | center |
| 4 | Produto | `produto` | string | center |
| 5 | Valor | `valor` | `R$ {sep, 0 dec}` | center |
| 6 | SDR | `sdr` | string ou `—` | center |
| 7 | Pagamento | `pagamento` | string | center |
| 8 | Ciclo | `ciclo` | `{n}d` ou `—` | center |

Ordenação default: Data desc.

###### Tabela "Performance por closer"

Estrutura idêntica à de SDR (§5.2.3.E), mas:
- Coluna 1: "Closer" em vez de "SDR"
- Coluna 2: "Agendou (recebeu)" — closer recebe agendamento do SDR
- dataKey: `closer`, `agendou`, `realizou`, `show`, `propostas`, `txProposta`, `valorProp`, `vendas`, `close`

Ordenação default: Vendas desc (closer eficiência por fechamento).

###### Acceptance

1. KPI "Ticket médio" coincide com `Receita / Vendas` da mesma página.
2. Soma de receita do donut = Receita total dos KPIs.
3. Tabela "Vendas do período" lista todas as vendas com `dataCompra` no período + filtros aplicados.
4. Performance closers: somar Vendas de todos os closers = KPI Vendas.
5. Filtro Produto restringe vendas + receita + ticket médio.
6. Evolução 12 meses tem 12 pontos exatos; meta tracejada visível se aba Metas tem entradas.

#### 5.2.5 Página: Anúncios (ex-Criativo / Anúncio)

**Filtros:** Período, Funis (multi-select chips), Temperatura (Frio, Quente, Advantage, Todas).

**Unidade de análise:** `ad_name` (coluna `fb_todos.adName`). Um anúncio é único pelo nome.

**Fontes de dados:**

| Aba | Uso |
|---|---|
| `fb_todos` | Métricas de tráfego por ad_name (Invest, Impr, Cliques, LP Views, CTR, CPC, CPM) |
| `leads` | Atribuição de leads/MQL ao anúncio via `utm_content` |
| `sdr` | Agendamentos, Reuniões agendadas, Reuniões realizadas via `utm_content_snap` |
| `vendas` | Vendas + Faturamento via `utm_content_snap` |
| **`ads links`** | **Thumbnail (image_url) + link do Instagram (instagram_permalink_url) por ad_name** |

**Mecanismo de join anúncio × downstream:**

```
fb_todos.adName ──┬──→ leads.utmContent  → quantos leads/MQL esse anúncio gerou
                  ├──→ sdr.utmContentSnap → quantos agendamentos/reuniões
                  ├──→ vendas.utmContentSnap → quantas vendas + faturamento
                  └──→ ads_links.name → enriquece com thumbnail + Instagram permalink
```

**Convenção de UTM:** o `utm_content` do link do anúncio deve ser igual (ou substring) ao `ad_name` na Meta. Validação prática antes de prod: pegar 5 anúncios de teste, checar se `leads.utmContent` casa com `ad_name`. Se < 80% dos anúncios baterem, criar mapeamento manual em `lib/calc/anuncios-mapping.ts`.

**Layout principal:**
1. Filtros
2. Grid 3 cards "Top por…" (CPL · CMQL · Vendas)
3. Galeria de criativos (grid 4 colunas, thumbnail real + botão Instagram)
4. Tabela "Ranking de anúncios" (full-width, card `tall`)

**Fórmulas dos 3 cards "Top por":**

| Card | Métrica | Fórmula | Ordenação |
|---|---|---|---|
| Top por CPL | CPL por anúncio | `safeDiv(sum(amountSpent by adName), count(leads where utmContent matches adName))` | Ascendente (menor CPL = melhor entrega) |
| Top por CMQL | CMQL por anúncio | `safeDiv(sum(amountSpent by adName), count(leads MQL where utmContent matches adName))` | Ascendente |
| Top por vendas | Vendas por anúncio | `count(vendas where utmContentSnap matches adName)` | Descendente |

Cada card mostra **top 3** + métrica chave + contagem secundária (ex: "R$ 12,30 · 180 leads", "R$ 62 · 38 MQL", "3 vendas · R$ 124k").

**Galeria de criativos (grid 4 colunas desktop, 3 tablet, 2 mobile):**

Cada card:
- **Thumbnail real** vinda de `ads_links.image_url` (fallback `thumbnail_url`). Se ausente, placeholder hachurado.
- **Linha de título** com nome do anúncio à esquerda + **botão Instagram** à direita (gradient rosa/laranja). Click abre `ads_links.instagram_permalink_url` em nova aba. Se permalink vazio → botão desabilitado/oculto.
- 3 métricas básicas (CPL · CMQL · Vendas)

Ordenação default: por CMQL ascendente. Limite v1: 12 cards (paginação v2).

**Tabela "Ranking de anúncios" (NOVA — card `tall` 500px+):**

Card abaixo da galeria, full-width. Métricas de tráfego + métricas de funil cruzadas via `utm_content`. 15 colunas:

| # | Coluna | Fórmula |
|---|---|---|
| 1 | Anúncio | `fb_todos.adName` |
| 2 | Invest. | `sum(fb_todos.amountSpent where adName = X AND período + filtros)` |
| 3 | Impr. | `sum(fb_todos.impressions where adName = X AND ...)` |
| 4 | CTR | `safeRatio(sum(linkClicks), sum(impressions))` |
| 5 | CPC | `safeDiv(invest, sum(linkClicks))` |
| 6 | CPM | `safeDiv(invest × 1000, impressões)` |
| 7 | LP Views | `sum(fb_todos.landingPageViews where adName = X AND ...)` |
| 8 | Leads | `count(leads where utmContent matches adName AND dataInscricao no período AND funil match)` |
| 9 | CPL | `safeDiv(invest, leads)` |
| 10 | MQL | `count(leads ... AND qualif MQL)` |
| 11 | CMQL | `safeDiv(invest, mql)` |
| 12 | Agend. | `count(sdr where utmContentSnap matches adName AND dataAgendamento no período AND funil match)` |
| 13 | Reun. ag. | `count(sdr where ... AND dataReuniao no período)` |
| 14 | Reun. real. | `count(sdr where ... AND dataReuniao no período AND status="Realizada")` |
| 15 | Vendas | `count(vendas where utmContentSnap matches adName AND dataCompra no período AND funil match)` |

Ordenação default: CMQL ascendente. Sortable por qualquer coluna. 10 linhas visíveis + "…" (paginação v2).

**Filtros aplicados:** período + funis + temperatura recortam **TODOS** os números da página (cards top, galeria, tabela). Anúncio só aparece se sua `campaignName` matches os filtros.

**Tratamento de anúncios sem MQL:** ainda contam pra "Top por CPL" (têm leads) mas excluídos de "Top por CMQL" (denominador zero). Mostrar "—" no CMQL.

**Acceptance:**
- Ranking calculado por `ad_name` (= `fb_todos.adName`).
- Galeria mostra thumbnail real quando `ads_links` tem `image_url` pra esse `name`.
- Botão Instagram abre `ads_links.instagram_permalink_url` em nova aba. Botão oculto se permalink vazio.
- Tabela de ranking: cada linha tem Invest > 0 OU Leads > 0 (anúncio tem que ter atividade no período).
- Cruzamento `utm_content`: substring match em ambas direções (`utmContent.includes(adName) OR adName.includes(utmContent)`).
- Soma de "Leads" da tabela ≤ total de Leads da Visão Geral no mesmo filtro (anúncios sem match em utm_content ficam de fora).
- Filtro Temperatura/Funil/Período reduz coerentemente as 3 áreas (top cards + galeria + tabela).

##### 5.2.5.E Especificação execução-ready — Anúncios

###### Estrutura geral

| Item | Valor |
|---|---|
| Rota | `/dashboard/anuncios` |
| Arquivo | `app/(dashboard)/anuncios/page.tsx` |
| Abas Sheets | `fb_todos`, `leads`, `sdr`, `vendas`, **`ads links`** |
| Função | `calcAnuncios(rawData, filters): AnunciosResult` em `lib/calc/anuncios.ts` |
| Layout | Filtros → Grid 3 cards "Top por…" → Galeria (grid 4 cols, thumbnail + IG link) → **Tabela "Ranking de anúncios"** (full-width, tall) |

###### Filtros

| Filtro | Opções | Default |
|---|---|---|
| Período | DateRangePopover | Mês corrente |
| Funis | multi-select | Todos |
| Temperatura | Todas · Frio · Quente · Advantage | Todas |

###### Aba `ads links` (schema)

Alimentada pelo workflow `sync-ads-link.yml` do repo `metta-meta-sync`. Sync 1×/dia (06h BRT). Estrutura:

```typescript
// lib/sheets/schemas.ts
export const AdsLinkRowSchema = z.object({
  name: zString,                // A — chave de join com fb_todos.adName
  instagramPermalink: zString,  // B — instagram_permalink_url do creative
  imageUrl: zString,            // C — image_url ou thumbnail_url do creative
});
export type AdsLinkRow = z.infer<typeof AdsLinkRowSchema>;
```

Range a ler: `ads links!A:C` (3 colunas, headers em linha 1).

###### Type signatures

```typescript
type RawDataAnuncios = {
  fbTodos: FbTodosRow[];
  leads: LeadRow[];
  sdr: SdrRow[];
  vendas: VendaRow[];
  adsLinks: AdsLinkRow[];
};

type AnunciosFilters = Filters & {
  temperatura: 'todas' | 'frio' | 'quente' | 'adv';
};

type AdMetric = {
  adName: string;
  // Métricas de tráfego (de fb_todos)
  investido: number;
  impressoes: number;
  cliques: number;
  lpViews: number;
  // Derivadas de tráfego
  ctr: number | null;        // cliques / impressões
  cpc: number | null;        // invest / cliques
  cpm: number | null;        // (invest × 1000) / impressões
  cpl: number | null;        // invest / leads
  cmql: number | null;       // invest / mql
  // Métricas de funil (cruzadas via utm_content)
  leads: number;
  mql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  vendas: number;
  receita: number;
  // Enriquecimento via ads_links
  thumbnailUrl: string;      // "" se não houver match
  instagramPermalink: string;// "" se vazio na fonte ou sem match
};

type AnunciosResult = {
  topCpl: AdMetric[];        // top 3, ASC por cpl
  topCmql: AdMetric[];       // top 3, ASC por cmql
  topVendas: AdMetric[];     // top 3, DESC por vendas
  galeria: AdMetric[];       // até 12, ordenado por cmql ASC
  tabelaAnuncios: AdMetric[];// todos com atividade no período, ordenado por cmql ASC
};
```

###### Função `calcAnuncios` — pseudocódigo

```typescript
import {
  filterByFunilFbTodos, filterByFunilLeads,
  filterByDate, filterByTemperatura,
  dedupeLeadsByEmail, isMql, safeDiv, safeRatio, sum, groupBy,
} from './shared';

const UTM_RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;
const normalizeForMatch = (s: string) => s.toLowerCase().replace(/\s+/g, '_').trim();

/** Substring match bidirecional após normalização. Trata variações case + espaços. */
function utmMatchesAd(utmContent: string, adName: string): boolean {
  if (!utmContent || !adName) return false;
  const u = normalizeForMatch(utmContent);
  const a = normalizeForMatch(adName);
  return u === a || u.includes(a) || a.includes(u);
}

export function calcAnuncios(raw: RawDataAnuncios, filters: AnunciosFilters): AnunciosResult {
  // 1. Filtros base sobre fb_todos (escopo dos anúncios candidatos)
  const fbFiltered = filterByFunilFbTodos(raw.fbTodos, filters.funis);
  const fbByTemp = filterByTemperatura(fbFiltered, filters.temperatura);
  const fbInPeriod = filterByDate(fbByTemp, r => r.day, filters.from, filters.to);

  // 2. Filtros downstream
  const leadsFiltered = filterByFunilLeads(dedupeLeadsByEmail(raw.leads), filters.funis);
  const leadsInPeriod = filterByDate(leadsFiltered, l => l.dataInscricao, filters.from, filters.to);

  const sdrFiltered = raw.sdr.filter(s =>
    filters.funis.some(f => FUNIL_LEAD_PATTERNS[f].test(s.funil))
  );
  const sdrAgendInPeriod = filterByDate(sdrFiltered, s => s.dataAgendamento, filters.from, filters.to);
  const sdrReunInPeriod  = filterByDate(sdrFiltered, s => s.dataReuniao, filters.from, filters.to);

  const vendasFiltered = raw.vendas.filter(v =>
    filters.funis.some(f => FUNIL_VENDAS_PATTERNS[f].test(v.funilCompra))
  );
  const vendasInPeriod = filterByDate(vendasFiltered, v => v.dataCompra, filters.from, filters.to);

  // 3. Lookup de enriquecimento (ads_links → thumbnail + permalink)
  const adsLinksByName = new Map<string, AdsLinkRow>();
  for (const row of raw.adsLinks) {
    if (row.name) adsLinksByName.set(normalizeForMatch(row.name), row);
  }

  // 4. Agrupar fb_todos por adName
  const fbByAd = groupBy(fbInPeriod, r => r.adName);

  // 5. Pra cada anúncio: somar tráfego + join downstream + enriquecer
  const adMetrics: AdMetric[] = fbByAd.map(([adName, fbRows]) => {
    const investido = sum(fbRows, r => r.amountSpent);
    const impressoes = sum(fbRows, r => r.impressions);
    const cliques = sum(fbRows, r => r.linkClicks);
    const lpViews = sum(fbRows, r => r.landingPageViews);

    // Match leads via utmContent
    const leadsDoAd = leadsInPeriod.filter(l => utmMatchesAd(l.utmContent, adName));
    const mqlsDoAd = leadsDoAd.filter(l => isMql(l.qualificacao));

    // Match SDR via utm_content_snap (snapshot armazenado quando agendamento foi criado)
    const sdrAgendDoAd = sdrAgendInPeriod.filter(s => utmMatchesAd(s.utmContentSnap, adName));
    const sdrReunDoAd  = sdrReunInPeriod.filter(s => utmMatchesAd(s.utmContentSnap, adName));
    const sdrRealizadasDoAd = sdrReunDoAd.filter(s => /realizada/i.test(s.status));

    // Match vendas via utm_content_snap
    const vendasDoAd = vendasInPeriod.filter(v => utmMatchesAd(v.utmContentSnap, adName));

    // Enriquecimento
    const adsLink = adsLinksByName.get(normalizeForMatch(adName));

    return {
      adName,
      investido,
      impressoes,
      cliques,
      lpViews,
      ctr: safeRatio(cliques, impressoes),
      cpc: safeDiv(investido, cliques),
      cpm: safeDiv(investido * 1000, impressoes),
      cpl: safeDiv(investido, leadsDoAd.length),
      cmql: safeDiv(investido, mqlsDoAd.length),
      leads: leadsDoAd.length,
      mql: mqlsDoAd.length,
      agendamentos: sdrAgendDoAd.length,
      reunioesAgendadas: sdrReunDoAd.length,
      reunioesRealizadas: sdrRealizadasDoAd.length,
      vendas: vendasDoAd.length,
      receita: sum(vendasDoAd, v => v.valorContrato),
      thumbnailUrl: adsLink?.imageUrl ?? '',
      instagramPermalink: adsLink?.instagramPermalink ?? '',
    };
  });

  // 6. Top 3 cards
  const topCpl = adMetrics
    .filter(a => a.leads > 0)
    .sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity))
    .slice(0, 3);

  const topCmql = adMetrics
    .filter(a => a.mql > 0)
    .sort((a, b) => (a.cmql ?? Infinity) - (b.cmql ?? Infinity))
    .slice(0, 3);

  const topVendas = adMetrics
    .filter(a => a.vendas > 0)
    .sort((a, b) => b.vendas - a.vendas)
    .slice(0, 3);

  // 7. Galeria — limite 12, ordenado por CMQL ASC (sem MQL no fim)
  const galeria = [...adMetrics]
    .sort((a, b) => (a.cmql ?? Infinity) - (b.cmql ?? Infinity))
    .slice(0, 12);

  // 8. Tabela — todos com atividade no período (Invest > 0 OU Leads > 0)
  const tabelaAnuncios = adMetrics
    .filter(a => a.investido > 0 || a.leads > 0)
    .sort((a, b) => (a.cmql ?? Infinity) - (b.cmql ?? Infinity));

  return { topCpl, topCmql, topVendas, galeria, tabelaAnuncios };
}
```

###### 3 cards "Top por" (`<TopList />`)

Cada card é uma lista vertical de 3 itens. Sem alteração em relação à versão anterior do PRD.

| Card | mainValue | secondaryValue |
|---|---|---|
| Top por CPL | `R$ {cpl c/ 2 dec}` | `{leads} leads` |
| Top por CMQL | `R$ {cmql c/ 0 dec}` | `{mql} MQL` |
| Top por vendas | `{vendas} vendas` | `R$ {receita c/ sep, 0 dec}` (k se > 100k) |

Empty: "Sem anúncios com [métrica] atribuídos no período."

###### Galeria de criativos (`<CreativeGallery />`)

Grid 4 colunas desktop, 3 tablet, 2 mobile. Cada card tem 2 melhorias relevantes vs versão anterior:

**1. Thumbnail real** vinda de `ad.thumbnailUrl` (que sai de `ads_links.imageUrl`).
**2. Botão Instagram** ao lado do nome, abre `ad.instagramPermalink` em nova aba.

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
  {galeria.map(ad => (
    <article key={ad.adName} className="overflow-hidden bg-white border border-[#EFF3F5] rounded-md">
      {/* Thumbnail */}
      <div className="aspect-square bg-[repeating-linear-gradient(45deg,#F1F5F9,#F1F5F9_6px,#E2E8F0_6px,#E2E8F0_12px)] relative">
        {ad.thumbnailUrl ? (
          <img
            src={ad.thumbnailUrl}
            alt={ad.adName}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-[#94A3B8]">
            sem thumbnail
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="flex justify-between items-start gap-1.5 mb-1">
          <b className="text-[12px] font-medium leading-tight truncate flex-1 min-w-0" title={ad.adName}>
            {ad.adName}
          </b>
          {ad.instagramPermalink && (
            <a
              href={ad.instagramPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-[22px] h-[22px] rounded-md inline-flex items-center justify-center text-white bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-85"
              title="Abrir no Instagram"
              aria-label={`Abrir ${ad.adName} no Instagram`}
            >
              <ExternalLinkIcon className="w-3 h-3" />
            </a>
          )}
        </div>
        <small className="text-[11px] text-[#688594]">
          CPL {fmt(ad.cpl)} · CMQL {fmt(ad.cmql)} · {ad.vendas} vendas
        </small>
      </div>
    </article>
  ))}
</div>
```

**Comportamento do botão Instagram:**
- Renderizado apenas se `ad.instagramPermalink !== ''`.
- `target="_blank" rel="noopener noreferrer"` — abre nova aba sem dar referrer.
- Estilo: gradiente Instagram (laranja → magenta), 22×22px, radius 5px, ícone external-link 12×12.

**Fallback de thumbnail:** quando `ad.thumbnailUrl` vazio, mantém o pattern hachurado e mostra "sem thumbnail" sutil no centro.

###### Tabela "Ranking de anúncios" (`<MetricTable>`)

Componente: card `tall` (min-height 500px), full-width, abaixo da galeria.

| # | Coluna | dataKey | Tipo | Formato | Align | Sortable |
|---|---|---|---|---|---|---|
| 1 | Anúncio | `adName` | string | truncate 40 chars + tooltip | left | sim |
| 2 | Invest. | `investido` | number | `R$ {sep, 0 dec}` | center | sim (default desc se Invest) |
| 3 | Impr. | `impressoes` | number | `{abreviado k/M}` | center | sim |
| 4 | CTR | `ctr` | number\|null | `{n*100 c/ 1 dec}%` ou `—` | center | sim |
| 5 | CPC | `cpc` | number\|null | `R$ {2 dec}` ou `—` | center | sim |
| 6 | CPM | `cpm` | number\|null | `R$ {0 dec}` ou `—` | center | sim |
| 7 | LP Views | `lpViews` | number | `{n com sep}` | center | sim |
| 8 | Leads | `leads` | number | `{n}` | center | sim |
| 9 | CPL | `cpl` | number\|null | `R$ {2 dec}` ou `—` | center | sim |
| 10 | MQL | `mql` | number | `{n}` | center | sim |
| 11 | CMQL | `cmql` | number\|null | `R$ {0 dec}` ou `—` | center | sim (default ASC) |
| 12 | Agend. | `agendamentos` | number | `{n}` | center | sim |
| 13 | Reun. ag. | `reunioesAgendadas` | number | `{n}` | center | sim |
| 14 | Reun. real. | `reunioesRealizadas` | number | `{n}` | center | sim |
| 15 | Vendas | `vendas` | number | `{n}` | center | sim |

10 linhas visíveis + "…" (paginação no v2). Virtualizar se > 50 linhas.

Toolbar opcional (futuro): input de busca por nome do anúncio (filtro client-side, < 100ms).

###### Identidade visual

- Card top, galeria, tabela: bg `#FFFFFF`, border `#EFF3F5`, radius 12px.
- Thumbnail aspect-square: `object-cover` na imagem real; fallback com pattern hachurado.
- Botão Instagram: gradient `linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)`, 22×22px, radius 5px. **Único elemento da página fora da paleta Metta** — necessário pra ser reconhecível como botão do Instagram.
- Headers de tabela: uppercase 11px, tracking +9%, `#435965`.
- Linhas hover: bg `#FAFCFD`.

###### Acceptance

1. **Galeria — thumbnail:** quando `ads_links` tem `image_url` pro `name` correspondente, a imagem real renderiza; senão, mostra pattern hachurado.
2. **Galeria — botão Instagram:** quando `ads_links.instagram_permalink_url !== ''`, botão renderiza e abre o link em nova aba; senão, botão não aparece.
3. **Top CPL:** ordena por menor CPL primeiro. Anúncios sem leads excluídos.
4. **Top CMQL:** anúncios sem MQL excluídos (sem denominador). Mostra "—" no CMQL na galeria.
5. **Top vendas:** anúncios sem venda excluídos.
6. **Tabela — escopo:** só aparecem anúncios com `Invest > 0` OU `Leads > 0` no período + filtros.
7. **Tabela — cruzamento utm_content:**
   - Soma `Leads` da tabela ≤ total de Leads da Visão Geral (mesmo filtro).
   - Soma `Vendas` da tabela ≤ total de Vendas da Visão Geral (mesmo filtro).
   - Diferença = leads/vendas sem `utm_content` que case com algum `ad_name`.
8. **Match utm_content:** caso < 80% dos anúncios bater no test sintético, criar mapeamento manual em `lib/calc/anuncios-mapping.ts`.
9. **Filtro Temperatura/Funil/Período:** reduz top cards + galeria + tabela coerentemente.
10. **Mobile (<768px):** galeria vira 2 cols; tabela vira scroll horizontal com primeira coluna sticky.

#### 5.2.6 Página: Origem

**Filtros:** Período, Funis (multi-select chips).

**Estrutura:** 7 cards empilhados (cada um uma tabela com as mesmas 7 colunas-métrica):

| Card | Dimensão (coluna 1) | Fonte da dimensão |
|---|---|---|
| Por UTM Source | `leads.J` distinct | leads |
| Por UTM Medium | `leads.K` distinct | leads |
| Por UTM Campaign | `leads.L` distinct | leads |
| Por Qualificação | Enterprise / MQL 1 / MQL 2 | leads |
| Por Cargo | Empresário / Sócio / CEO / Diretor de vendas / Gerente / Outros | leads |
| Por Faixa de Faturamento | 7 faixas qualificadas (filtra "No ICP") | leads |
| Por Segmento de Mercado | 6 segmentos | leads |

**Colunas-métrica (idênticas em todos os 7 cards):**
- Leads qualif. (count leads onde qualificacao matches MQL_PATTERNS)
- MQL (mesmo que Leads qualif. nesse contexto — alias)
- Agendamentos (count sdr where email matches lead.email)
- Reuniões agendadas (count sdr)
- Reuniões realizadas (count sdr where status="Realizada")
- Vendas (count vendas where email matches lead.email)
- Faturamento (sum vendas.valor where email matches)

**Acceptance:**
- A soma de "Leads qualif." em todos os UTM Source bate com o total geral de leads qualificados no período.
- Faixa de Faturamento exclui as 3 faixas "No ICP" (até 100 mil).

##### 5.2.6.E Especificação execução-ready — Origem

###### Estrutura geral

| Item | Valor |
|---|---|
| Rota | `/dashboard/origem` |
| Arquivo | `app/(dashboard)/origem/page.tsx` |
| Abas Sheets | `leads`, `sdr`, `vendas` |
| Função | `calcOrigem(rawData, filters): OrigemResult` em `lib/calc/origem.ts` |
| Layout | Filtros → 7 cards empilhados (cada um uma tabela com as mesmas 7 colunas de métrica) |

###### Filtros

| Filtro | Opções | Default |
|---|---|---|
| Período | DateRangePopover | Mês corrente |
| Funis | multi-select | Todos |

###### Type signatures

```typescript
type RawDataOrigem = { leads: LeadRow[]; sdr: SdrRow[]; vendas: VendaRow[] };

type OrigemMetrics = {
  leadsQualif: number;
  mql: number;
  agendamentos: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  vendas: number;
  faturamento: number;
};

type OrigemRow = { dimensao: string } & OrigemMetrics;

type OrigemResult = {
  porUtmSource: OrigemRow[];
  porUtmMedium: OrigemRow[];
  porUtmCampaign: OrigemRow[];
  porQualificacao: OrigemRow[];     // sempre 3: Enterprise, MQL 1, MQL 2
  porCargo: OrigemRow[];             // 6: Empresário, Sócio, CEO, Diretor de vendas, Gerente, Outros
  porFaturamento: OrigemRow[];       // só faixas qualificadas (7)
  porSegmento: OrigemRow[];          // 6: Indústria, Varejo, Serviços, Tecnologia, Agronegócio, Marketing
};
```

###### Função `calcOrigem` — pseudocódigo

```typescript
export function calcOrigem(raw: RawDataOrigem, filters: Filters): OrigemResult {
  // 1. Filtros base
  const leadsFiltered = filterByFunilLeads(dedupeLeadsByEmail(raw.leads), filters.funis);
  const leadsInPeriod = filterByDate(leadsFiltered, l => l.dataInscricao, filters.from, filters.to);

  // Pra agendamentos/reuniões: SDR tem snapshot do lead na N-AB. Filtrar SDR por funil + período.
  const sdrFiltered = raw.sdr.filter(s => filters.funis.some(f => FUNIL_LEAD_PATTERNS[f].test(s.funil)));
  const sdrAgendInPeriod = filterByDate(sdrFiltered, s => s.dataAgendamento, filters.from, filters.to);
  const sdrReunInPeriod = filterByDate(sdrFiltered, s => s.dataReuniao, filters.from, filters.to);

  // Vendas filtradas
  const vendasFiltered = raw.vendas.filter(v => filters.funis.some(f => FUNIL_VENDAS_PATTERNS[f].test(v.funilCompra)));
  const vendasInPeriod = filterByDate(vendasFiltered, v => v.dataCompra, filters.from, filters.to);

  // Index pra join via email
  const leadByEmail = indexLeadsByEmail(leadsInPeriod);

  // 2. Função genérica de agrupamento — dado um getter de dimensão, retorna OrigemRow[]
  function agregarPor(
    getDim: (l: LeadRow) => string,
    valoresValidos?: string[]   // se fornecido, filtra rows pra esses valores apenas
  ): OrigemRow[] {
    const bucketMap = new Map<string, OrigemMetrics>();
    // bucket de cada lead qualificado
    for (const lead of leadsInPeriod) {
      const dim = getDim(lead);
      if (!dim) continue;
      if (valoresValidos && !valoresValidos.includes(dim)) continue;
      if (!bucketMap.has(dim)) {
        bucketMap.set(dim, { leadsQualif: 0, mql: 0, agendamentos: 0, reunioesAgendadas: 0, reunioesRealizadas: 0, vendas: 0, faturamento: 0 });
      }
      const b = bucketMap.get(dim)!;
      if (isMql(lead.qualificacao)) { b.leadsQualif++; b.mql++; }
    }
    // join agendamentos via sdr.email × leads.email
    for (const s of sdrAgendInPeriod) {
      const lead = leadByEmail.get(s.email);
      if (!lead) continue;
      const dim = getDim(lead);
      const b = bucketMap.get(dim);
      if (b) b.agendamentos++;
    }
    for (const s of sdrReunInPeriod) {
      const lead = leadByEmail.get(s.email);
      if (!lead) continue;
      const dim = getDim(lead);
      const b = bucketMap.get(dim);
      if (!b) continue;
      b.reunioesAgendadas++;
      if (/realizada/i.test(s.status)) b.reunioesRealizadas++;
    }
    for (const v of vendasInPeriod) {
      const lead = leadByEmail.get(v.email);
      if (!lead) continue;
      const dim = getDim(lead);
      const b = bucketMap.get(dim);
      if (!b) continue;
      b.vendas++;
      b.faturamento += v.valorContrato;
    }
    return Array.from(bucketMap.entries()).map(([dimensao, metrics]) => ({ dimensao, ...metrics }))
      .sort((a, b) => b.leadsQualif - a.leadsQualif);
  }

  return {
    porUtmSource:     agregarPor(l => l.utmSource),
    porUtmMedium:     agregarPor(l => l.utmMedium),
    porUtmCampaign:   agregarPor(l => l.utmCampaign),
    porQualificacao:  agregarPor(l => normalizeQualif(l.qualificacao), ['Enterprise', 'MQL 1', 'MQL 2']),
    porCargo:         agregarPor(l => l.cargo, ['Empresário', 'Sócio', 'CEO', 'Diretor de vendas', 'Gerente', 'Outros']),
    porFaturamento:   agregarPor(l => l.faturamento, FATURAMENTO_FAIXAS_QUALIFICADAS),
    porSegmento:      agregarPor(l => l.segmento, ['Indústria', 'Varejo', 'Serviços', 'Tecnologia', 'Agronegócio', 'Marketing']),
  };
}

const FATURAMENTO_FAIXAS_QUALIFICADAS = [
  'Acima de 4 milhões', 'De 1 milhão a 4 milhões',
  'De 701 mil a 1 milhão', 'De 501 mil a 700 mil',
  'De 301 mil a 500 mil', 'De 201 mil a 300 mil',
  'De 101 mil a 200 mil',
];
```

###### 7 cards (cada um uma tabela)

Layout: 7 cards empilhados (NÃO grid 2 colunas — decisão visual do usuário).

Template de cada card:

```tsx
<Card>
  <CardTitle>{titulo}</CardTitle>
  <MetricTable
    columns={[
      { id: 'dimensao', header: titleColumn[i], align: 'left' },
      { id: 'leadsQualif', header: 'Leads qualif.', format: 'integer', align: 'center' },
      { id: 'mql', header: 'MQL', format: 'integer', align: 'center' },
      { id: 'agendamentos', header: 'Agend.', format: 'integer', align: 'center' },
      { id: 'reunioesAgendadas', header: 'Reun. ag.', format: 'integer', align: 'center' },
      { id: 'reunioesRealizadas', header: 'Reun. real.', format: 'integer', align: 'center' },
      { id: 'vendas', header: 'Vendas', format: 'integer', align: 'center' },
      { id: 'faturamento', header: 'Faturamento', format: 'currency-0', align: 'center', emptyValue: '—' /* quando 0 */ },
    ]}
    data={result[card]}
    sortable
    defaultSort={{ id: 'leadsQualif', direction: 'desc' }}
  />
</Card>
```

| Card | Título | Coluna 1 (header) |
|---|---|---|
| 1 | Por UTM Source | Origem |
| 2 | Por UTM Medium | Origem |
| 3 | Por UTM Campaign | Campanha |
| 4 | Por Qualificação | Qualificação |
| 5 | Por Cargo | Cargo |
| 6 | Por Faixa de Faturamento <small>apenas leads qualificados</small> | Faturamento |
| 7 | Por Segmento de Mercado | Segmento |

###### Identidade visual

- Card: bg branco, border `#EFF3F5`, radius 12px
- Title: SF Pro 650 13px tracking -0.005em
- Small (dentro do title — só no card 6): SF Pro 400 11px `#688594`
- Tabela: header uppercase, body 13px, faturamento em itálico se = 0 → `—`

###### Acceptance

1. Soma de "Leads qualif." em todos os UTM Source = total geral de leads MQL no período.
2. Card 6 exclui faixas "Até 50 mil", "De 51 a 70 mil", "De 71 mil a 100 mil" (no-ICP).
3. Card 4: 3 linhas exatas (Enterprise / MQL 1 / MQL 2). Sem linha "Outros".
4. Card 5: 6 cargos. "Gerente" e "Outros" sem MQL (não decisores).
5. Join lead × sdr × vendas funciona — se vendas têm email correspondente em leads, vendas aparece na linha.
6. Soma vertical bate com soma da Visão Geral (mesmo período + funis).

#### 5.2.7 Página: Metas vs Realizado

> **⚠️ Aviso de divergência:** O wireframe HTML atual (em `dashboard-wireframes.html`) tem estrutura ANTIGA da página Metas (3 cards de progress simples: Receita / Vendas / CPL + Projeção + Pacing + Histórico). O PRD documenta a estrutura NOVA decidida em conversa: Hero KPI Faturamento + Tabela funil meta vs real + 4 cards de taxa + Gráfico de pacing. **A estrutura do PRD é a oficial.** Na implementação, ignorar o wireframe pra essa página específica e seguir a especificação abaixo. O wireframe será atualizado em momento separado.

**Filtros:** Período, Funil, Produto (Mentoria pré-selecionada).

**Comportamento month-to-date:** se o filtro abrange parte de um mês, a meta é proporcional aos dias selecionados.

Exemplo:
- Meta de Maio: R$ 30.000
- Mês de Maio tem 31 dias
- Filtro: 01-14 de Maio (14 dias)
- Meta MTD = R$ 30.000 × (14/31) = R$ 13.548

**Hero KPI:** Faturamento (banner grande)
```
FATURAMENTO          R$ 290.000 / R$ 420.000 (meta MTD)
                     ━━━━━━━━━━━━━━━━━━━━━░░░░░░  69%
                     Gap R$ 130.000        Projeção R$ 415.000
```

**Tabela funil meta vs real (etapa por etapa):**

| Etapa | Real | Meta MTD | % | Gap |
|---|---|---|---|---|
| Investimento | R$ 14.000 | R$ 14.000 | 100% | — |
| MQL | 482 | 450 | 107% ↑ | +32 |
| Agendamentos | 89 | 108 | 82% ↓ | -19 |
| Reuniões agendadas | 76 | 90 | 84% ↓ | -14 |
| Reuniões realizadas | 38 | 54 | 70% ↓ | -16 |
| Vendas | 7 | 10 | 70% ↓ | -3 |

**Cards de taxa (4 cards horizontais):**

| Taxa | Real | Meta |
|---|---|---|
| CMQL | R$ 29 | R$ 31 |
| Tx Agendamento/MQL | 18% | 24% |
| Tx Reun. realizada/Reun. agendada | 50% | 60% |
| Conversão Vendas/Reun. realizada | 18% | 18,5% |

**Gráfico de pacing (rodapé):**
- Linha sólida: realizado dia a dia (acumulado)
- Linha tracejada: meta acumulada esperada (rampa proporcional)
- Linha horizontal: meta total do mês

**Acceptance:**
- Aba `Metas` é a única fonte. Mudança lá reflete no dashboard após 10 min (cache).
- Meta proporcional bate com `(meta_total × dias_no_filtro / dias_no_mês)`.
- Sem aba Metas → mostrar placeholder "Configure a aba Metas na planilha".

##### 5.2.7.E Especificação execução-ready — Metas vs Realizado

###### Proposta da aba `Metas` na planilha

**Pré-requisito da página.** Estrutura proposta pra criar manualmente na planilha BASE DE DADOS - PALIATIVO:

**Colunas (linha 1 = headers):**

| # | Coluna | Tipo | Exemplo | Notas |
|---|---|---|---|---|
| A | Mês | date | `01/05/2026` | Primeiro dia do mês. Formato date Sheets (não string). |
| B | Funil | string | `Sessão` | Valores aceitos: `Sala` · `Aplicação` · `Sessão` · `Isca` · `Reality` · `Todos` |
| C | Métrica | string | `Faturamento` | Valores aceitos: `Investimento` · `MQL` · `CMQL` · `Agendamentos` · `Reuniões agendadas` · `Reuniões realizadas` · `Vendas` · `Faturamento` · `Show` · `Tx Agend/MQL` · `Tx Reun/MQL` · `Conv R→V` |
| D | Valor | number/currency | `30000` ou `R$ 30.000,00` | Meta absoluta do mês. Taxas em decimal (0.20 = 20%) ou percent (Sheets). |

**Exemplo preenchido (linhas 2+):**

```
Mês          | Funil    | Métrica              | Valor
01/05/2026   | Todos    | Investimento         | 14000
01/05/2026   | Todos    | MQL                  | 450
01/05/2026   | Todos    | CMQL                 | 31
01/05/2026   | Todos    | Agendamentos         | 108
01/05/2026   | Todos    | Reuniões agendadas   | 90
01/05/2026   | Todos    | Reuniões realizadas  | 54
01/05/2026   | Todos    | Vendas               | 10
01/05/2026   | Todos    | Faturamento          | 420000
01/05/2026   | Todos    | Tx Agend/MQL         | 0.24
01/05/2026   | Todos    | Show                 | 0.60
01/05/2026   | Todos    | Conv R→V             | 0.185
01/05/2026   | Sessão   | Faturamento          | 250000
01/05/2026   | Aplicação| Faturamento          | 120000
... (continua por mês e funil)
```

**Convenção de preenchimento:**
- Para cada mês, criar pelo menos as linhas de funil = `Todos` (KPIs principais).
- Funis individuais (Sala, Sessão, etc) opcionais — usados se filtro de página = funil específico. Se não houver, dashboard usa proporcional da meta "Todos".
- Métricas faltantes → mostra `—` na coluna Meta MTD da página.
- Mês precisa estar com **primeiro dia do mês** exato (`01/MM/YYYY`), não meio.

**Fluxo de atualização mensal:**

1. No primeiro dia do mês, o Alisson abre a aba `Metas`
2. Adiciona linhas pro novo mês (copy-paste do mês anterior + ajustes)
3. Salva — não precisa fazer mais nada. Dashboard puxa no próximo cron (10 min)
4. (Opcional) testar via `/api/revalidate` pra ver imediato

**Quando adicionar a aba:**

Fase 4.7 do roteiro (Metas é a última página implementada). Antes disso, página Metas mostra placeholder.

###### Estrutura geral

| Item | Valor |
|---|---|
| Rota | `/dashboard/metas` |
| Arquivo | `app/(dashboard)/metas/page.tsx` |
| Abas Sheets | `fb_todos`, `leads`, `sdr`, `vendas`, **`Metas`** |
| Função | `calcMetas(rawData, filters): MetasResult` em `lib/calc/metas.ts` |
| Layout | Filtros → Hero KPI Faturamento → Tabela funil meta×real → 4 cards de taxa → Gráfico pacing |

###### Filtros

| Filtro | Opções | Default |
|---|---|---|
| Período | DateRangePopover | Mês corrente |
| Funis | multi-select | Todos |
| Produto | Todos · Mentoria · Up-sell · Down-sell | **Mentoria** (pré-selecionado) |

###### Type signatures

```typescript
type RawDataMetas = {
  fbTodos: FbTodosRow[];
  leads: LeadRow[];
  sdr: SdrRow[];
  vendas: VendaRow[];
  metas: MetaRow[];
};

type MetasFilters = Filters & { produto: string };

type MetricaMetaReal = {
  nome: string;
  realValor: number;
  metaMtdValor: number | null;        // null se sem meta cadastrada
  pctAtingimento: number | null;
  gap: number | null;                  // realValor - metaMtdValor
};

type MetasResult = {
  hero: {
    realFaturamento: number;
    metaFaturamentoMtd: number | null;
    pctAtingimento: number | null;
    gap: number | null;
    projecaoFimDoMes: number;          // (real / diasDecorridos) × diasDoMes
  };
  tabelaFunil: MetricaMetaReal[];        // 7 métricas: Invest, MQL, Agend, Reun ag, Reun real, Vendas, Faturamento
  cardsTaxa: Array<{
    nome: string;                        // "CMQL", "Tx Agendamento/MQL", "Tx Reun realizada/Reun agendada", "Conversão Vendas/Reun realizada"
    realValor: number | null;
    metaValor: number | null;
    isInverse?: boolean;                 // CMQL é "menor é melhor"; outras "maior é melhor"
  }>;
  pacingChart: Array<{
    date: Date;
    realAcumulado: number;
    metaAcumulada: number | null;
  }>;
};
```

###### Função `calcMetas` — pseudocódigo

```typescript
export function calcMetas(raw: RawDataMetas, filters: MetasFilters): MetasResult {
  // 1. Calcular realizado (reutiliza calcVisaoGeral filtrado)
  const real = calcVisaoGeral({ fbTodos: raw.fbTodos, leads: raw.leads, sdr: raw.sdr, vendas: raw.vendas.filter(v => filters.produto === 'todos' || v.produto === filters.produto) }, filters);

  // 2. Buscar metas do mês corrente (pra cada funil selecionado)
  const mesFiltro = startOfMonth(filters.from);
  const diasNoFiltro = daysBetween(filters.from, filters.to);
  const diasNoMes = daysInMonth(mesFiltro);
  const fatorMtd = diasNoFiltro / diasNoMes;

  function getMeta(metrica: string, funis: Funil[]): number | null {
    // Se filtro = todos, usar linha "Todos"; senão somar metas dos funis individuais
    const funilLabel = funis.length === 5 ? 'Todos' : (funis.length === 1 ? capitalize(funis[0]) : null);
    if (funilLabel) {
      const meta = raw.metas.find(m =>
        isSameMonth(m.mes, mesFiltro) && m.funil === funilLabel && m.metrica === metrica
      );
      return meta ? meta.valor : null;
    }
    // Múltiplos funis: somar metas individuais (ou null se faltar algum)
    const valores = funis.map(f => {
      const meta = raw.metas.find(m => isSameMonth(m.mes, mesFiltro) && m.funil === capitalize(f) && m.metrica === metrica);
      return meta?.valor;
    });
    if (valores.some(v => v == null)) return null;
    return valores.reduce((s, v) => s + v!, 0);
  }

  function metaMtd(metrica: string): number | null {
    const full = getMeta(metrica, filters.funis);
    return full === null ? null : full * fatorMtd;
  }

  // 3. Hero
  const realFat = real.kpis.receita;
  const metaFat = metaMtd('Faturamento');
  const hero = {
    realFaturamento: realFat,
    metaFaturamentoMtd: metaFat,
    pctAtingimento: safeRatio(realFat, metaFat),
    gap: metaFat != null ? realFat - metaFat : null,
    projecaoFimDoMes: diasNoFiltro > 0 ? (realFat / diasNoFiltro) * diasNoMes : 0,
  };

  // 4. Tabela funil
  const tabelaFunil: MetricaMetaReal[] = [
    { nome: 'Investimento', realValor: real.kpis.investido, metaMtdValor: metaMtd('Investimento') },
    { nome: 'MQL', realValor: real.kpis.mql, metaMtdValor: metaMtd('MQL') },
    { nome: 'Agendamentos', realValor: real.funil.agendamentos, metaMtdValor: metaMtd('Agendamentos') },
    { nome: 'Reuniões agendadas', realValor: real.funil.reunioesAgendadas, metaMtdValor: metaMtd('Reuniões agendadas') },
    { nome: 'Reuniões realizadas', realValor: real.kpis.reunioesRealizadas, metaMtdValor: metaMtd('Reuniões realizadas') },
    { nome: 'Vendas', realValor: real.kpis.vendas, metaMtdValor: metaMtd('Vendas') },
    { nome: 'Faturamento', realValor: realFat, metaMtdValor: metaFat },
  ].map(row => ({
    ...row,
    pctAtingimento: row.metaMtdValor === null ? null : safeRatio(row.realValor, row.metaMtdValor),
    gap: row.metaMtdValor === null ? null : row.realValor - row.metaMtdValor,
  }));

  // 5. Cards de taxa (4)
  const cardsTaxa = [
    { nome: 'CMQL', realValor: real.kpis.cmql, metaValor: getMeta('CMQL', filters.funis), isInverse: true },
    { nome: 'Tx Agendamento/MQL', realValor: safeRatio(real.funil.agendamentos, real.kpis.mql), metaValor: getMeta('Tx Agend/MQL', filters.funis) },
    { nome: 'Tx Reun. realizada/Reun. agendada', realValor: real.kpis.show, metaValor: getMeta('Show', filters.funis) },
    { nome: 'Conversão Vendas/Reun. realizada', realValor: real.kpis.convReunParaVenda, metaValor: getMeta('Conv R→V', filters.funis) },
  ];

  // 6. Pacing chart (dia a dia)
  const pacingChart = groupByDay(startOfMonth(filters.from), filters.to, day => {
    const realAcumulado = sum(raw.vendas.filter(v => v.dataCompra && v.dataCompra <= day && (filters.produto === 'todos' || v.produto === filters.produto)), v => v.valorContrato);
    const diasDecorridos = daysBetween(startOfMonth(filters.from), day);
    const metaAcumulada = metaFat !== null ? (metaFat / fatorMtd) * (diasDecorridos / diasNoMes) : null;
    return { date: day, realAcumulado, metaAcumulada };
  });

  return { hero, tabelaFunil, cardsTaxa, pacingChart };
}
```

###### Hero KPI — Faturamento (banner grande)

```tsx
<div className="card flex flex-col gap-4 p-6">
  <div className="text-[11px] uppercase tracking-[0.09em] text-[#435965] font-medium">FATURAMENTO</div>
  <div className="flex items-baseline gap-3">
    <span className="text-[36px] font-[870] tabular-nums">{fmtCurrency(hero.realFaturamento)}</span>
    <span className="text-[14px] text-[#688594]">/ {hero.metaFaturamentoMtd ? fmtCurrency(hero.metaFaturamentoMtd) : '— meta não cadastrada'} (meta MTD)</span>
  </div>
  <Progress value={(hero.pctAtingimento ?? 0) * 100} max={100} className="h-2" />
  <div className="flex justify-between text-[12.5px] text-[#688594]">
    <span>{hero.pctAtingimento !== null ? `${fmtPct(hero.pctAtingimento)} atingido` : '—'}</span>
    <span>{hero.gap !== null ? `Gap ${fmtCurrency(hero.gap)}` : ''}</span>
    <span>Projeção {fmtCurrency(hero.projecaoFimDoMes)}</span>
  </div>
</div>
```

Empty (meta não cadastrada): mostra valor real grande + texto "Configure a meta deste mês na aba `Metas` da planilha" em vez de progress.

###### Tabela funil meta×real

| # | Coluna | dataKey | Formato | Align |
|---|---|---|---|---|
| 1 | Etapa | `nome` | string | left |
| 2 | Real | `realValor` | depende da métrica (currency/integer) | center |
| 3 | Meta MTD | `metaMtdValor` | mesma da Real, ou `—` se null | center |
| 4 | % | `pctAtingimento` | `{n*100 c/ 0 dec}%` ou `—`; verde ≥ 100%, amarelo 70-99%, vermelho < 70% | center |
| 5 | Gap | `gap` | depende da métrica; sinal +/-; ↑/↓ verde/vermelho | center |

7 linhas (Investimento → Faturamento).

###### 4 cards de taxa

Grid 4 colunas (mobile: 2x2 ou 1 coluna conforme breakpoint).

```tsx
<TaxaCard
  nome="CMQL"
  realValor={fmtCurrency(cardsTaxa[0].realValor)}
  metaValor={fmtCurrency(cardsTaxa[0].metaValor)}
  status={cardsTaxa[0].isInverse
    ? (real <= meta ? 'good' : 'bad')        // CMQL: menor é melhor
    : (real >= meta ? 'good' : 'bad')        // taxas: maior é melhor
  }
/>
```

Visual de cada card:
- Label uppercase em cima
- Real grande (24px, bold)
- "Meta: {valor}" pequeno abaixo
- Badge "abaixo da meta" verde ou "acima da meta" vermelho (pra CMQL inverso)

###### Gráfico — Pacing (Recharts ComposedChart)

```tsx
<ComposedChart data={pacingChart}>
  <CartesianGrid strokeDasharray="3 3" stroke="#EFF3F5" />
  <XAxis dataKey="date" tickFormatter={fmtDay} stroke="#688594" />
  <YAxis tickFormatter={fmtCurrency} stroke="#688594" />
  <Tooltip />
  <Line type="monotone" dataKey="realAcumulado" name="Realizado" stroke="#FFBE18" strokeWidth={2} dot={false} />
  <Line type="monotone" dataKey="metaAcumulada" name="Meta (rampa)" stroke="#0C161B" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
  {/* Linha horizontal de referência: meta total do mês */}
  <ReferenceLine y={metaTotal} stroke="#435965" strokeDasharray="2 2" label="Meta mensal" />
</ComposedChart>
```

###### Identidade visual

- Hero card: bg branco, border `#EFF3F5`, padding 24px, radius 12px, valor SF Pro 870 36px
- Progress bar: bg `#EFF3F5`, fill `#FFBE18` (ou `#16A34A` se 100%, `#DC2626` se < 50%)
- Tabela funil: header uppercase, linhas zebradas, % colorida por faixa
- Cards de taxa: bg branco, valor `#0C161B`, badge `bg-success-soft` verde ou `bg-danger-soft` vermelho
- Pacing chart: amarelo Metta pra real, azul-noite tracejado pra meta

###### Acceptance

1. Sem aba Metas (cache.metas vazio): página mostra placeholder "Configure a aba Metas na planilha. Estrutura: Mês | Funil | Métrica | Valor."
2. Filtro 01-14 de Maio, meta de Faturamento Maio = R$ 30.000 → metaMtdValor = R$ 30.000 × (14/31) = R$ 13.548.
3. Hero pctAtingimento > 100% → progress bar fica verde + badge "acima da meta".
4. CMQL: real < meta → "abaixo da meta" verde (menor é melhor — `isInverse`).
5. Filtro Produto = Mentoria pré-selecionado por default (não Todos).
6. Pacing chart: real acumulado deve ser monotônico crescente; meta acumulada é rampa linear.
7. Mudar funil filtrado muda metas exibidas (se houver metas por funil) ou usa proporção do "Todos".

### 5.3 Tratamento unificado de edge cases nos cálculos

#### 5.3.1 Divisão por zero

Toda taxa/razão (`CPL`, `CMQL`, `Show`, `Conversão`, `ROAS`, `Ticket médio`) é uma divisão. Se o denominador é 0, NÃO retornar `NaN` nem `Infinity`.

```typescript
export function safeDiv(num: number, den: number, fallback: number | null = null): number | null {
  if (den === 0 || !Number.isFinite(den)) return fallback;
  const result = num / den;
  return Number.isFinite(result) ? result : fallback;
}

export function safeRatio(num: number, den: number): number {
  return safeDiv(num, den, 0) ?? 0;
}
```

**UI:** quando taxa é `null`, mostrar `"—"` (em-dash). NÃO mostrar `"0%"` (confundiria com taxa real de 0).

#### 5.3.2 Dados ausentes

| Cenário | Tratamento |
|---|---|
| Lead sem `dataInscricao` (coluna P vazia) | Excluído do filtro de data. Não conta em nenhum KPI temporal. |
| Lead sem `qualificacao` | Conta como "Outros" no card §5.2.7 Qualificação. Não conta como MQL. |
| Lead sem `funil` | Excluído de qualquer filtro de funil (inclusive "Todos"). |
| SDR sem `dataReuniao` mas com `dataAgendamento` | Conta em "Agendamentos" mas não em "Reuniões agendadas". |
| SDR com `status` vazio | Não conta como "Realizada". Aparece em "Agendamentos" e "Reuniões agendadas" se as datas estão preenchidas. |
| Venda sem `dataCompra` mas com `dataAceite` | Conta em "Aceites" mas não em "Vendas". Valor não soma em Faturamento. |
| Venda sem `valorContrato` | Conta como venda (qtd) mas valor = 0 no Faturamento. Log warning. |
| Lead com `email` vazio | Conta como lead anônimo em KPIs de quantidade. Não joina com SDR/vendas. |

#### 5.3.3 Mudança de qualificação histórica

Um lead pode mudar de qualificação no tempo (ex: era MQL 2, virou MQL 1 quando atualizou o faturamento). A planilha **sobrescreve** o valor, sem histórico.

**Implicação:**
- Métricas atuais usam qualificação ATUAL.
- Não há "snapshot histórico" — Lead que entrou em jan/2026 como MQL 2 e virou MQL 1 em mai/2026 conta como MQL 1 mesmo nos números de janeiro.
- Aceitar limitação no v1. v2 pode ter aba de histórico se necessário.

#### 5.3.4 Vendas sem UTM (legacy)

Vendas mais antigas não têm `utm_*` preenchido. Tratamento:

- KPIs gerais (Vendas, Faturamento) **contam normalmente**.
- Cards de §5.2.6 Origem agrupados por `utm_source`/`utm_medium`/`utm_campaign` mostram bucket **"Sem origem"** ou **"Direto"** pra essas vendas.
- Não jogam fora — perda de visibilidade pior que confusão.

#### 5.3.5 Vendas com `funilCompra = "Up-sell"`

`vendas.K` pode ter "Up-sell" — produto de alto valor pra aluno existente. Não bate com nenhum dos 5 funis primários (Sala/Aplica/Sessão/Isca/Reality).

**Decisão:**
- Filtro "Todos" inclui Up-sell.
- Filtros individuais (Sala, Sessão, etc.) **NÃO** incluem Up-sell.
- Aba Origem mostra Up-sell como categoria separada se relevante.
- Soma Faturamento por funil + Up-sell = total.

#### 5.3.6 Agregações com filtro multi-select

Quando o usuário seleciona múltiplos funis (ex: Sessão + Sala):

```typescript
function filterByAnyFunil<T>(rows: T[], funis: Funil[], matcher: (r: T, f: Funil) => boolean): T[] {
  return rows.filter((r) => funis.some((f) => matcher(r, f)));
}
```

- **Dedupe:** linha que match em múltiplos funis (caso §5.1.11) conta **uma vez**.
- KPIs somam corretamente. Funil visual (gráfico) mostra agregação total (não quebrado por funil — drill seria página separada).

#### 5.3.7 Comparação MoM (delta vs mês anterior)

Card "Leads" mostra "+12% vs mês anterior". Cálculo:

```typescript
function calcMoMDelta(current: number, previous: number): { value: number; direction: 'up' | 'down' } | null {
  if (previous === 0) return null; // sem base de comparação
  const delta = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(delta * 10) / 10),
    direction: delta >= 0 ? 'up' : 'down',
  };
}
```

**Período anterior:** mesmo número de dias do filtro atual, imediatamente antes.
- Filtro: 01/05 - 31/05 (31 dias) → comparação: 01/04 - 30/04 (30 dias do mês anterior).
- Filtro: 01/05 - 14/05 (14 dias) → comparação: 17/04 - 30/04 (14 dias).

**Quando ocultar o delta:**
- Período anterior tem 0 dados (cache vazio ou planilha não tinha dados ainda).
- Período atual = 0 e anterior = 0 (delta indefinido).
- Filtro maior que 365 dias (delta YoY teria que ser implementado separado).

#### 5.3.8 Ciclo de venda

`vendas.dataCompra - lead.dataInscricao` em dias. Mas:

- Lead pode não estar na aba leads (caso §5.1.9).
- Snapshot em `vendas.dataCadastroSnap` (coluna P-AC) pode ser usado como fallback.

```typescript
function calcCicloVenda(venda: VendaRow, lead: LeadRow | null): number | null {
  if (!venda.dataCompra) return null;
  const inscricao = lead?.dataInscricao ?? venda.dataCadastroSnap;
  if (!inscricao) return null;
  const diffMs = venda.dataCompra.getTime() - inscricao.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null; // ciclo negativo é dado inconsistente
}
```

Ciclo médio = média aritmética dos `cicloVenda` não-null no período. Se zero vendas no período, mostra "—".

#### 5.3.9 Meta proporcional (month-to-date)

```typescript
function calcMetaMtd(metaMensal: number, from: Date, to: Date): number {
  const diasNoFiltro = Math.ceil(
    (startOfDayBrt(to).getTime() - startOfDayBrt(from).getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;
  // dias do mês: usa o mês de `from` como base
  const ano = from.getFullYear();
  const mes = from.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  return metaMensal * (diasNoFiltro / diasNoMes);
}
```

**Edge cases:**
- Filtro cruza dois meses (ex: 25/04 a 05/05): aplicar pro-rata por mês e somar. Implementar quando precisar (v1: assume filtro dentro de 1 mês).
- Filtro = 0 dias: meta = 0.
- Filtro > mês: meta = total mensal (não passa de 100%).

#### 5.3.10 Determinismo

Toda função de cálculo é **pura e determinística**: mesma entrada → mesma saída. Sem `Math.random`, sem `Date.now()` interno (data atual vem como argumento). Permite testes unitários estáveis e cache de resultados se necessário.

### 5.4 Protocolo de validação cálculo-a-cálculo (sanity check)

Antes de promover qualquer página pra produção, executar checklist de validação cruzando dashboard vs planilha.

#### 5.4.1 Matriz de validação

3 períodos × 3 funis × KPIs por página = N comparações exatas:

| Período | Funil |
|---|---|
| Últimos 7 dias | Sessão |
| Mês corrente (até ontem) | Aplicação |
| Mês anterior fechado | Todos |

Pra cada combinação, abrir a planilha (Análise Geral / Análise Tráfego) com o mesmo filtro e comparar cada KPI.

**Margem aceita: 0** (exato). Diferenças apontam para:
- Bug de cálculo no dashboard
- Edge case não tratado (data de borda, lead duplicado, etc.)
- Divergência entre Análise Geral vs Análise Tráfego da planilha (raro, mas possível — documentar qual é a "verdade").

#### 5.4.2 Página `/debug/compare` (oculta em prod)

Visualização lado a lado com diff colorido:

```
                      Dashboard    Análise Geral    Diff
Investimento          R$ 45.230    R$ 45.230        ✓
Leads                 2.300        2.300            ✓
MQL                   482          485              ⚠ -3
CPL                   R$ 19,67     R$ 19,67         ✓
...
```

Discrepâncias > 0 são highlight vermelho. Acessar antes de cada deploy pra prod.

#### 5.4.3 Diferenças "esperadas" entre Análise Geral e Análise Tráfego

Pela arquitetura da planilha, podem haver micro-diferenças entre as abas Análise Geral e Análise Tráfego mesmo na planilha original (uso de abas-fonte distintas — `fb_todos` vs `fb`). Decisão:

- **Verdade do dashboard:** sempre alinhar com **Análise Geral** (`fb_todos`), pois a Visão Geral é a página-âncora do dashboard.
- Onde houver discrepância com Análise Tráfego (que usa `fb`), aceitar e documentar.

#### 5.4.4 Mapeamento PRD → fórmula original da planilha (referência rápida)

| KPI do dashboard | Fórmula PRD (TS) | Fórmula planilha (Análise Geral) |
|---|---|---|
| Investimento | `sum(fb_todos.amountSpent ...)` | `SUMIFS(fb_todos!R; fb_todos!B; ">="&B3; ...; fb_todos!C; "*PERP*"; ...)` |
| Leads | `count(leads ... by leads.P)` | `COUNTIFS(leads!P; B7; leads!I; "*Sessão*"; ...)` |
| MQL | `count(leads where qualif MQL\|Inter)` | `COUNTIFS(leads!P; B7; leads!I; "*Sessão*"; leads!H; "*MQL*") + ... (Inter)` |
| MQL 1 | `count(... qualif "1"\|"Inter")` | `COUNTIFS(... leads!H; "*1*") + ... ("*Inter*")` |
| MQL 2 | `count(... qualif "2")` | `COUNTIFS(... leads!H; "*2*")` |
| Agendamentos | `count(sdr by dataAgendamento)` | `COUNTIFS(sdr!A; B7; sdr!J; "*Sessão*")` |
| Reuniões agendadas | `count(sdr by dataReuniao)` | `COUNTIFS(sdr!B; B7; sdr!J; "*Sessão*")` |
| Reuniões realizadas | `count(... status="Realizada")` | `COUNTIFS(... sdr!K; "*Realizada*")` |
| Propostas | `count(... envioProposta IN {Sim, Fechada, Recusada})` | `SUM(COUNTIFS(... sdr!L; {"*Sim*"\"*Fechada*"\"*Recusada*"}))` |
| Valor propostas | `sum(sdr.valorProposta where ...)` | `SUMIFS(sdr!M; ...)` |
| Aceites | `count(vendas by dataAceite)` | `COUNTIFS(vendas!F; B7; vendas!K; "*Sessão*")` |
| Vendas | `count(vendas by dataCompra)` | `COUNTIFS(vendas!O; B7; vendas!K; "*Sessão*")` |
| Faturamento | `sum(vendas.valorContrato by dataCompra)` | `SUMIFS(vendas!D; vendas!O; B7; vendas!K; "*Sessão*")` |

**Substring matches importantes:**
- Sessão na planilha = `"*Sessão*"` OR `"*Diagn*"` (Sessão + Diagnóstico unificados)
- MQL = `"*MQL*"` OR `"*Inter*"` (Interprise)
- Funil em fb_todos = substring `"*PERP*"` AND `"*CAPT*"` AND `"*<FUNIL>*"` no Campaign Name
- Status realizado = `"*Realizada*"` (substring; pega "Realizada", "Não Realizada" exclui — verificar planilha real)

### 5.5 Sumário da auditoria pós-revisão (2026-05-13)

Auditoria cruzada entre PRD, wireframe HTML e fórmulas da planilha. Achados e correções aplicadas:

| # | Achado | Status |
|---|---|---|
| 1 | P1 Tabela diária sem fórmulas explícitas de "MQL → Agend." e "MQL → Reun. ag." | Corrigido em §5.2.1 |
| 2 | P2 Tráfego: PRD não esclarecia uso de `fb_todos` vs aba `fb` (usada pela Análise Tráfego) | Corrigido em §5.2.2 — adoção de `fb_todos` confirmada |
| 3 | P2 Funil de tráfego sem fórmulas das 5 etapas | Corrigido em §5.2.2 |
| 4 | P5 Anúncios sem mecanismo de join `utm_content` × `ad_name` × vendas | Corrigido em §5.2.5 |
| 5 | P6 Metas: divergência entre wireframe (estrutura antiga) e PRD (estrutura nova) | Aviso adicionado em §5.2.7 — PRD é a verdade; wireframe será atualizado depois |
| 6 | P3 SDR e P4 Closer com opções de filtros não centralizadas | Tabelas de filtros adicionadas em §5.2.3 e §5.2.4 |
| 7 | P4 Closer: fórmulas detalhadas (join Closer × Vendas, Ciclo médio) | Detalhadas em §5.2.4 |
| 8 | Mapeamento PRD → fórmula original da planilha ausente | Adicionado em §5.4.4 |
| 9 | Sem protocolo formal de validação cálculo-a-cálculo | Adicionado em §5.4 |

---

## 6. Componentes compartilhados

### 6.1 Inventário de componentes React

| Componente | Localização | Reuso | Props |
|---|---|---|---|
| `<Sidebar />` | `components/dashboard/sidebar.tsx` | Layout global | itens, onToggle, collapsed |
| `<Topbar />` | `components/dashboard/topbar.tsx` | Layout global | currentPage |
| `<DateRangePopover />` | `components/dashboard/date-range-popover.tsx` | Todas páginas | value, onChange, presets |
| `<FunnelChips />` | `components/dashboard/funnel-chips.tsx` | 6 de 7 páginas | selected, onChange |
| `<KpiCard />` | `components/dashboard/kpi-card.tsx` | Todas (~50 instâncias) | label, value, sub, delta |
| `<FunnelVertical />` | `components/dashboard/funnel-vertical.tsx` | Visão Geral, Tráfego, SDR | steps |
| `<MetricTable />` | `components/dashboard/metric-table.tsx` | 6 páginas | columns, data, sortable, searchable |
| `<Heatmap />` | `components/dashboard/heatmap.tsx` | SDR | data, xAxis (dias), yAxis (horas), scale |
| `<ComboBarLine />` | `components/dashboard/combo-bar-line.tsx` | Visão Geral, Tráfego | bars, line, xAxis |
| `<DualBars />` | `components/dashboard/dual-bars.tsx` | Tráfego | groups, series |
| `<DonutChart />` | `components/dashboard/donut-chart.tsx` | Closer | data |
| `<TopList />` | `components/dashboard/top-list.tsx` | Anúncios | items, metric |
| `<CreativeGallery />` | `components/dashboard/creative-gallery.tsx` | Anúncios | items |
| `<ProgressBar />` | `components/dashboard/progress-bar.tsx` | Metas | value, max, label |
| `<PacingChart />` | `components/dashboard/pacing-chart.tsx` | Metas | real, target, projection |
| `<StaleBanner />` | `components/dashboard/stale-banner.tsx` | Layout global | lastUpdated |
| `<LoadingSkeleton />` | `components/dashboard/loading-skeleton.tsx` | Suspense fallbacks | kind |
| `<EmptyState />` | `components/dashboard/empty-state.tsx` | Quando não há dados | message |
| `<ErrorBoundary />` | `components/dashboard/error-boundary.tsx` | Por página | fallback |

### 6.2 Especificações detalhadas dos principais

#### 6.2.1 `<KpiCard />`

Props:
```typescript
type KpiCardProps = {
  label: string;
  value: string | number; // já formatado se string
  format?: 'currency' | 'number' | 'percent';
  sub?: string;
  delta?: { value: number; direction: 'up' | 'down' };
};
```

Visual: card branco com label uppercase pequeno em cinza, valor grande, sub-info pequena embaixo. Quando `delta` vier, mostra seta verde (up) ou vermelha (down).

#### 6.2.2 `<FunnelVertical />`

Props:
```typescript
type FunnelStep = {
  label: string;
  value: string | number;
  pct?: string; // "20,9%" ou "100%"
  meta?: string; // "show 65%"
};
type FunnelVerticalProps = {
  steps: FunnelStep[];
  variant?: 'blue' | 'dark'; // visão geral usa blue; SDR usa dark
};
```

Visual: lista vertical de retângulos com largura decrescente. Gradiente de cor por etapa.

#### 6.2.3 `<MetricTable />`

Props:
```typescript
type Column<T> = {
  id: keyof T;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
};
type MetricTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  total?: Partial<T>; // linha de total opcional
  toolbar?: ReactNode; // toggle/filter/search
  minHeight?: number; // pra card.tall
};
```

Usar TanStack Table por baixo. Headers à esquerda, números centralizados (regra de UX já definida).

#### 6.2.4 `<DateRangePopover />`

Props:
```typescript
type DateRangePopoverProps = {
  value: { from: Date; to: Date };
  onChange: (v: { from: Date; to: Date }) => void;
  presets?: ('7d' | '14d' | '30d' | '90d' | 'thisMonth' | 'lastMonth')[];
};
```

Visual: trigger button (border + ícone calendar + texto "01/05/2026 — 31/05/2026" + pill "31 dias" + chevron). Click abre popover ancorado com 2 meses lado a lado + presets em PT-BR + footer com "De ... até ..." e botão "Aplicar".

#### 6.2.5 `<FunnelChips />`

Props:
```typescript
type FunnelChipsProps = {
  options: { id: Funil; label: string }[];
  selected: Funil[];
  onChange: (v: Funil[]) => void;
};
```

Visual: chips em row. "Todos" é o primeiro (dark, atalho que seleciona todos os outros). Click em um chip toggle individual. Click em "Todos" alterna entre todos selecionados / nenhum.

### 6.3 Estados por componente (loading / empty / error)

Todo componente que renderiza dados precisa cobrir 4 estados. Padrão:

| Estado | Quando | UI |
|---|---|---|
| **Loading** | Cache miss / refetch em background | Skeleton com formato do componente real (KPI card vira retângulo, tabela vira ~5 rows fantasmas, gráfico vira retângulo cinza com pulse) |
| **Empty** | Dados carregaram mas filtro retornou 0 linhas | Mensagem clara + ícone leve: "Nenhum registro no período selecionado." + CTA opcional ("Tente outro filtro") |
| **Error** | Falha de fetch / parse / cálculo | Ícone de alerta + mensagem: "Erro ao carregar dados." + botão "Tentar novamente" (chama `revalidateTag` manualmente). Mostra cache anterior se disponível com banner "Dados desatualizados" |
| **Stale** | Cache > 1h sem refresh | Componente renderiza normal + banner amarelo no topo da página: "Atualizado há Xh — pode estar desatualizado" |

**Implementação:**

```typescript
// components/dashboard/kpi-card.tsx
type KpiCardProps = {
  label: string;
  value: string | number | null;
  state?: 'loading' | 'empty' | 'error' | 'ready';
  // ...
};

// Skeleton padrão
function KpiCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-24 bg-gray-200 rounded" />
    </div>
  );
}
```

**Suspense boundaries:**

```tsx
// app/(dashboard)/page.tsx
<Suspense fallback={<KpiCardSkeleton />}>
  <KpiInvestido filters={filters} />
</Suspense>
<Suspense fallback={<TableSkeleton rows={10} />}>
  <TabelaDiaria filters={filters} />
</Suspense>
```

Cada bloco da página é um Suspense independente — partes carregam separadamente em vez do "tudo ou nada".

### 6.4 Acessibilidade dos componentes

- **`<KpiCard>`:** `<article aria-label="Investimento: R$ 45.230">` pra leitores de tela.
- **`<MetricTable>`:** `<table>` semântico, `<thead>`, `<tbody>`, `<th scope="col">`. Caption opcional.
- **`<FunnelChips>`:** group de checkboxes navegáveis por teclado (Tab + Space). Cada chip é `<button role="checkbox" aria-checked="true">`.
- **`<DateRangePopover>`:** `<button aria-haspopup="dialog" aria-expanded="false">`. Popover é `<dialog>` ou `role="dialog"` com `aria-modal="false"`. Esc fecha. Tab cicla foco interno.
- **`<Sidebar>`:** `<nav aria-label="Páginas">`. Item ativo: `aria-current="page"`. Toggle: `<button aria-label="Mostrar/ocultar menu" aria-expanded>`.
- **`<Funnel>`:** lista semântica (`<ol>`), cada step com `aria-label="Etapa X: <nome>, <valor>"`.
- **`<Heatmap>`:** `<table>` com `<th>` em ambas dimensões + `<caption>` descritiva. Cada célula com `title` mostra valor numérico.
- **Foco visível:** `:focus-visible` com ring amarelo (`#FFBE18`) em todos os interativos.
- **Atalhos de teclado:** Cmd+B (toggle sidebar), Esc (fecha popovers), `/` (foco no buscar dentro de tabela).

---

## 7. Filtros e navegação

### 7.1 Sincronização com URL

```typescript
// lib/filters.ts
type DashboardFilters = {
  from?: string; // "2026-05-01"
  to?: string;
  funis?: string; // "sala,sessao"
  // específicos
  sdr?: string;
  status?: string;
  produto?: string;
  pagamento?: string;
  temperatura?: string;
};

export function parseFilters(searchParams: URLSearchParams): DashboardFilters { ... }
export function serializeFilters(f: DashboardFilters): URLSearchParams { ... }
```

Filtros mudam via `router.replace(`/page?${serialize(newFilters)}`, { scroll: false })` em Client Component.

Server Component lê `searchParams` da prop, passa pra função de cálculo.

### 7.2 Estado do sidebar (colapsado/expandido)

Persistido em `localStorage`. Toggle por botão na topbar + atalho Cmd+B (Ctrl+B no Windows).

### 7.3 Página default

Rota `/` redireciona pra `/dashboard` que mostra Visão Geral.

### 7.4 Mapa de rotas

| Rota | Página |
|---|---|
| `/` → `/dashboard` | redirect |
| `/dashboard` | Visão Geral |
| `/dashboard/metas` | Metas vs Realizado |
| `/dashboard/trafego` | Tráfego Pago |
| `/dashboard/anuncios` | Anúncios |
| `/dashboard/sdr` | Comercial SDR |
| `/dashboard/closer` | Comercial Closer |
| `/dashboard/origem` | Origem |
| `/login` | Login Google |
| `/api/cron/refresh-sheets` | Cron handler |
| `/api/revalidate` | POST manual com secret |
| `/debug/compare` | Página oculta de sanity check |

---

## 8. Auth e permissões

### 8.1 Provider — Supabase Auth

Supabase gerencia autenticação. Sem restrição de domínio (decisão do usuário).

**Métodos habilitados no v1:**
- Google OAuth
- Magic Link (login por email — Supabase envia o link)
- Email + Senha
- SSO (placeholder na UI, mas só configurado se houver demanda futura — não bloqueia v1)

### 8.2 Setup no Supabase

1. Criar projeto Supabase: `dashboard-metta-paliativo`
2. **Authentication > Providers > Google:**
   - Habilitar
   - Criar OAuth Client no Google Cloud Console (Web Application)
   - Authorized redirect URI = `https://<seu-projeto>.supabase.co/auth/v1/callback`
   - Colar Client ID + Client Secret no painel Supabase
   - Salvar
3. **Authentication > URL Configuration:**
   - Site URL: `https://dashboard.mettabrasil.com.br` (ou domínio Vercel)
   - Redirect URLs (adicionar localhost e preview Vercel): `http://localhost:3000/auth/callback`, `https://*.vercel.app/auth/callback`
4. **Authentication > Email Templates:**
   - Personalizar template de Magic Link com identidade Metta (logo, paleta, copy em PT-BR)
5. **Authentication > Settings:**
   - Email confirmation: opcional (recomendo OFF pra magic link funcionar direto)

### 8.3 Setup no código

```typescript
// lib/supabase/client.ts (Client Component)
import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// lib/supabase/server.ts (Server Component / Route Handler)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### 8.4 Middleware (proteção de rotas)

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return res;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

### 8.5 Página de login — `/login`

Visual baseado no template `Login06` (estrutura completa: Magic Link + Password + SSO) **adaptado para a identidade Metta** (ver §15).

**Estrutura da tela:**
- Centralizada (`min-h-dvh flex items-center justify-center`)
- Card branco `rounded-4xl` com sombra sutil, max-width `sm` (~24rem), padding generoso (px-6, py-10, pt-14)
- Sequência vertical de elementos com `space-y-8`:
  1. **Logo Metta** (símbolo isolado ou logo completo — ver §15) com altura ~48px
  2. **Headline:** "Bem-vindo de volta!" (SF Pro, weight 650, ~24px, balance)
  3. **Subhead:** "Primeira vez aqui? Fale com o admin." (SF Pro 400, 14px, muted)
  4. **Form area** (w-full, space-y-4):
     - Input email (rounded-xl, placeholder "Seu email")
     - Botão primário (rounded-xl, size lg): **"Receber link mágico"** → dispara `supabase.auth.signInWithOtp({ email })`
     - Botão link variant: **"Entrar com senha"** → expande/troca pra modo senha
     - Separador horizontal "OU"
     - Botão outline (rounded-xl, size lg): **"Entrar com Google"** → dispara `supabase.auth.signInWithOAuth({ provider: 'google' })`
     - (Opcional v1 oculto, v2 visível) Botão outline: **"Single Sign-On (SSO)"**
  5. **Footer legal:** "Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade." (xs, muted, w-11/12)

**Diferenças do template original (Login06):**

| Original | Adaptação Metta |
|---|---|
| `<Logo />` SVG genérico (símbolo de relógio) | Símbolo Metta amarelo (#FFBE18) ou logo completo (ver §15.5) |
| `text-foreground` (tema) | Cor azul noite (#0C161B) — text Metta |
| `Welcome back!` em inglês | "Bem-vindo de volta!" |
| `Sign up for free` | "Fale com o admin." (não é cadastro aberto) |
| `Send me the magic link` | "Receber link mágico" |
| `Sign in using password` | "Entrar com senha" |
| `Single sign-on (SSO)` | Mesmo texto, mas **oculto no v1** (deixar comentado pra v2) |
| Botão SSO outline | Mesma estrutura, mas é "Entrar com Google" no v1 |
| Sem botão Google explícito | Botão Google ganha destaque (é o método principal pra time interno) |
| Fonte system-ui padrão | **SF Pro** (família Metta) |
| `rounded-xl` nos inputs/botões | Mantido (12-16px = compatível com Metta) |
| `rounded-4xl` no card | Mantido (combina com cantos generosos da marca) |
| `shadow-2xs` | Pode subir pra `shadow-md` se quiser mais profundidade |

**Comportamento:**
- Click em "Receber link mágico" → loading state no botão → toast de sucesso ("Verifique seu email") → mantém usuário na tela
- Click em "Entrar com Google" → redirect pro fluxo OAuth Google → callback em `/auth/callback` → redirect pra `/dashboard`
- Click em "Entrar com senha" → expande form com inputs de senha + botão "Entrar"
- Erro de autenticação → toast vermelho com mensagem clara
- Já autenticado → redirect automático pra `/dashboard`

### 8.6 Página `/auth/callback`

Route Handler que processa o retorno do OAuth:

```typescript
// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
```

### 8.7 Logout

Botão no menu do usuário (dentro do card de footer da sidebar) chama `supabase.auth.signOut()` e redireciona pra `/login`.

```tsx
// components/dashboard/user-menu.tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh(); // limpa cache de Server Components
  }
  return <button onClick={handleLogout}>Sair</button>;
}
```

### 8.8 Sessão e refresh token

**Comportamento padrão Supabase:**
- Access token JWT vence em **1 hora**.
- Refresh token armazenado em cookie HttpOnly seguro.
- Cliente `@supabase/ssr` refresha automaticamente o access token quando expira.
- Middleware verifica `getUser()` em cada request — se refresh falha, retorna `null`.

**Quando o usuário "perde" a sessão:**
- Refresh token expira (default Supabase: **30 dias** sem uso).
- Logout em outra aba (broadcast via storage event).
- Conta deletada/banida no painel Supabase.

**O que acontece:**
- Middleware detecta ausência de user → redirect `/login?reason=expired`.
- Página `/login` lê query `reason=expired` → mostra toast: "Sua sessão expirou. Faça login de novo."

### 8.9 Multi-device session

Supabase permite múltiplas sessões simultâneas (mesmo usuário em desktop + celular). Cada device tem seu próprio access/refresh token.

**Logout em um device não afeta os outros.** Pra forçar logout global: painel Supabase → Users → Revoke all sessions.

V1: não implementar "Sair de todos os dispositivos". Adicionar se demanda.

### 8.10 Magic Link — fluxo completo

1. Usuário digita email → click "Receber link mágico"
2. Client chama `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '<URL>/auth/callback' } })`
3. Supabase envia email com link (válido por **1 hora** por padrão; configurável no painel)
4. Usuário clica no link → browser abre URL com `?token=...&type=magiclink`
5. Página `/auth/callback` faz `exchangeCodeForSession` → cria sessão
6. Redirect pra `/dashboard`

**Edge cases:**
- Link expirado (>1h): Supabase retorna erro `otp_expired`. Tela `/auth/callback?error=expired` mostra: "Link expirado. Peça outro." + botão "Voltar pro login".
- Link já usado: erro `otp_consumed`. Mesma tela.
- Email não chegou (filtro de spam): orientação visual no toast pós-envio: "Não recebeu? Confira spam ou tente Google."

### 8.11 Rate limiting de login

Supabase tem rate limit nativo:
- 30 magic link sends por hora por IP
- 5 password attempts por hora por email

Sem configuração necessária no v1. Se virar problema (improvável com 5-10 usuários), customizar via Supabase Edge Functions.

### 8.12 User metadata (dados do Google)

Ao fazer login com Google, Supabase armazena em `user.user_metadata`:

```typescript
{
  iss: 'https://accounts.google.com',
  sub: '...',
  name: 'Alisson Oliveira',
  email: 'alisson.oliveira@mettabrasil.com.br',
  picture: 'https://lh3.googleusercontent.com/...',
  email_verified: true,
  // ...
}
```

**Onde usar no dashboard:**
- Sidebar footer: avatar (foto) + nome + email.
- Topbar avatar.
- Logs: associar ações ao user.id (NÃO email — preserva privacidade nos logs).

**Componente helper:**

```tsx
// components/dashboard/user-info.tsx (Server Component)
import { createClient } from '@/lib/supabase/server';

export async function UserInfo() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const name = user.user_metadata.name ?? user.email;
  const picture = user.user_metadata.picture;
  const initials = name.split(' ').slice(0, 2).map((s: string) => s[0]).join('').toUpperCase();
  return (
    <div className="sb-user">
      {picture
        ? <img src={picture} alt={name} className="avatar" />
        : <div className="avatar">{initials}</div>}
      <div className="user-info">
        <b>{name}</b>
        <small>{user.email}</small>
      </div>
    </div>
  );
}
```

### 8.13 Política de acesso atual

**V1:** qualquer email autenticado via Google pode acessar. Sem restrição de domínio.

**Como restringir no futuro (snippet documentado):**

```typescript
// app/auth/callback/route.ts (após exchangeCodeForSession)
const ALLOWED_DOMAINS = ['mettabrasil.com.br'];
const ALLOWED_EMAILS = ['parceiro@externo.com']; // exceções

if (user && !isAllowed(user.email, ALLOWED_DOMAINS, ALLOWED_EMAILS)) {
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login?error=not_allowed', origin));
}
```

Quando o time crescer ou Alisson quiser controlar acesso, **mudar essa única função** no callback.

### 8.14 Auth: práticas de segurança consolidadas (Supabase)

Conforme guia oficial Supabase Agent Skills:

#### 8.14.1 `getUser()` vs `getSession()` (importante)

| Método | Onde usar | Por quê |
|---|---|---|
| `supabase.auth.getUser()` | **Server-side (middleware, Server Components, Route Handlers)** | Valida JWT contra Supabase. **Seguro.** |
| `supabase.auth.getSession()` | **Apenas client-side** | Lê de localStorage — não valida assinatura. **Inseguro pra server.** |

O middleware (§8.4) usa `getUser()` corretamente. Em qualquer Server Component que precise do user, sempre `getUser()`. **Nunca `getSession()` no server.**

#### 8.14.2 `user_metadata` é EDITÁVEL pelo usuário — NÃO usar pra autorização

O campo `user.user_metadata` (também aparece como `raw_user_meta_data` no banco) é **editável pelo próprio usuário** via API. Não usar pra decisões de autorização (RLS, restrição de acesso, etc.).

✅ **Pode usar pra exibição:** `user_metadata.name`, `user_metadata.picture` (vindos do Google OAuth) — só pra UI.

❌ **NÃO usar pra autorização:** `user_metadata.role`, `user_metadata.is_admin`, etc.

**Se precisar de roles/permissions futuramente:** usar `app_metadata` (somente editável por service role, seguro).

#### 8.14.3 Chaves Supabase — escopo

| Chave | Prefixo | Onde | Risco |
|---|---|---|---|
| `anon` (anônimo) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente + servidor | OK ser pública (assumida cliente) |
| `service_role` | `SUPABASE_SERVICE_ROLE_KEY` (sem `NEXT_PUBLIC_`) | **APENAS server-side** | **Crítica.** Bypassa RLS. Nunca em código client-side, nunca em env public |

**Regra de ouro:** se a variável tem `NEXT_PUBLIC_` no nome, o Next.js a serializa pro bundle do cliente. **Nunca** colocar `service_role` com esse prefixo.

V1: usar apenas `anon` (auth). Service role só será relevante v2 (CRUD em tabelas Supabase).

#### 8.14.4 PKCE habilitado por default

`@supabase/ssr` usa OAuth 2.0 com **PKCE (Proof Key for Code Exchange)** habilitado por default. Protege contra interceptação de código. Nenhuma config adicional necessária.

#### 8.14.5 JWT freshness

JWT claims (incluindo `app_metadata`) **só atualizam quando o token é refrescado**. Mudanças no painel Supabase (ex: adicionar usuário a um role) **só refletem após:**
- Próximo refresh automático (a cada ~1h por default)
- Logout + login forçado
- `supabase.auth.refreshSession()` manual

Pra mudanças que precisam ser imediatas, forçar refresh ou logout.

#### 8.14.6 Deleção de usuário NÃO invalida tokens existentes

Deletar um user no painel Supabase não invalida access tokens emitidos antes da deleção. Eles continuam válidos até expirarem (1h).

**Mitigação se necessário:**
- Antes de deletar: `supabase.auth.admin.signOut(userId)` (revoga sessões) — requer service role
- Validar `session_id` contra `auth.sessions` em operações sensíveis (v2, se necessário)

V1: aceitar limitação (time pequeno, sem necessidade de revogação imediata).

#### 8.14.7 Wildcard redirect URLs

Supabase **aceita** padrão wildcard pra Vercel preview deploys:
```
https://*-alisson.vercel.app/auth/callback
```
Configurado em Authentication > URL Configuration > Redirect URLs.

**Restrição:** o wildcard só pode aparecer no início do subdomínio. `https://*.vercel.app/*` NÃO funciona (path wildcard não suportado).

#### 8.14.8 Verificar changelog antes de implementar

Supabase muda rápido. Antes da implementação da Fase 5 (Auth), checar:
- [https://supabase.com/changelog.md](https://supabase.com/changelog.md) (lightweight summary)
- Buscar breaking changes recentes em `@supabase/ssr` e auth

Não confiar cegamente em docs/training data — sempre cruzar com changelog atual.

---

## 9. Deploy, env vars e secrets

### 9.1 Setup Vercel

1. Conectar repo GitHub ao projeto Vercel
2. Framework preset: Next.js (auto-detectado)
3. Build command: `pnpm build` (ou `npm run build`)
4. Output: `.next` (auto)
5. Branches: `main` → produção; demais → preview

### 9.2 Environment variables

| Variável | Valor | Onde |
|---|---|---|
| `GOOGLE_SHEETS_ID` | `1m_oCjgeMPfEaplFNvK0oLRwYR9yoS3AkYzWkO3uWXvY` | Production, Preview |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | `service-account@projeto.iam.gserviceaccount.com` | Production, Preview |
| `GOOGLE_SHEETS_PRIVATE_KEY` | conteúdo completo do `.json` da SA, escapado | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projeto>.supabase.co` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key do projeto Supabase | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (server-side only, opcional v1) | Production |
| `CRON_SECRET` | random secret | Production |
| `REVALIDATE_SECRET` | random secret | Production |
| `SENTRY_DSN` | DSN pública do projeto Sentry | Production, Preview |
| `SENTRY_AUTH_TOKEN` | Auth token pra upload de source maps | Production (build-time) |
| `SENTRY_ORG` | slug da organização Sentry | Production, Preview |
| `SENTRY_PROJECT` | slug do projeto | Production, Preview |

### 9.3 Setup Google Cloud (Sheets API + OAuth pra Supabase)

1. Criar projeto "dashboard-metta-paliativo"
2. Habilitar **Google Sheets API**
3. **Service Account** (pra ler planilha):
   - IAM & Admin > Service Accounts > Create
   - Nome: `dashboard-sheets-reader`
   - Sem roles (não precisa de role IAM)
   - Criar chave JSON, baixar (vai virar `GOOGLE_SHEETS_PRIVATE_KEY` + `GOOGLE_SHEETS_CLIENT_EMAIL`)
4. Compartilhar a planilha com o email da SA (`xxx@projeto.iam.gserviceaccount.com`) como **leitor**
5. **OAuth 2.0 Client ID** (pra Supabase autenticar via Google):
   - APIs & Services > OAuth consent screen: configurar (External, nome "Metta Dashboard")
   - Credentials > Create OAuth Client ID > Web application
   - Authorized JavaScript origins: `https://<projeto>.supabase.co`
   - Authorized redirect URI: `https://<projeto>.supabase.co/auth/v1/callback`
   - Copiar Client ID + Client Secret → colar no painel do Supabase (Auth > Providers > Google)

### 9.4 Setup Supabase

1. Criar projeto no [supabase.com](https://supabase.com): `dashboard-metta-paliativo`, região São Paulo
2. **Authentication > Providers > Google:** habilitar, colar credenciais do passo 9.3.5
3. **Authentication > URL Configuration:**
   - Site URL: `https://dashboard.mettabrasil.com.br` (ou domínio Vercel temporário)
   - Redirect URLs adicionais: `http://localhost:3000/auth/callback`, `https://*-alisson.vercel.app/auth/callback`
4. **Authentication > Email Templates:**
   - Customizar template "Magic Link" com brand Metta (logo + paleta amarelo/azul noite + copy PT-BR — ver §15)
5. **Settings > API:** copiar URL e anon key → env vars do Vercel

### 9.5 vercel.json

```json
{
  "crons": [
    { "path": "/api/cron/refresh-sheets", "schedule": "*/10 * * * *" }
  ],
  "functions": {
    "app/api/cron/refresh-sheets/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "app/api/revalidate/route.ts": {
      "maxDuration": 30
    }
  }
}
```

**Razões dos limites:**
- `maxDuration: 60` no cron: fetch de 4 abas via `batchGet` pode levar até 30s em casos extremos (cold start + planilha grande). Margem de 2x.
- `memory: 1024` no cron: parsing de fb_todos (~25MB) cabe folgado em 1GB. Default (2GB) seria desperdício.
- `maxDuration: 30` no revalidate: operação síncrona rápida, mas mantém margem.

### 9.6 Vercel Functions: runtime e diagnósticos

#### 9.6.1 Runtime: Node.js (não Edge)

Todas as Server Components e Route Handlers do dashboard rodam em **Node.js runtime** (default do Next.js). **Não usar `export const runtime = 'edge'`** em nenhuma rota que:
- Importe `googleapis` (não compatível com Edge)
- Importe `@supabase/ssr` (parcialmente compatível, mas testes inconsistentes em 2026)
- Tenha `'use cache'` (Cache Components não suportado em Edge)

Edge runtime fica reservado pro `middleware.ts` (que é Edge-by-default e compatível).

#### 9.6.2 Fluid Compute (default em 2026)

Vercel habilita Fluid Compute por padrão em todos os planos. Benefícios automáticos:
- **Concurrency**: múltiplas invocações por instância (até 85% de redução de custo)
- **Active CPU pricing**: cobra só quando CPU trabalha, não em idle/await da Sheets API
- **Extended duration**: 300s default (Hobby+), até 800s (Pro)
- **Bytecode caching**: reduz cold start

Implicação prática: o `await sheets.spreadsheets.values.batchGet(...)` que leva 5-10s é cobrado em "memory-only rate" (muito mais barato) — não consome Active CPU enquanto espera a resposta HTTP da Sheets.

#### 9.6.3 Cold start

**Esperado em cold start:**
- Boot de Node.js + Next.js: ~200-400ms
- Import de `googleapis`: ~200ms (lib pesada)
- JWT signing pra autenticar Sheets: ~50ms
- **Total cold: ~500-800ms** antes mesmo de chamar a Sheets

**Mitigação:**
- Cron a cada 10 min mantém função "warm" — usuários reais raramente pegam cold start.
- Bytecode caching do Fluid Compute reduz boot em ~30%.

#### 9.6.4 Diagnósticos comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `504 Gateway Timeout` no `/api/cron/refresh-sheets` | Sheets API lenta > 60s | Aumentar `maxDuration` no vercel.json. Investigar quota/connection |
| `FUNCTION_INVOCATION_FAILED` | Memory exceeded (parsing 51k linhas com objetos grandes) | `memory: 2048` na função. Otimizar parse (streaming) |
| Cold start > 2s | Imports pesados no top-level | Dynamic import: `const { google } = await import('googleapis')` dentro da função |
| `EDGE_FUNCTION_INVOCATION_TIMEOUT` | Alguma rota com `runtime = 'edge'` chamando Sheets | Remover `runtime = 'edge'` |
| `Missing env vars` em runtime | Env var no `.env.local` mas não no Vercel | `vercel env pull` local e verificar Vercel UI |

#### 9.6.5 Background tasks (futuro v2)

Pra v2 (cache mais inteligente), considerar `waitUntil`:

```typescript
import { waitUntil } from '@vercel/functions';

export async function GET(req) {
  // Resposta rápida pro usuário
  const response = Response.json({ ok: true });
  // Refresh em background sem bloquear
  waitUntil(refreshSheetsCache());
  return response;
}
```

V1: não usar — `revalidateTag` no cron já resolve sem complicação.

#### 9.6.6 Monitoramento de funções

Painel Vercel > Functions tab:
- Latência p50/p95/p99 por rota
- Erros (4xx, 5xx)
- Cold start rate
- Active CPU usage

Cruzar com Sentry pra investigação detalhada.

### 9.7 Domínio (opcional)

Domínio sugerido: `dashboard.mettabrasil.com.br` (subdomínio). Configurar DNS apontando CNAME pra Vercel.

---

## 10. Observabilidade

### 10.1 Stack

| Camada | Ferramenta | Cobertura |
|---|---|---|
| Erros server-side e client-side | **Sentry** (free tier: 5k events/mês) | Captura exception, stack trace, breadcrumbs, contexto do usuário |
| Performance real (RUM) | **Vercel Analytics** + **Speed Insights** | Core Web Vitals, page views, real user metrics |
| Logs de função | **Vercel Logs** (built-in) | console.log/warn/error, structured logging |
| Banner stale no app | **Custom** | Timestamp do último cache refresh visível no topbar |

### 10.2 Setup Sentry (Next.js 16+)

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

O wizard cria:
- `instrumentation.ts` (root) — registra Sentry no boot do servidor (substituiu `sentry.server.config.ts` no Next 13+)
- `sentry.client.config.ts` — config client-side
- `sentry.edge.config.ts` — config para middleware/edge runtime
- `next.config.ts` envolvido com `withSentryConfig` (upload de source maps automático)

**Configuração server (`instrumentation.ts`):**

```typescript
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.2,
      environment: process.env.VERCEL_ENV ?? 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      ignoreErrors: ['NEXT_REDIRECT', 'NEXT_NOT_FOUND'],
      beforeSend(event) {
        if (event.user?.email) event.user.email = '[REDACTED]';
        return event;
      },
    });
  }
}

// onRequestError hook captura erros de Server Components automaticamente
export const onRequestError = Sentry.captureRequestError;
```

**Configuração client (`sentry.client.config.ts`):**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // menos sampling no client (eventos volumosos)
  replaysSessionSampleRate: 0,   // session replay: 0% v1 (custo)
  replaysOnErrorSampleRate: 1.0, // captura replay quando há erro
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }), // mascara PII automático
  ],
});
```

**Env vars adicionais no Vercel:**
- `SENTRY_DSN` (server) + `NEXT_PUBLIC_SENTRY_DSN` (client)
- `SENTRY_AUTH_TOKEN` (build-time upload de source maps; só em Production)
- `SENTRY_ORG`, `SENTRY_PROJECT`

**Source maps:**
- Upload automático via `withSentryConfig` no `next.config.ts`. Permite stack traces legíveis (com nome de variável original, não minificado).
- Em Turbopack (default Next 16): source maps geradas e enviadas em build de produção. Confirmar versão do `@sentry/nextjs` compatível.

**Performance traces:**
- 20% sample rate server, 10% client. Traceia: fetch da Sheets, render de Server Component, navegação.
- Permite identificar página/operação lenta sem precisar de logs manuais.

#### 10.2.1 Instrumentação custom de Sheets API

Adicionar trace explícito ao fetch da Sheets (visibilidade fina):

```typescript
// lib/sheets/read.ts
import * as Sentry from '@sentry/nextjs';

async function readSheetTraced(tab: Tab) {
  return Sentry.startSpan(
    { name: `sheets.read.${tab}`, op: 'sheets.read', attributes: { tab } },
    async () => {
      const start = Date.now();
      const data = await fetchWithRetry(/* ... */);
      Sentry.setMeasurement('sheets.rows', data.length, 'none');
      logInfo('sheets.read.success', { tab, durationMs: Date.now() - start, rows: data.length });
      return data;
    },
  );
}
```

Resultado no painel: spans com nome `sheets.read.fb_todos`, latência p50/p95, rows lidas. Identifica regressões rapidamente.

#### 10.2.2 User context (preserva PII)

```typescript
// app/(dashboard)/layout.tsx (Server Component)
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';

export default async function Layout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    Sentry.setUser({ id: user.id }); // SÓ id — sem email, sem nome
  }
  return /* ... */;
}
```

Eventos no Sentry ficam associados ao `user.id` (UUID), permitindo filtrar erros por usuário sem expor PII no painel.

### 10.3 Setup Vercel Analytics + Speed Insights

```bash
pnpm add @vercel/analytics @vercel/speed-insights
```

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Sem env vars adicionais — Vercel detecta automaticamente.

**Free tier:** 100k events/mês (Analytics) + 10k samples (Speed Insights). Suficiente folgado pra 5-10 usuários.

### 10.4 Logging estruturado

Padrão de logs em JSON (Vercel renderiza colorido no painel):

```typescript
// lib/log.ts
type LogContext = Record<string, string | number | boolean | null | undefined>;

export function logInfo(event: string, ctx: LogContext = {}) {
  console.log(JSON.stringify({ level: 'info', event, ...ctx, ts: new Date().toISOString() }));
}

export function logWarn(event: string, ctx: LogContext = {}) {
  console.warn(JSON.stringify({ level: 'warn', event, ...ctx, ts: new Date().toISOString() }));
}

export function logError(event: string, error: unknown, ctx: LogContext = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: 'error', event, error: message, ...ctx, ts: new Date().toISOString() }));
}
```

**Campos obrigatórios em todo log:**
- `level` (info/warn/error)
- `event` (slug curto: `sheets.read.start`, `sheets.read.success`, `auth.login.fail`, `calc.divisao-zero`)
- `ts` (ISO timestamp UTC)

**Campos contextuais comuns:**
- `tab` (qual aba)
- `durationMs` (latência de operação)
- `rowsRead` (volume)
- `userId` (Supabase user.id — NÃO email)
- `requestId` (Vercel header `x-vercel-id`)

**O que NÃO logar:**
- Email/nome completo do usuário (PII)
- Telefone
- Conteúdo das linhas (pode conter PII)
- Service Account key, tokens, secrets

### 10.5 Eventos-chave instrumentados

| Evento | Quando | Severidade |
|---|---|---|
| `sheets.read.success` | Fetch da Sheets OK | info |
| `sheets.read.timeout` | Fetch passou de 30s | error (Sentry) |
| `sheets.read.quota_exceeded` | HTTP 429 | error (Sentry) |
| `sheets.parse.error` | Linha falhou Zod | warn |
| `sheets.parse.fatal` | 0 linhas válidas | error (Sentry) |
| `cache.revalidate.success` | Cron warmup OK | info |
| `cache.revalidate.fail` | Cron falhou | error (Sentry) |
| `auth.login.start` | Click em "Entrar com Google" | info |
| `auth.login.success` | Sessão criada | info |
| `auth.login.fail` | OAuth ou magic link falhou | warn |
| `auth.session.expired` | Refresh token expirado | info |
| `calc.divisao-zero` | Tentativa de calcular taxa com denominador zero | warn (Sentry sample 1%) |
| `page.render.slow` | Server Component > 1s | warn |
| `filter.invalid` | Search params inválidos | warn |

### 10.6 Banner de cache stale

Topbar mostra "Atualizado há X min" baseado em timestamp do último fetch bem-sucedido.

```tsx
// components/dashboard/stale-banner.tsx
export function StaleBanner({ lastUpdated }: { lastUpdated: Date }) {
  const ageMs = Date.now() - lastUpdated.getTime();
  const ageMin = Math.floor(ageMs / 60_000);

  if (ageMin < 15) return null; // fresh, sem banner
  if (ageMin < 60) return <Badge variant="default">Atualizado há {ageMin} min</Badge>;
  if (ageMin < 240) return <Badge variant="warning">Atualizado há {Math.floor(ageMin / 60)}h</Badge>;
  return <Badge variant="danger">Dados desatualizados (+{Math.floor(ageMin / 60)}h)</Badge>;
}
```

**Fonte do timestamp:** retornado pelo `readSheet()` como metadado (header customizado ou prop separada). Server Component passa pro Client Component.

### 10.7 Página de debug `/debug/compare` (oculta)

`/debug/compare` mostra lado a lado:
- Coluna A: KPI calculado pelo dashboard
- Coluna B: KPI lido da aba "Análise Geral" da planilha (range fixo)
- Diff em vermelho se discrepância

```typescript
// app/debug/compare/page.tsx
export default async function ComparePage() {
  if (process.env.VERCEL_ENV === 'production') notFound(); // só em dev/preview
  // ...
}
```

### 10.8 Alertas

V1 setup:
- **Sentry:** notificação por email pra cada erro novo. Configurar no painel.
- **Vercel:** notificação por email em deploy fail / cron fail.
- **Cron health check:** rota `/api/cron/refresh-sheets` retorna `{ ok: true, ts }`. Configurar UptimeRobot/cron-job.org chamando essa URL — alerta se falhar 3x seguidas.

V2 (futuro):
- Webhook Discord/Slack quando Sentry detectar erro com > 10 ocorrências/hora
- Dashboard interno de "health" da app (separado, opcional)

### 10.9 Sentry dashboards customizados

Criar 3 dashboards no painel Sentry:

1. **App Health:** erros por dia, top 10 erros, error rate (%)
2. **Performance:** p50/p95/p99 de fetch Sheets, de render por página
3. **Cache:** cron successes vs failures, tempo desde último warmup

Documentar URLs dos dashboards no README do repo pra fácil acesso.

---

## 11. Edge cases mapeados

| # | Cenário | Comportamento esperado |
|---|---|---|
| 1 | Sheets API timeout (> 60s) | Server Component captura, retorna cache anterior + banner "Atualizando dados..." |
| 2 | Sheets API quota excedida (429) | Mesmo que timeout — usa cache anterior, log de erro |
| 3 | Coluna removida da planilha (schema drift) | Zod falha, página mostra error boundary com mensagem clara: "Coluna 'X' não encontrada em <aba>. Verifique a planilha." |
| 4 | Lead com `qualificacao` em valor não mapeado | Logado como warning, classificado como "Outros" |
| 5 | Campanha sem marcador `PERP+CAPT` | Ignorada pelos filtros de funil (comportamento da planilha) |
| 6 | Filtro de data inválido (`from > to`) | Sanitização: troca os valores |
| 7 | Aba `Metas` não existe ainda | Página Metas mostra: "Configure a aba Metas na planilha. Estrutura esperada: ..." |
| 8 | Service Account sem permissão de leitura | Erro fatal na boot — log claro, retorna 500 |
| 9 | Usuário não autenticado tenta `/dashboard/*` | Middleware redireciona pra `/login` |
| 10 | Múltiplos usuários abrem dashboard ao mesmo tempo (cold cache) | Cache Components do Next 16 deduplicam fetch. Apenas 1 chamada à Sheets API |
| 11 | `vendas.valorContrato` formatado errado ("R$ 290k") | parseValor retorna NaN, KPI mostra "—", log de warning |
| 12 | Lead sem `data de inscrição` normalizada (coluna P vazia) | Excluído dos cálculos de "Leads no período" |
| 13 | Cron Job falha (> 1h sem revalidação) | Banner stale exibido. Próximo trigger tenta de novo |
| 14 | Deploy quebra build | Vercel mantém deploy anterior em produção |
| 15 | Cliente abre URL com filtros inválidos (`?from=lalala`) | parseFilters retorna default + log de warning |
| 16 | Usuário muda filtro 5x em 2 segundos | `router.replace` debounce 300ms; só último filtro vale |
| 17 | Tabela com 30+ linhas | Scroll interno no card (tabela headerizada com sticky header) |
| 18 | Coluna `qualificacao` tem "Interprise" (typo histórico) | Tratar como sinônimo de "Enterprise" no normalize |
| 19 | Cargo do form vs planilha diverge (case, acento) | Normalização: lowercase + remove acentos antes de comparar |
| 20 | Valor monetário com diferentes formatos ("6,38" vs "R$ 6,38") | parseValor lida com ambos |
| 21 | Planilha cresce e fb_todos ultrapassa 100k linhas | Otimização: paginar por mês via `batchGet`. Implementar quando o fetch passar de 30s |
| 22 | Sheets retorna resposta parcial (algumas ranges OK, outras falham) | `batchGet` retorna `valueRanges` parciais. Tratar cada ausente como erro individual; servir cache anterior pras abas faltantes |
| 23 | Lead aparece duplicado (mesmo email, várias linhas em `leads`) | dedupeLeadsByEmail mantém a entrada mais recente (§5.1.8) |
| 24 | Email com case diferente entre abas | Schema Zod normaliza pra lowercase no parse — join sempre case-insensitive |
| 25 | SDR mudou `dataReuniao` (reagendou) | Comportamento da planilha: sobrescreve. Não há histórico (§5.1.10). Conta na data atual |
| 26 | Filtro cruza dois meses (25/04 a 05/05) na página Metas | v1: meta calculada usando o mês de `from`. v2: pro-rata por mês |
| 27 | Filtro de 1 dia (from = to) | Filtro inclusivo, 23:59:59 do mesmo dia. Investimento/vendas daquele dia |
| 28 | Filtro futuro (data > hoje) | Permite, mas dados retornados serão vazios. Sem erro |
| 29 | Página recarregada com cache em estado de revalidação | Stale-while-revalidate serve cache antigo enquanto refetch em background |
| 30 | Hot reload em dev altera schema | `NEXT_CACHE_COMPONENTS_IN_DEV=false` (default) garante revalida sempre. Sem entropia |
| 31 | Build de preview em PR roda sem env vars de produção | Env vars marcadas como "Preview" no Vercel são herdadas. Se faltarem, build falha com mensagem clara (não rodar default vazio) |
| 32 | Service Account key tem `\n` mal escapado | Cliente JWT falha. Erro claro no boot: "Verifique GOOGLE_SHEETS_PRIVATE_KEY — \n deve ser literal" |
| 33 | Token Supabase expira durante uso | `@supabase/ssr` refresh automático. Se refresh falhar, redirect pra `/login` com toast "Sessão expirou" |
| 34 | Magic Link expira antes do clique | Supabase mostra erro nativo. Tela amigável: "Link expirado, peça outro" |
| 35 | Usuário faz logout em uma aba, outra continua aberta | Auth state se propaga via Supabase listener. Outra aba detecta + redireciona |
| 36 | Vendas com `produto = "Up-sell"` (caso §5.3.5) | Conta em "Todos"; não conta em funis específicos. Aparece como bucket em Origem se relevante |
| 37 | Lead sem nenhum `utm_*` (venda direta, indicação) | Conta em "Direto" / "Sem origem" nos cards de UTM (§5.3.4) |
| 38 | Comparação MoM com mês anterior tendo 0 dados | Esconde o delta (mostra só o KPI atual). Sem fake "+∞%" |
| 39 | Dois usuários filtram diferente ao mesmo tempo | Cada um tem URL distinta + recálculo server-side independente. Cache base de Sheets é único |
| 40 | Tela mobile (<768px) com filtros e tabela 13 colunas | Sidebar vira drawer (off-canvas). Tabela vira lista de cards (1 por linha). Ver §18 |
| 41 | Heatmap em mobile | Reduz hora-range pra horas comerciais (08-18h). Texto menor. Reorienta se necessário |
| 42 | Charts em mobile (Recharts) | `ResponsiveContainer` se adapta. Labels rotacionam ou somem em telas pequenas |
| 43 | Sentry recebe loop infinito de erro | Rate limit no client (1 erro por endpoint por minuto). Evita explosão de quota |
| 44 | Vercel Analytics consome bandwidth significativo | Free tier inclui 100k events/mês. Monitorar; se passar, sample 10% das pageviews |
| 45 | Build falha por dependency cíclica em `lib/calc` | TypeScript strict + ESLint catch antes de PR. CI bloqueia merge |
| 46 | Date picker permite range > 365 dias | Limite hard: 365 dias máximo (validação no parseFilters). Toast se ultrapassar |
| 47 | Sheets API retorna estrutura mudada (`valueRanges` virou outro nome) | Improvável (API estável). Schema Zod top-level captura. CI test contra fixtures detecta cedo |
| 48 | Cache atinge limite de 2GB do Vercel | Improvável (~45MB total). Se atingir: serializar tipos primitivos (números em vez de Date objects). Reavaliar |
| 49 | Usuário do time exclui acidentalmente uma coluna da planilha | Validação Zod marca como schema drift. Página mostra error boundary "Falta coluna X em <aba>" — restaurar do histórico de versões do Sheets |
| 50 | Planilha trocou de ID (clone, novo arquivo) | Env var aponta pro ID errado. SA não tem acesso. Erro de auth na primeira request. Log claro |

---

## 12. Roteiro de execução granular

Cada tarefa é **atômica** (1-3 horas) com critério de "pronto". Marca `[x]` quando termina. **Cada fase termina com um commit/deploy verificável** — não passa pra próxima sem o critério de fase satisfeito.

### Fase 0 — Bootstrap (1-2 dias)

#### 0.1 Repo e Next.js
- [ ] Criar repo `dashboard-metta-paliativo` no GitHub (privado)
- [ ] Clone local
- [ ] `pnpm create next-app@latest .` — TS, Tailwind, App Router, `src/` = não, ESLint = sim, Turbopack = sim
- [ ] Commit inicial: "chore: initial scaffold"
- [ ] **Pronto quando:** `pnpm dev` mostra "Hello Next.js" em `localhost:3000`

#### 0.2 shadcn/ui
- [ ] `pnpm dlx shadcn@latest init` — New York style, base color Slate (vamos sobrescrever pra Metta)
- [ ] Adicionar componentes: `pnpm dlx shadcn@latest add sidebar button input card table popover badge select calendar separator scroll-area dropdown-menu tooltip skeleton sheet dialog tabs`
- [ ] **Pronto quando:** `/components/ui/` populado, build sem erro

#### 0.3 Identidade visual base
- [ ] Baixar SF Pro Variable do Drive (ID `1SDXY_sNrpM9wMxQ5F2_IHq_boVz8jXoB`) → `public/fonts/`
- [ ] `app/globals.css`: `@font-face` SF Pro + CSS variables Metta (§15.2)
- [ ] Baixar `Simbolo_metta_amarelo.svg` e `Logo_metta_colorido_escuro_v.svg` → `public/brand/`
- [ ] **Pronto quando:** página de teste mostra "Olá" em SF Pro com cor `#0C161B`

#### 0.4 Vercel
- [ ] Conectar repo no painel Vercel
- [ ] Branch `main` = Production
- [ ] **Pronto quando:** primeiro push em `main` faz deploy automático

#### 0.5 Google Cloud
- [ ] Criar projeto `dashboard-metta-paliativo` no Google Cloud Console
- [ ] Habilitar Google Sheets API
- [ ] Criar Service Account `dashboard-sheets-reader`
- [ ] Gerar e baixar chave JSON
- [ ] Compartilhar planilha com email da SA como "Leitor"
- [ ] Configurar OAuth consent screen (External, nome "Metta Dashboard")
- [ ] Criar OAuth Client ID (Web App) com redirect URIs do Supabase (§8.2)
- [ ] **Pronto quando:** `gcloud auth activate-service-account --key-file=key.json` funciona localmente

#### 0.6 Supabase
- [ ] Criar projeto Supabase na região South America (São Paulo)
- [ ] Habilitar Google Provider em Authentication > Providers
- [ ] URL configuration (Site URL + Redirect URLs)
- [ ] Copiar `URL` e `anon key` do Settings > API
- [ ] **Pronto quando:** `curl <SUPABASE_URL>/auth/v1/health` retorna 200

#### 0.7 Env vars
- [ ] `.env.local` local com todas as vars (§9.2)
- [ ] `.env.local` no `.gitignore` (confirmar)
- [ ] `.env.local.example` commitado com placeholders
- [ ] Configurar todas no Vercel (Production + Preview)
- [ ] **Pronto quando:** `vercel env pull` baixa as vars

**Critério da Fase 0:** Deploy hello world em `*.vercel.app`, env vars todas configuradas, planilha acessível via SA.

---

### Fase 1 — Camada de dados (2-3 dias)

#### 1.1 Cliente Sheets
- [ ] `pnpm add googleapis zod`
- [ ] `lib/sheets/client.ts` (§4.4.1)
- [ ] **Pronto quando:** `sheets.spreadsheets.values.get({...})` retorna dados em script de teste

#### 1.2 Schemas Zod
- [ ] `lib/sheets/schemas.ts` (§4.2.6) — todos os 5 schemas
- [ ] `lib/sheets/parse.ts` (§4.2.7)
- [ ] **Pronto quando:** parse de fixture sintética retorna tipos corretos sem erro

#### 1.3 Leitura cacheada
- [ ] `lib/sheets/read.ts` — `readSheet(tab)` e `readAllSheets(tabs)`
- [ ] Diretiva `'use cache'`, `cacheLife`, `cacheTag`
- [ ] Retry + timeout (§4.4.5)
- [ ] **Pronto quando:** primeira chamada lê da Sheets, segunda chamada idêntica usa cache (verificar via log)

#### 1.4 Logging
- [ ] `lib/log.ts` (§10.4)
- [ ] **Pronto quando:** logs JSON aparecem em `pnpm dev` e Vercel

#### 1.5 Cron
- [ ] `app/api/cron/refresh-sheets/route.ts`
- [ ] `vercel.json` com cron schedule
- [ ] **Pronto quando:** deploy + esperar 10 min, ver log `cache.revalidate.success`

#### 1.6 Endpoint manual
- [ ] `app/api/revalidate/route.ts`
- [ ] **Pronto quando:** `curl -X POST $URL/api/revalidate -H "x-revalidate-secret: $SECRET"` retorna `{ok:true}`

**Critério da Fase 1:** Conseguir ler todas as 4 abas via função `readAllSheets`, com cache funcionando e cron rodando.

---

### Fase 2 — Camada de cálculo (3-4 dias)

#### 2.1 Helpers compartilhados
- [ ] `lib/calc/shared.ts` (§5.1)
- [ ] `lib/filters.ts` (parse/serialize search params)
- [ ] **Pronto quando:** todos os helpers têm teste unitário passando

#### 2.2 Funções de cálculo por página
- [ ] `lib/calc/visao-geral.ts` (§5.2.1)
- [ ] `lib/calc/trafego.ts` (§5.2.2)
- [ ] `lib/calc/sdr.ts` (§5.2.3)
- [ ] `lib/calc/closer.ts` (§5.2.4)
- [ ] `lib/calc/anuncios.ts` (§5.2.5)
- [ ] `lib/calc/origem.ts` (§5.2.6)
- [ ] `lib/calc/metas.ts` (§5.2.7)
- [ ] **Pronto quando:** cada função tem assinatura `(rawData, filters) → result` + teste com fixture

#### 2.3 Testes
- [ ] `pnpm add -D vitest @vitest/ui happy-dom`
- [ ] Configurar `vitest.config.ts`
- [ ] Testes pra cada função de cálculo (mínimo 5 casos: feliz, vazio, edge case, filtro restritivo, divisão por zero)
- [ ] **Pronto quando:** `pnpm test` passa com cobertura > 80% em `lib/calc/`

**Critério da Fase 2:** Funções de cálculo prontas, testadas, retornando os números corretos contra dataset sintético.

---

### Fase 3 — Layout global + filtros (2 dias)

#### 3.1 Layout dashboard
- [ ] `app/(dashboard)/layout.tsx` — sidebar + topbar + main
- [ ] `components/dashboard/sidebar.tsx` (§15.4.1)
- [ ] `components/dashboard/topbar.tsx`
- [ ] **Pronto quando:** páginas vazias mostram sidebar e topbar

#### 3.2 Sidebar interativa
- [ ] Toggle sidebar (Cmd+B + botão)
- [ ] localStorage pra estado colapsado
- [ ] Logo Metta (símbolo amarelo)
- [ ] Item ativo destacado com accent amarelo
- [ ] Footer com user info (`<UserInfo />`)
- [ ] **Pronto quando:** Cmd+B colapsa/expande, navegação entre páginas atualiza item ativo

#### 3.3 Date Range Popover
- [ ] `components/dashboard/date-range-popover.tsx` (§6.2.4)
- [ ] PT-BR (nomes de meses, dias da semana)
- [ ] Presets 7/14/30/90 dias, Este mês, Mês passado
- [ ] **Pronto quando:** popover abre ancorado, presets funcionam, range visual destacado

#### 3.4 Funnel Chips
- [ ] `components/dashboard/funnel-chips.tsx` (§6.2.5)
- [ ] "Todos" como atalho de seleção total
- [ ] **Pronto quando:** click em chip toggle visual, click em "Todos" alterna todos

#### 3.5 Sincronização com URL
- [ ] `useFilters()` hook que lê/escreve `searchParams`
- [ ] `router.replace({ scroll: false })` em mudança
- [ ] **Pronto quando:** mudança de filtro reflete na URL, back/forward funciona

**Critério da Fase 3:** Layout completo navegável (sidebar + topbar + filtros). Páginas ainda vazias mas filtros respondem.

---

### Fase 4 — Páginas (5-7 dias)

#### 4.1 Comercial SDR
- [ ] Server Component que chama `readSheet('leads')` e `readSheet('sdr')` + `calcSdr(filters)`
- [ ] KPI cards
- [ ] Funil SDR (`<FunnelVertical />`)
- [ ] Heatmap dia × hora
- [ ] Tabela "Performance por SDR"
- [ ] Loading skeleton + Empty state + Error boundary
- [ ] **Pronto quando:** valores batem com planilha pra um período de teste

#### 4.2 Comercial Closer
- [ ] Mesma estrutura, dados de `sdr` + `vendas`
- [ ] **Pronto quando:** valores batem

#### 4.3 Tráfego Pago
- [ ] KPIs, combo barras+linha (Recharts), dual bars, funil de tráfego
- [ ] Tabela "Ranking de mídia" com toolbar interno (Campanha/Adset + Temperatura + Busca)
- [ ] **Pronto quando:** valores batem com Análise Tráfego da planilha

#### 4.4 Anúncios
- [ ] 3 top cards (CPL, CMQL, Vendas)
- [ ] Galeria de criativos
- [ ] **Pronto quando:** top criativos identificados corretamente

#### 4.5 Origem
- [ ] 7 tabelas em sequência (UTM Source/Medium/Campaign, Qualificação, Cargo, Faturamento, Segmento)
- [ ] **Pronto quando:** somatórios cruzados batem (ex: total de leads em UTM Source = total geral)

#### 4.6 Visão Geral
- [ ] 10 KPI cards
- [ ] Combo chart + Funil + Custo por etapa + Distribuição por funil
- [ ] Tabela diária (13 colunas)
- [ ] **Pronto quando:** valores batem com Análise Geral

#### 4.7 Metas vs Realizado
- [ ] Pré-requisito: criar aba `Metas` na planilha
- [ ] Hero KPI Faturamento
- [ ] Tabela funil meta vs real
- [ ] 4 cards de taxa
- [ ] Gráfico de pacing
- [ ] Comportamento month-to-date
- [ ] **Pronto quando:** mudança em `Metas` reflete em < 15 min

**Critério da Fase 4:** Todas as 7 páginas renderizam com dados reais, valores conferidos contra planilha.

---

### Fase 5 — Auth + responsividade + a11y + observabilidade (3-4 dias)

#### 5.1 Auth (Supabase)
- [ ] `pnpm add @supabase/ssr @supabase/supabase-js`
- [ ] `lib/supabase/client.ts` + `lib/supabase/server.ts`
- [ ] `middleware.ts` protegendo `/dashboard/*`
- [ ] `/login` page com template Login06 adaptado pra Metta (§8.5, §15.5)
- [ ] `/auth/callback/route.ts`
- [ ] **Pronto quando:** logout → redirect login → click Google → callback → dashboard

#### 5.2 Estados de UI
- [ ] Loading skeletons em todas as páginas (Suspense por componente)
- [ ] Empty states
- [ ] Error boundaries (`error.tsx` por página)
- [ ] **Pronto quando:** desligar internet local, recarregar página: mostra cache anterior + banner stale

#### 5.3 Responsividade
- [ ] Sidebar drawer < 1024px
- [ ] Tabelas viram cards < 768px
- [ ] Filtros empilhados em mobile
- [ ] **Pronto quando:** todas as 7 páginas usáveis em 375px, 768px, 1440px

#### 5.4 Acessibilidade
- [ ] ARIA labels em botões só-ícone
- [ ] Focus visible em todos interativos
- [ ] Lighthouse a11y ≥ 95 em todas as páginas
- [ ] **Pronto quando:** navegar todo dashboard apenas com teclado funciona

#### 5.5 Observabilidade
- [ ] `pnpm add @sentry/nextjs @vercel/analytics @vercel/speed-insights`
- [ ] Sentry init (`sentry.client.config.ts`, `sentry.server.config.ts`)
- [ ] Analytics + Speed Insights no layout
- [ ] Logs estruturados em pontos-chave (§10.5)
- [ ] **Pronto quando:** erro forçado aparece no painel Sentry

#### 5.6 Debug page
- [ ] `/debug/compare` (oculta em prod via env flag)
- [ ] **Pronto quando:** acessar em preview mostra comparação dashboard vs planilha

**Critério da Fase 5:** Auth funcionando, responsivo, com observabilidade ativa.

---

### Fase 6 — Documentação + produção (1-2 dias)

#### 6.1 Documentação
- [ ] `README.md` com setup, arquitetura, troubleshooting
- [ ] `docs/RUNBOOK.md` (§20.3)
- [ ] `docs/SMOKE-TESTS.md` (§22.4)
- [ ] **Pronto quando:** outra pessoa consegue rodar local seguindo README

#### 6.2 Domínio (opcional)
- [ ] Configurar `dashboard.mettabrasil.com.br` no Vercel
- [ ] DNS CNAME apontando pra Vercel
- [ ] **Pronto quando:** domínio resolve e dashboard carrega

#### 6.3 Sanity check final
- [ ] 3 períodos × 3 funis × 5 KPIs = 45 valores comparados manualmente
- [ ] Diff aceito: 0
- [ ] **Pronto quando:** todos conferem

#### 6.4 Promoção pra prod
- [ ] Merge final em `main`
- [ ] Verificar deploy em `*.vercel.app` ou domínio
- [ ] Comunicar time
- [ ] **Pronto quando:** time tá usando

**Critério da Fase 6:** Dashboard em produção, sendo usado pelo time, documentado pra próximo dev.

---

**Total estimado: 16-22 dias (3-4.5 semanas) solo.**

### 12.1 Plano de rollback

Cada fase pode rollback via Vercel:
- Painel Vercel → Deployments → deploy anterior → "Promote to Production"
- Tempo: 30s

Se um deploy quebra em prod, rollback imediato + abrir branch `fix/...` pra investigar sem pressa.

---

## 13. Roteiro de validação (testes)

### 13.1 Unitários (Vitest)

Cobertura > 80% em `lib/calc/`. Cada função pura testada com:
- Dataset sintético controlado
- Edge cases: array vazio, filtros restritivos demais, valores nulos
- Comparação esperada vs calculada

### 13.2 Manuais (smoke tests)

Após cada deploy:
1. Login Google funciona
2. Todas as 7 páginas renderizam sem erro
3. Filtros mudam URL e KPIs
4. Mudança de funil reflete em todos os números
5. Sidebar colapsa/expande (Cmd+B)

### 13.3 Sanity check vs planilha (manual, antes de prod)

Pegar 3 períodos distintos (últimos 7 dias, mês atual, mês passado) e 3 funis (Sessão, Aplicação, Todos). Para cada combinação:
- Comparar todos os KPIs do Dashboard vs Análise Geral da planilha
- Diff aceito: 0

### 13.4 Performance

Pre-prod:
- Lighthouse desktop > 85
- First load (cache hit) < 2s
- Mudança de filtro < 500ms

### 13.5 Segurança

- `.env.local` no `.gitignore` (verificar)
- Service Account key não exposto em logs nem em respostas
- Endpoints `/api/cron/*` e `/api/revalidate` exigem secret

---

## 14. Backlog (v2+, fora do escopo v1)

| Item | Por quê não agora | Trigger pra subir |
|---|---|---|
| Comparação MoM/YoY automática | Complexidade extra; v1 já tem delta% no card de Leads | Após v1 estável |
| Drill-down por clique em KPI | UX adicional; não está no wireframe | Após validação dos números |
| Export CSV/PDF dos relatórios | Botões "Exportar" já estavam no wireframe, mas não são críticos | Após v1 em uso |
| Notificações Slack/E-mail | Não pediu nessa fase | Quando usuário pedir |
| Mobile-first responsivo | Foco em desktop pro time interno | Se time pedir |
| Histórico congelado (snapshots) | Precisa de DB | Quando virar produto formal |
| Multi-empresa | Não tem demanda | N/A |
| Integração direta Meta Ads API | Sheets já tem os dados via outra automação | Se Sheets virar gargalo |
| Caching com Vercel KV | ISR + Cache Components resolvem v1 | Se time crescer e CRON warmup não bastar |
| Thumbnails reais dos criativos (Anúncios) | Precisa de Meta Ads API + storage | v2 |
| Filtros mais granulares (SDR, Closer no SDR/Closer) | Selects já mapeados em §5.2.3/5.2.4 | Se útil em uso real |
| Páginas adicionais sugeridas | Drill por funil já foi removido pelo usuário | Sob demanda |

---

## 15. Identidade Visual Metta aplicada ao Dashboard

Esta seção traduz o sistema de identidade visual da Metta (`~/Documents/Metta/knowledge/guidelines/visual-identity.md`) para o contexto específico do dashboard. **Decisão chave:** o fundo principal do dashboard permanece **branco** (`#FFFFFF`) — não é uma peça de marketing, é uma ferramenta de trabalho diurna. A identidade Metta entra nos elementos secundários: sidebar, accents, tipografia, cantos, badges, headers.

### 15.1 Princípios de adaptação

| Princípio | Aplicação no dashboard |
|---|---|
| Fundo branco como base | Área de conteúdo principal sempre `#FFFFFF`. Cards brancos com borda sutil. |
| Sidebar como âncora de marca | Sidebar usa **azul noite** (`#0C161B`) — onde o logo Metta vive e respira |
| Amarelo como accent, não dominante | `#FFBE18` reservado para: chips de funil ativos, hover states de KPIs positivos, botões de ação primária, destaques pontuais (badge "abaixo da meta" em delta favorável) |
| Tipografia SF Pro como única família | Substituir Inter no wireframe atual por SF Pro Variable (carregar via @font-face) |
| Cantos arredondados consistentes | Cards: 12px · Pills/badges: 33-48px · Inputs/Buttons: 8-12px (compatível com 12px do sistema Metta) |
| Hierarquia: tracking negativo em titles | Headlines com `letter-spacing: -1%` a `-2%`; labels uppercase com `letter-spacing: +9% a +12%` |

### 15.2 Paleta aplicada ao dashboard

| Token | Hex | Onde aparece |
|---|---|---|
| `--metta-yellow` | `#FFBE18` | Chip de funil ativo, botão primário, accent em deltas positivos, link hover |
| `--metta-yellow-soft` | `#FFE4A1` | Background hover sutil em rows de tabela |
| `--metta-blue-night` | `#0C161B` | Sidebar background, texto principal sobre fundo branco, headers fortes |
| `--metta-blue-night-deep` | `#0A1013` | Estados pressed/active, hover na sidebar |
| `--metta-blue-gray` | `#435965` | Texto secundário, labels de filtros, sub-info de KPIs |
| `--metta-blue-gray-light` | `#688594` | Texto terciário, captions, "data atualizada há X min" |
| `--metta-blue-gray-subtle` | `#A8B3B9` | Linhas de grid, divisores sutis, placeholders muted |
| `--bg` | `#FFFFFF` | Background principal do main |
| `--bg-soft` | `#FAFCFD` (Branco Gelo) | Background de zebra-stripe em tabelas, fundos de seção alternados |
| `--bg-ice-blue` | `#EBF3F7` | Range highlight no date picker, hover de células do heatmap |
| `--border` | `#EFF3F5` ou `#EDEDED` | Borda de cards, separadores |
| `--border-strong` | `rgba(12, 22, 27, 0.2)` | Divisor entre seções, header de tabela |
| `--success` | `#16A34A` (verde mantido) | Deltas positivos |
| `--warning` | `#F59E0B` (laranja mantido) | Pacing fora do ritmo |
| `--danger` | `#DC2626` (vermelho mantido) | Deltas negativos |

**Substituição direta no CSS atual:**
```css
/* DE (wireframe atual) */     /* PARA (Metta) */
--bg: #fafafa;                 --bg: #FFFFFF;
--panel: #fff;                 --panel: #FFFFFF;
--line: #eaeaea;               --line: #EFF3F5;
--text: #0a0a0a;               --text: #0C161B;
--text-2: #52525b;             --text-2: #435965;
--text-3: #8a8a8a;             --text-3: #688594;
--accent: #0070f3;             --accent: #FFBE18;
--accent-soft: #e7f0ff;        --accent-soft: #FFE4A1;
--sidebar: #0a0a0a;            --sidebar: #0C161B;
--sidebar-2: #171717;          --sidebar-2: #1E2A30;
```

### 15.3 Tipografia aplicada

**Família:** SF Pro Variable (carregar do Drive ID `1SDXY_sNrpM9wMxQ5F2_IHq_boVz8jXoB` ou via CDN/self-host).

```css
@font-face {
  font-family: 'SF Pro';
  src: url('/fonts/SF-Pro-Variable.ttf') format('truetype-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

**Escala aplicada ao dashboard:**

| Uso | Weight | Size | Line-height | Letter-spacing |
|---|---|---|---|---|
| Título de página (topbar) | 650 (Semibold) | 14px | 1.0 | -0.5% |
| KPI valor grande | 870 (Black) | 28px | 1.1 | -2% |
| KPI label (uppercase) | 540 (Medium) | 11px | 1.2 | +9% (caixa alta) |
| KPI sub-info | 400 (Regular) | 12px | 1.4 | -1% |
| Card title | 650 (Semibold) | 13px | 1.2 | -1% |
| Table header (uppercase) | 540 (Medium) | 11px | 1.2 | +9% |
| Table body | 400 (Regular) | 13px | 1.4 | -1% |
| Sidebar item | 510 (Medium) | 13.5px | 1.0 | -0.5% |
| Sidebar group label (uppercase) | 540 (Medium) | 11px | 1.0 | +6% |
| Filter label | 540 (Medium) | 11px | 1.0 | +6% (caixa alta) |
| Chip de funil | 510 (Medium) | 12.5px | 1.0 | -0.5% |
| Body text | 400 (Regular) | 14px | 1.5 | -1% |
| Caption / muted | 400 (Regular) | 11.5px | 1.4 | 0% |

### 15.4 Componentes — adaptação visual

#### 15.4.1 Sidebar

- **Background:** `#0C161B` (azul noite). Mantém o tema escuro do wireframe atual.
- **Border-right:** `rgba(255, 255, 255, 0.05)` (sutil)
- **Brand area (topo):**
  - Logo Metta: usar **símbolo isolado amarelo** (Drive ID SVG: `1dwPSsS49LZWJR7hd3HoaNnvgLkWquJs4`) com 32px de altura
  - Quando sidebar expandida: símbolo + wordmark "Metta" em branco + subtitle "Dashboard interno" em `#688594`
  - Quando colapsada (icon-only): só o símbolo
- **Nav items:**
  - Texto branco (`#FFFFFF`) com weight 510 quando hover/active
  - Texto azul acinzentado claro (`#A8B3B9`) em estado normal
  - Hover: background `rgba(255, 255, 255, 0.06)`
  - Active: background `rgba(255, 190, 24, 0.08)` + accent à esquerda (4px de altura) em amarelo `#FFBE18` + ícone também amarelo
  - Ícones: lucide-react, 18px, mesma cor do texto
- **Footer (usuário):**
  - Avatar com iniciais sobre `#1E2A30`, texto branco
  - Nome em branco, email em `#688594`
  - Chevron pra dropdown de logout

#### 15.4.2 Topbar

- **Background:** `#FFFFFF` com `border-bottom: 1px solid #EFF3F5`
- **Esquerda:** botão de toggle sidebar (ghost) + separador vertical (1px, `rgba(12, 22, 27, 0.2)`) + nome da página atual (SF Pro 650, 14px, `#0C161B`)
- **Direita:** banner stale (se aplicável) + avatar do usuário pequeno
- **Banner stale:** badge pill amarela (`#FFE4A1` bg, `#0C161B` text, weight 540) com texto "Atualizado há Xmin"; quando > 1h vira `#F59E0B` bg

#### 15.4.3 KPI Card

```
┌─────────────────────────────┐
│ LABEL UPPERCASE 11px +9%    │ ← #435965, weight 540, tracking largo
│                             │
│ R$ 45.230  28px black -2%   │ ← #0C161B, weight 870, tabular-nums
│                             │
│ CPL R$ 19,67   12px regular │ ← #688594
└─────────────────────────────┘
```

- Background: `#FFFFFF`
- Border: `1px solid #EFF3F5`
- Border-radius: **12px** (Metta spec)
- Padding: 20px
- Shadow: `0 1px 2px rgba(12, 22, 27, 0.04)` (sutil)

#### 15.4.4 Filtros

- **Chips de funil:**
  - Inativo: bg `#FFFFFF`, border `#EFF3F5`, text `#435965`, weight 510, **padding 6px 12px**, **border-radius 33px** (pill Metta)
  - Hover: border `#A8B3B9`, text `#0C161B`
  - Ativo: bg `#FFBE18`, border `#FFBE18`, text `#0C161B`, weight 540
  - Chip "Todos" (atalho): bg `#0C161B`, text `#FFFFFF` quando ativo

- **Select (date trigger, dropdowns):**
  - Mesma régua dos chips mas com border-radius 8px (não pill)
  - Focus: border `#FFBE18` + box-shadow `0 0 0 3px rgba(255, 190, 24, 0.16)` (era azul antes, agora amarelo Metta)

- **Date picker popover:**
  - Card: `rounded-xl` (12px), border `#EFF3F5`, shadow forte
  - Preset ativo: bg `#FFBE18`, text `#0C161B` (era azul antes)
  - Range start/end: bg `#0C161B`, text `#FFFFFF`
  - In-range: bg `#EBF3F7`
  - Botão "Aplicar": bg `#0C161B`, text `#FFFFFF`, hover `#0A1013`

#### 15.4.5 Funil vertical

- Etapas decrescentes (já está no wireframe). Cores ajustadas:
  - Versão "blue" (Visão Geral): gradiente do `#0C161B` → `#FFBE18` (azul noite no topo, amarelo na base). Os 5 steps interpolam entre os dois.
  - Versão "dark" (SDR): tudo em tons de azul noite (`#0C161B`, `#1E2A30`, `#435965`, `#688594`, `#A8B3B9`)
- Text branco em steps escuros, azul noite em steps amarelos.

#### 15.4.6 Tabelas

- Header: `text-transform: uppercase`, `letter-spacing: +9%`, weight 540, 11px, `#435965`, background transparente, `border-bottom: 1px solid #EFF3F5`
- Linhas: `border-bottom: 1px solid #F0F0F0`, hover `#FAFCFD`
- Numbers tabular alinhados ao centro (regra já definida)
- Linha TOTAL: weight 600, background `#FAFCFD`, border-top forte

#### 15.4.7 Botões

- **Primário** (CTAs como "Aplicar", "Atualizar"): bg `#0C161B`, text `#FFFFFF`, weight 540, border-radius 8px, padding 8-12px
- **Primário amarelo** (alta ênfase pontual): bg `#FFBE18`, text `#0C161B`, weight 540
- **Secundário** (Exportar, ações neutras): bg `#FFFFFF`, border `#EFF3F5`, text `#0C161B`
- **Ghost** (toggle sidebar, ícones-only): sem border, hover `#EFF3F5`

#### 15.4.8 Badges / Pills

- Padrão: `padding: 3px 10px`, `border-radius: 33px` (pill Metta), text uppercase 11px, weight 540, letter-spacing +9%
- Variantes:
  - Default (neutro): bg `#F0F0F0`, text `#435965`
  - Yellow (accent Metta): bg `#FFE4A1`, text `#0C161B`
  - Success: bg `#DCFCE7`, text `#15803D`
  - Warning: bg `#FEF3C7`, text `#92400E`
  - Danger: bg `#FEE2E2`, text `#991B1B`

### 15.5 Logo na página de Login

Substituir o `<Logo />` SVG genérico do template `Login06` pelo **símbolo isolado Metta amarelo**:

**Opção A (recomendada — uso de SVG inline pra evitar dependência de rede):**
```tsx
const MettaLogo = (props) => (
  <svg fill="#FFBE18" height="48" viewBox="0 0 ..." width="48" {...props}>
    {/* paths do símbolo Metta — buscar conteúdo do Drive ID 1dwPSsS49LZWJR7hd3HoaNnvgLkWquJs4 */}
  </svg>
);
```

**Opção B (usar arquivo SVG do Drive):**
- Baixar `Simbolo_metta_amarelo.svg` (Drive ID `1dwPSsS49LZWJR7hd3HoaNnvgLkWquJs4`)
- Colocar em `public/brand/simbolo-metta.svg`
- Usar com `<Image src="/brand/simbolo-metta.svg" alt="Metta" width={48} height={48} />`

**Opção C (logo completo na tela de login):**
- Usar `Logo_metta_colorido_escuro_v.svg` (vertical, símbolo amarelo + wordmark azul noite). Drive ID: `1XBx0a3Zi0Gjf8in1Mk-_ynxCYsM834B_`
- Combina com fundo branco da tela de login

**Decisão default:** Opção C (logo completo vertical) — comunica marca melhor que só o símbolo, e a tela de login é o primeiro contato visual do usuário com a app.

### 15.6 Template de email do Magic Link

Customizar no painel Supabase (Authentication > Email Templates > Magic Link):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="background: #FFFFFF; font-family: -apple-system, 'SF Pro', sans-serif; color: #0C161B; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border: 1px solid #EFF3F5; border-radius: 12px; padding: 40px;">
    <img src="https://drive.google.com/uc?id=1XBx0a3Zi0Gjf8in1Mk-_ynxCYsM834B_" alt="Metta" style="height: 48px; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 650; letter-spacing: -1%; margin: 0 0 12px;">Seu link de acesso</h1>
    <p style="color: #435965; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">
      Clique no botão abaixo pra entrar no Dashboard Metta. O link expira em 1 hora.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #0C161B; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 540;">
      Entrar no dashboard
    </a>
    <p style="color: #688594; font-size: 12px; margin-top: 32px;">
      Se você não solicitou esse acesso, pode ignorar este email.
    </p>
  </div>
</body>
</html>
```

### 15.7 Checklist de aplicação visual (executar durante a implementação)

- [ ] Fonte SF Pro carregada via `@font-face` e aplicada globalmente
- [ ] Variáveis CSS substituídas conforme §15.2
- [ ] Sidebar background `#0C161B`, item ativo com accent amarelo
- [ ] Logo Metta no topo da sidebar (símbolo amarelo)
- [ ] Logo Metta na tela de login (completo vertical, escuro)
- [ ] Chips de funil ativos em amarelo `#FFBE18`
- [ ] Botões primários em azul noite `#0C161B`
- [ ] Cards com border-radius 12px
- [ ] Badges com border-radius 33px (pill)
- [ ] Headers de tabela uppercase com tracking +9%
- [ ] Date picker popover com accent amarelo (não azul Vercel)
- [ ] Email template do Magic Link adaptado
- [ ] Sem emojis em lugar nenhum (regra Metta + projeto)
- [ ] Fundo principal do main = branco puro `#FFFFFF`

### 15.8 Fase específica no roteiro

Adicionar à Fase 5 (Polish):
- [ ] Aplicação completa da identidade visual Metta (todos os itens do checklist §15.7)
- [ ] Customizar template de email do Supabase
- [ ] Carregar SF Pro
- [ ] Substituir CSS variables conforme §15.2

---

## 16. Performance budget e otimizações

### 16.1 Targets em produção

| Métrica | Target | Como medir |
|---|---|---|
| First Contentful Paint (FCP) | < 1.5s | Vercel Analytics (real users) |
| Largest Contentful Paint (LCP) | < 2.5s | Vercel Analytics |
| Time to Interactive (TTI) | < 3.5s | Vercel Analytics |
| Cumulative Layout Shift (CLS) | < 0.1 | Vercel Analytics |
| First Input Delay (FID) / INP | < 200ms | Vercel Analytics |
| Mudança de filtro (server roundtrip) | < 500ms | Log custom + Sentry trace |
| Primeira carga com cache quente | < 2s | Manual + Lighthouse |
| Primeira carga com cache miss (cold) | < 15s (só durante warmup) | Log do cron |
| Bundle JS inicial (página /dashboard) | < 250 KB gzip | Vercel build output |
| Bundle JS total (todas as páginas) | < 800 KB gzip | Vercel build output |
| Lighthouse Performance | ≥ 90 (desktop), ≥ 75 (mobile) | CI smoke test |

### 16.2 Estratégia de otimização

**Server Components por padrão.** Client Components só onde precisa de interatividade (filtros, popovers, gráficos com hover). Reduz JS no cliente.

**Code splitting automático do Next.js.** Cada página `app/(dashboard)/X/page.tsx` vira chunk separado. Recharts (~80 KB gzip) carrega só nas páginas que usam.

**Lazy import de gráficos:**
```typescript
const ComboBarLine = dynamic(() => import('@/components/dashboard/combo-bar-line'), {
  ssr: false, // Recharts não precisa renderizar no servidor
  loading: () => <ChartSkeleton />,
});
```

**Virtual scroll em tabelas longas:**
- Tabelas com até 30 linhas: render normal.
- Tabelas com 31+ linhas: usar `@tanstack/react-virtual` (overhead +5 KB, ganho gigante em CPU/scroll).

**Image optimization:**
- Logos SVG inline (Metta) ou `next/image` com `priority` na tela de login.
- Avatars de usuário do Google: `next/image` com `unoptimized={false}` (Vercel processa).

**Font loading:**
- SF Pro via `@font-face` com `font-display: swap`.
- Self-host (não usar Google Fonts → reduz round-trip).

**Reduzir TBT (Total Blocking Time):**
- Cálculos pesados (`lib/calc/*`) rodam no servidor (Server Components). Cliente recebe HTML pronto.
- Hidratação seletiva: Client Components só nos blocos com interação.

### 16.3 Bundle size watch

CI roda `next build` e compara bundle size com baseline. Alerta se aumentar > 10% sem justificativa. Configurar com `next-bundle-analyzer` localmente.

```bash
ANALYZE=true pnpm build
# abre relatório HTML
```

### 16.4 Caching de assets estáticos

Vercel serve com:
- `_next/static/*` → cache 1 ano (immutable hash no nome).
- Imagens otimizadas (`/_next/image`) → cache 7 dias.
- HTML estático/RSC → ISR conforme `cacheLife`.
- API Routes → no-cache por default (override quando necessário).

### 16.5 Database connection pooling

N/A no v1 — sem DB. Quando adicionar Supabase DB no v2, usar `@supabase/supabase-js` que já gerencia connection pooling via PgBouncer (Supavisor).

---

## 17. Mobile e responsivo (full responsive, desktop-first)

### 17.1 Breakpoints

Seguir Tailwind defaults:

| Nome | Width | Uso |
|---|---|---|
| Default (mobile-first) | < 640px | Mobile: layout coluna, sidebar drawer |
| `sm:` | ≥ 640px | Mobile landscape / tablet pequeno |
| `md:` | ≥ 768px | Tablet portrait |
| `lg:` | ≥ 1024px | Tablet landscape / desktop pequeno |
| `xl:` | ≥ 1280px | Desktop padrão (alvo principal) |
| `2xl:` | ≥ 1536px | Desktop grande |

### 17.2 Sidebar

| Breakpoint | Comportamento |
|---|---|
| < 1024px (mobile/tablet pequeno) | Sidebar vira **drawer off-canvas** (slide da esquerda). Trigger: ícone hambúrguer no topbar. Overlay escurece o conteúdo. Esc/clique-fora fecha. |
| ≥ 1024px (desktop) | Sidebar fixed expandida (260px) ou colapsada (56px, modo icon-only). Toggle no topbar. Estado persiste no localStorage. |

### 17.3 Topbar

| Breakpoint | Conteúdo |
|---|---|
| < 768px | Hambúrguer + título da página + avatar (compactos). Banner stale vira ícone com tooltip. |
| ≥ 768px | Hambúrguer + separador + nome da página + (espaço) + banner stale + avatar |

### 17.4 KPI cards

| Breakpoint | Layout |
|---|---|
| < 640px | Grid 1 coluna (cards empilhados) |
| 640-1024px | Grid 2 colunas |
| 1024-1280px | Grid 3 colunas |
| ≥ 1280px | Grid 5 colunas (layout do wireframe atual) |

Tamanho da fonte do valor reduz em mobile (24px → 20px → 18px).

### 17.5 Tabelas

| Breakpoint | Estratégia |
|---|---|
| < 768px | **Tabela vira lista de cards.** Cada linha vira um card com label + valor empilhados. Pra Tabela Diária (13 colunas), card mostra: Data como header, valores secundários como pares label-valor abaixo |
| 768-1280px | Tabela com scroll horizontal interno. Primeira coluna sticky (Data, Campanha, etc.) |
| ≥ 1280px | Tabela completa, sem scroll |

**Componente reutilizável:**

```tsx
<MetricTable
  columns={[...]}
  data={[...]}
  mobileLayout="card"  // ou "scroll-x"
  stickyFirstCol={true}
/>
```

### 17.6 Gráficos

- Recharts com `<ResponsiveContainer width="100%" height={...}>` adapta automaticamente.
- Heatmap em mobile: reduz horas (10h-18h em vez de 7h-20h). Tamanho de célula proporcional.
- Funil vertical: mantém formato em todas as larguras (já é flexbox).
- Combo barras+linha: labels do eixo X rotacionam 90° em < 768px ou somem (mostra só extremos).

### 17.7 Filtros

| Breakpoint | Layout |
|---|---|
| < 768px | Filtros empilhados (1 coluna). Date picker fullscreen quando aberto. Chips de funil viram select multi se virar muitos |
| ≥ 768px | Filtros em row (layout desktop atual). Date picker como popover ancorado |

### 17.8 Galeria de criativos (P7 Anúncios)

| Breakpoint | Colunas |
|---|---|
| < 640px | 2 |
| 640-1024px | 3 |
| ≥ 1024px | 4 (atual) |

### 17.9 Testar responsividade

- DevTools Chrome (3 breakpoints obrigatórios): 375px (mobile), 768px (tablet), 1440px (desktop)
- Lighthouse mobile: target ≥ 75
- Playwright tests em viewports específicos (v2)

### 17.10 Tailwind 4 — config CSS-first

Tailwind 4 mudou pra **config no CSS** (não mais `tailwind.config.js`):

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Cores Metta */
  --color-metta-yellow: #FFBE18;
  --color-metta-yellow-soft: #FFE4A1;
  --color-metta-blue-night: #0C161B;
  --color-metta-blue-gray: #435965;
  --color-metta-blue-gray-light: #688594;

  /* Família tipográfica */
  --font-sans: 'SF Pro', system-ui, -apple-system, sans-serif;

  /* Border radius Metta */
  --radius-card: 12px;
  --radius-pill: 33px;

  /* Custom breakpoints (mantém Tailwind defaults) */
}
```

Utilities geradas automaticamente: `bg-metta-yellow`, `text-metta-blue-night`, `rounded-card`, `font-sans` etc.

**Custom variants e plugins:** se precisar, declarar no CSS via `@plugin` em vez de JS config.

---

## 18. Acessibilidade básica

Dashboard interno, sem público externo. **Não é alvo WCAG full**. Cobrir o mínimo que vem de graça usando shadcn/ui (Radix UI por baixo já entrega 80%):

- Botão só-ícone com `aria-label`
- Tab order lógico (sem `tabindex>0`)
- `:focus-visible` com ring amarelo `#FFBE18`
- Esc fecha popovers/dialogs
- Tabelas usando `<table>` semântico
- `<button>` em vez de `<div onClick>`

Sem checklist formal, sem auditoria axe/NVDA. Se algum dia entrar usuário com necessidade específica, expandir.

---

## 19. Tratamento de erros (unificado)

### 19.1 Política

Erros são uma das 4 categorias:

| Categoria | Exemplo | Comportamento |
|---|---|---|
| **Transient (recuperável)** | Sheets API timeout, 5xx temporário, rate limit | Retry automático (§4.4.5). Se cache anterior existe, serve com banner stale |
| **Schema drift** | Coluna removida da planilha, header mudou | Error boundary na página + mensagem clara apontando coluna ausente. Outras páginas funcionam |
| **Auth** | Sessão expirada, token inválido, conta deletada | Redirect `/login?reason=...` com toast |
| **Fatal (não recuperável)** | Service Account sem acesso, env vars ausentes, planilha deletada | Página de erro full-screen com instruções de remediation. Log fatal no Sentry |

### 19.2 Error Boundary por página

Cada página tem seu `error.tsx`:

```tsx
// app/(dashboard)/sdr/error.tsx
'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="p-8 max-w-md mx-auto text-center">
      <h2 className="text-xl font-semibold mb-2">Erro ao carregar Comercial SDR</h2>
      <p className="text-muted mb-4">
        {error.message.includes('schema')
          ? 'Parece que a planilha mudou de estrutura. Verifique se nenhuma coluna foi removida.'
          : 'Tente recarregar a página. Se o problema persistir, contate o admin.'}
      </p>
      <button onClick={reset} className="btn-primary">Tentar novamente</button>
    </div>
  );
}
```

### 19.3 Error Boundary global

`app/global-error.tsx` cobre crashes catastróficos (ex: erro durante render do layout).

### 19.4 Fallback de dados

Quando Sheets falha mas há cache anterior:

```typescript
// lib/sheets/read.ts (pseudocódigo)
async function readSheetWithFallback(tab: Tab) {
  try {
    return await readSheet(tab); // tenta fresh
  } catch (err) {
    logError('sheets.read.fail', err, { tab });
    const stale = await getStaleCache(tab);
    if (stale) {
      logWarn('sheets.read.serving_stale', { tab, ageMs: stale.age });
      return { ...stale.data, _stale: true };
    }
    throw err; // sem fallback, propaga pro error boundary
  }
}
```

`_stale: true` propaga até o componente que mostra o banner.

### 19.5 Retry no client (botão "Tentar novamente")

Botões "Tentar novamente" disparam `router.refresh()` (Next.js) — re-renderiza Server Components, que tentam fetch novamente. Combinado com `revalidateTag`, pode forçar novo fetch.

### 19.6 Convenções de arquivos do Next.js (App Router)

Cada rota suporta arquivos especiais com semântica definida pelo Next:

| Arquivo | Quando dispara | Escopo |
|---|---|---|
| `error.tsx` | Erro em Server/Client Component da página | Captura erros dessa rota + filhos. **Obrigatoriamente Client Component** (`'use client'`) |
| `loading.tsx` | Página está rendering (entre navegação e render completo) | Suspense boundary automático. Server Component OK |
| `not-found.tsx` | `notFound()` chamado ou rota não existe | Server Component OK |
| `global-error.tsx` | Erro fatal no root layout | Substitui o `<html>` inteiro. Client Component. Único pra app inteiro |

**Aplicação no dashboard:**

```
app/(dashboard)/
├── layout.tsx          # sidebar + topbar
├── loading.tsx         # skeleton genérico (raramente disparado — páginas usam Suspense interno)
├── error.tsx           # boundary global do dashboard
├── not-found.tsx       # 404 customizado
├── page.tsx            # Visão Geral
├── sdr/
│   ├── error.tsx       # boundary específico da página SDR (mais granular)
│   └── page.tsx
├── trafego/...
```

**Por quê granular por página em vez de só global:** se Sheets falha em uma página específica, error boundary daquela página captura sem derrubar a navegação inteira. Usuário pode trocar pra outra página que talvez funcione.

`app/global-error.tsx` — fallback final pra erro catastrófico no root layout (raríssimo).

### 19.7 Suprimir erros conhecidos

Lista de mensagens/códigos que NÃO geram alerta Sentry (evita ruído):

- `NEXT_REDIRECT` — redirect interno do Next
- `NEXT_NOT_FOUND` — 404 esperado
- `AbortError` em fetch cancelado por navegação
- Erros de hydration mismatch em dev (não em prod)

---

## 20. Backup e disaster recovery

### 20.1 Cenários de falha

| Falha | Impacto | Plano |
|---|---|---|
| **Sheets API fora** | Sem dados frescos | Cache stale serve até 1h. Após isso: error boundary. Quando recuperar, cron próximo restaura |
| **Planilha deletada acidentalmente** | Sem dados pra sempre | Restaurar via histórico de versões do Sheets (Ctrl+Z funciona até 30 dias). Tutorial no README |
| **Service Account perdeu acesso** | 401/403 em todas as requests | Re-compartilhar planilha com SA. Documentado no runbook |
| **Vercel fora** | Dashboard inacessível | Esperar. Status: status.vercel.com. Sem SLA própria — usar Sheets diretamente como backup operacional |
| **Sentry fora** | Erros não capturados (logs Vercel ainda funcionam) | Aceitar — Sentry é "nice to have", não bloqueante |
| **Supabase fora** | Login não funciona; usuários logados continuam ativos até token vencer | Esperar. Aviso na tela de login se detectar erro |
| **Domínio DNS quebrado** | URL fora do ar | Vercel default `*.vercel.app` continua funcionando como fallback |
| **Repo GitHub deletado/corrompido** | Sem deploy futuro | Repo é só code; build do Vercel já gerado continua servindo. Recuperar repo de backup local |

### 20.2 Backups

| Componente | Mecanismo | Retenção |
|---|---|---|
| **Planilha Sheets** | Histórico de versões nativo do Sheets | 30 dias |
| **Código** | GitHub + clone local | Indefinido |
| **Env vars Vercel** | Snapshot manual num arquivo `.env.local.template` (sem valores reais) commitado | Indefinido |
| **Supabase users** | Exportar tabela `auth.users` via SQL editor mensalmente | Manual |
| **Sentry events** | Painel Sentry (retém 30-90 dias dependendo do plano) | Free tier: 30 dias |
| **Logs Vercel** | Painel Vercel (retém 30 dias no free tier) | 30 dias |

### 20.3 Runbook de recuperação

Manter `docs/RUNBOOK.md` no repo com:
- Como restaurar versão anterior da planilha
- Como re-deploy de versão estável anterior (Vercel UI: deployments → 3 dots → "Promote to Production")
- Como rotacionar Service Account key (passos no Google Cloud + atualizar env var no Vercel)
- Como debugar `Failed to fetch sheets data` (checklist)

---

## 21. PII e dados sensíveis (operacional, não compliance)

Dashboard interno, dados já existem na planilha. Operacionalmente:

- **Acesso:** só usuários autenticados (login Google).
- **Logs (Vercel + Sentry):** nunca logar email/telefone/nome em texto livre. Apenas `user.id` (UUID Supabase) ou contagens agregadas.
- **Sentry `beforeSend`:** mascara `event.user.email` (configurado em §10.2).
- **Service Role Key:** server-side only, nunca com prefixo `NEXT_PUBLIC_`.

Caso virar produto externo no futuro, adicionar política de privacidade pública + base legal LGPD. Pra v1 interno, este parágrafo é suficiente.

---

## 22. Plano de testes

### 22.1 Pirâmide de testes

| Camada | Cobertura | Ferramenta |
|---|---|---|
| **Unit** (lib/calc, lib/sheets/parse) | > 80% | Vitest |
| **Integration** (Server Components + Sheets mock) | crítico | Vitest + MSW (mock Sheets API) |
| **E2E** (login → navegar → filtrar) | smoke | Playwright (v2 — fora do escopo v1) |
| **Visual regression** | smoke | v2 — Percy ou Chromatic se virar problema |

### 22.2 Unit tests

Cada função de `lib/calc/*` tem teste com:
- Dataset sintético construído inline (3-5 linhas)
- Filtros variados
- Edge cases (vazio, divisão por zero, datas inválidas)
- Snapshot pro resultado esperado

```typescript
// lib/calc/visao-geral.test.ts
import { describe, it, expect } from 'vitest';
import { calcVisaoGeral } from './visao-geral';

describe('calcVisaoGeral', () => {
  it('soma investimento corretamente', () => {
    const data = { fbTodos: [/* ... */], leads: [], sdr: [], vendas: [] };
    const filters = { from: new Date('2026-05-01'), to: new Date('2026-05-31'), funis: ['sessao'] };
    const result = calcVisaoGeral(data, filters);
    expect(result.investido).toBe(1290);
  });

  it('retorna null em CPL quando Leads=0', () => {
    const data = { fbTodos: [{ amountSpent: 100, /*...*/ }], leads: [], sdr: [], vendas: [] };
    const result = calcVisaoGeral(data, /* filtro vazio */);
    expect(result.cpl).toBeNull();
  });

  // ...
});
```

### 22.3 Integration tests

Mock da Sheets API via MSW intercepta `googleapis` em testes. Testa Server Component renderizando com dados sintéticos.

```typescript
// app/(dashboard)/page.test.tsx
import { render } from '@testing-library/react';
import { setupServer } from 'msw/node';
// ...

const server = setupServer(/* handlers da Sheets API */);

it('renderiza Visão Geral com KPIs corretos', async () => {
  const page = await VisaoGeralPage({ searchParams: Promise.resolve({}) });
  // ...
});
```

### 22.4 Smoke tests (manual, antes de prod)

Após cada deploy de produção:
1. Login Google funciona
2. Todas as 7 páginas renderizam sem erro
3. Mudança de filtro reflete em todos os números
4. Banner stale não está visível (cache fresh)
5. Logout funciona

Documentar checklist em `docs/SMOKE-TESTS.md`.

### 22.5 Sanity check vs planilha (manual, antes de prod)

Pegar 3 períodos × 3 funis × 5 KPIs principais = 45 valores. Comparar dashboard vs Análise Geral da planilha. **Diff aceito: 0.**

Se houver discrepância: bug. Não promover até resolver.

### 22.6 CI/CD test pipeline

```yaml
# .github/workflows/ci.yml (Vercel auto-roda também)
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

Pull Request bloqueado se qualquer step falha.

### 22.7 Pre-commit hooks (opcional)

`lint-staged` + `husky`:
- ESLint nos arquivos modificados
- Prettier
- TypeScript check (rápido com `tsc --noEmit`)

### 22.8 Contract test do schema da planilha (detecção de drift)

Job CI semanal que valida headers reais da planilha contra schemas Zod do código:

```typescript
// scripts/check-sheets-schema.ts
import { sheets } from '@/lib/sheets/client';
import { EXPECTED_HEADERS } from '@/lib/sheets/expected-headers';

async function main() {
  for (const [tab, expected] of Object.entries(EXPECTED_HEADERS)) {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
      range: `${tab}!1:1`,
    });
    const actual = data.values?.[0] ?? [];
    const missing = expected.filter((h) => !actual.includes(h));
    const extra = actual.filter((h) => !expected.includes(h));
    if (missing.length > 0 || extra.length > 0) {
      console.error(`[${tab}] schema drift: missing=${missing.join(',')} extra=${extra.join(',')}`);
      process.exit(1);
    }
    console.log(`[${tab}] schema OK (${actual.length} columns)`);
  }
}
main();
```

**Quando rodar:**
- Cron GitHub Actions weekly (segunda 9h BRT)
- Manualmente após qualquer mudança da planilha
- Antes de deploy pra prod

Se detectar drift: abre issue automático no GitHub com diff. Time atualiza Zod schemas antes de promover.

### 22.9 Snapshot tests dos cálculos críticos

Pra cada função `calc*`, manter snapshot do resultado de um dataset sintético FIXO. Mudança no resultado = quebra de teste = revisão obrigatória.

```typescript
// lib/calc/visao-geral.test.ts
import { expect, it } from 'vitest';
import { calcVisaoGeral } from './visao-geral';
import fixtures from './__fixtures__/visao-geral-baseline.json';

it('matches baseline snapshot', () => {
  const result = calcVisaoGeral(fixtures.data, fixtures.filters);
  expect(result).toMatchSnapshot();
});
```

Atualizar snapshot intencional: `pnpm test -u`. Comitar o snapshot junto com a mudança lógica.

### 22.10 Visual regression (v2, fora do v1)

Pra v2, integrar Percy/Chromatic capturando screenshots das 7 páginas com 3 viewports (375/768/1440px) a cada PR. Detecta regressão visual automaticamente.

V1: smoke manual antes de prod.

---

## 23. Documentação técnica do repositório

### 23.1 README.md (no root do repo)

Conteúdo mínimo:

```markdown
# Dashboard Metta Paliativo

Dashboard interno de gestão comercial e tráfego pago. Lê dados do Google Sheets, calcula KPIs em runtime, serve via Next.js no Vercel.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- Recharts (gráficos), TanStack Table (tabelas)
- Supabase Auth (Google OAuth + Magic Link)
- googleapis (cliente Sheets API)
- Sentry + Vercel Analytics

## Setup local

1. Clone o repo
2. `pnpm install`
3. `cp .env.local.example .env.local` e preencha (peça as secrets pro admin)
4. `pnpm dev`

## Comandos

- `pnpm dev` — servidor de desenvolvimento
- `pnpm build` — build de produção
- `pnpm test` — testes Vitest
- `pnpm typecheck` — TypeScript check
- `pnpm lint` — ESLint

## Arquitetura

Ver PRD em `/Users/alisson/Documents/dashboard metta paliativo/PRD.md`.

## Troubleshooting

- **"GOOGLE_SHEETS_PRIVATE_KEY invalid"**: verifique se `\n` está como literal (não interpretado)
- **"Cache stale há > 1h"**: cron parou. Verifique logs em `/api/cron/refresh-sheets`
- **Schema drift**: alguém mexeu na planilha. Ver `docs/RUNBOOK.md`

## Links úteis

- Painel Vercel: <url>
- Painel Supabase: <url>
- Painel Sentry: <url>
- Planilha fonte: <link Drive>
```

### 23.2 docs/RUNBOOK.md

Procedimentos operacionais documentados:

```markdown
# Runbook

## Restaurar versão anterior da planilha
1. Abrir planilha no Sheets
2. File > Version history > See version history
3. Selecionar versão anterior, "Restore this version"
4. Forçar revalidação: `curl -X POST <URL>/api/revalidate -H "x-revalidate-secret: $SECRET"`

## Rotacionar Service Account key
1. Google Cloud Console > IAM > Service Accounts > dashboard-sheets-reader
2. Keys > Add Key > Create new key (JSON)
3. Baixar arquivo
4. Vercel > Settings > Environment Variables > editar GOOGLE_SHEETS_PRIVATE_KEY + GOOGLE_SHEETS_CLIENT_EMAIL
5. Redeploy
6. (Opcional) deletar key antiga no Google Cloud

## Adicionar usuário ao dashboard
- Atualmente: qualquer login Google funciona
- Pra restringir: editar `app/auth/callback/route.ts` com lista de emails (§8.13)

## Debug: dashboard mostrando dados errados
1. Acessar `/debug/compare` (em preview deploy)
2. Identificar qual KPI diverge
3. Buscar o cálculo em `lib/calc/<página>.ts`
4. Reproduzir com fixture sintético em teste unitário
5. Corrigir + adicionar teste de regressão

## Cron parou
1. Vercel > Crons → ver últimas execuções
2. Se falhou: ver log do erro
3. Disparar manual: `curl <URL>/api/cron/refresh-sheets -H "authorization: Bearer $CRON_SECRET"`
```

### 23.3 docs/ARCHITECTURE.md

Resumo da arquitetura — não substitui PRD, mas é mais curto pra onboarding rápido:

```markdown
# Arquitetura

## Fluxo
Sheets → readSheet (cached 10 min) → lib/calc/* (puro TS) → React Server Component → Browser

## Pastas
- `app/` — rotas
- `components/` — UI
- `lib/sheets/` — leitura + parsing
- `lib/calc/` — cálculos puros
- `lib/supabase/` — auth helpers

## Cache
Cache Components do Next 16. Cron a cada 10 min revalida tag `sheets-data`. Filtros operam em cima do cache, não disparam fetch.

## Auth
Supabase. Middleware protege `/dashboard/*`.
```

### 23.4 docs/CHANGELOG.md

Conventional changelog. Atualizar a cada PR mergeado.

```markdown
# Changelog

## [Unreleased]

## [0.1.0] - 2026-05-XX
- Setup inicial
- Visão Geral, Comercial SDR, Comercial Closer
```

### 23.5 docs/SMOKE-TESTS.md

Checklist manual pós-deploy. Ver §22.4.

### 23.6 Versionamento

Semantic versioning relaxado pra projeto interno:
- `0.1.0` → primeira versão em prod
- `0.x.0` → features novas
- `0.x.y` → bugfixes
- `1.0.0` → quando virar definitivo (ou sair do "paliativo")

Tags Git pra cada release: `git tag v0.1.0 && git push --tags`.

### 23.7 Onboarding de outro dev (no futuro)

Se outra pessoa entrar pra ajudar:

1. README com setup
2. PRD (este doc) leitura obrigatória pra entender arquitetura
3. RUNBOOK pra operações
4. Pareamento de 1h com Alisson na primeira semana
5. Primeira tarefa: bugfix pequeno pra calibrar fluxo

---

## 24. Referências

- **Wireframe HTML (fonte visual):** `/Users/alisson/Documents/dashboard metta paliativo/dashboard-wireframes.html`
- **Plano original:** `/Users/alisson/.claude/plans/u-vamos-l-eu-resilient-scroll.md`
- **Planilha fonte:** Google Sheets ID `1m_oCjgeMPfEaplFNvK0oLRwYR9yoS3AkYzWkO3uWXvY`
- **Form com valores reais (cargo/faturamento/segmento/regras de qualificação):** `/Users/alisson/Documents/Formulário/form-sessao-v3.html`
- **Memória do projeto (TODO aba Metas):** `~/.claude/projects/-Users-alisson-Documents/memory/project_dashboard_metta_metas_sheet.md`
- **Docs Next.js Cache Components:** https://nextjs.org/docs/app/building-your-application/caching
- **Docs Sheets API v4:** https://developers.google.com/sheets/api/reference/rest
- **Supabase Auth:** https://supabase.com/docs/guides/auth
- **Supabase SSR (Next.js):** https://supabase.com/docs/guides/auth/server-side/nextjs
- **Recharts:** https://recharts.org
- **shadcn/ui:** https://ui.shadcn.com
