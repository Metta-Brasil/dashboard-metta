import Link from "next/link";

import { cn } from "@/lib/utils";

export type Kpi = {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
  /**
   * Destino do clique no card (ex.: a lista dos leads por trás do número).
   * Com ele o card inteiro vira link; `active` marca o card cuja lista
   * está aberta.
   */
  href?: string;
  active?: boolean;
  /**
   * Série do indicador ao longo do período (um ponto por dia). Só os cards
   * principais desenham: é a tendência por trás do número, sem eixo.
   */
  trend?: number[];
};

type KpiGridProps = {
  kpis: Kpi[];
  /** Tailwind cols spec — default 5 cols. Com `principais`, vale para os de apoio. */
  cols?: string;
  className?: string;
  /**
   * Quantos indicadores, do início da lista, são os PRINCIPAIS: ficam numa
   * primeira linha de cards maiores (com a tendência, quando há série); os
   * demais viram apoio, menores. Sem a prop, todos os cards são iguais.
   * Seis cards idênticos não dizem o que olhar primeiro.
   */
  principais?: number;
};

type Nivel = "principal" | "apoio" | "unico";

const DELTA_STYLE: Record<"up" | "down" | "neutral", string> = {
  up: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  down: "bg-rose-50 text-rose-700 ring-rose-600/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const DELTA_ARROW: Record<"up" | "down" | "neutral", string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

/** Classes por nível. O skeleton usa as MESMAS, para a troca não deslocar nada. */
const CARD: Record<Nivel, string> = {
  principal: "gap-2 p-4 sm:gap-2.5 lg:p-5",
  apoio: "gap-1.5 p-3 sm:gap-2 sm:p-4",
  unico: "gap-1.5 p-3 sm:gap-3 sm:p-5",
};
const VALOR: Record<Nivel, string> = {
  principal: "text-2xl sm:text-[2rem]",
  apoio: "text-lg sm:text-[1.375rem]",
  unico: "text-lg sm:text-[28px]",
};
/** Altura da linha do número, para o skeleton reservar o mesmo espaço. */
const VALOR_ALTURA: Record<Nivel, string> = {
  principal: "h-6 sm:h-8",
  apoio: "h-[18px] sm:h-[22px]",
  unico: "h-[18px] sm:h-7",
};
const SPARK_ALTURA = "h-9";

const GRID_PRINCIPAL: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
};
const gridPrincipal = (n: number) =>
  GRID_PRINCIPAL[Math.min(Math.max(n, 1), 5)];

const COLS_PADRAO = "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

/**
 * Tendência dentro do card: área com gradiente e o último ponto marcado.
 * SVG puro, renderizado no servidor (sem biblioteca de gráfico nem JS no
 * cliente). O domínio tem folga de 8% nas pontas, senão o último ponto é
 * cortado na borda.
 */
function Sparkline({ data }: { data: number[] }) {
  const pontos = data.filter((v) => Number.isFinite(v));
  if (pontos.length < 2 || pontos.every((v) => v === 0)) {
    // Sem série desenhável: reserva a altura para os cards da linha fecharem iguais.
    return <div aria-hidden className={SPARK_ALTURA} />;
  }
  const min = Math.min(...pontos);
  const max = Math.max(...pontos);
  const folga = (max - min || 1) * 0.08;
  const lo = min - folga;
  const hi = max + folga;
  const x = (i: number) => (i / (pontos.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const linha = pontos
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`,
    )
    .join(" ");
  const ultimo = pontos[pontos.length - 1];
  return (
    <div aria-hidden className={cn("relative w-full", SPARK_ALTURA)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id="kpi-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linha} L100,100 L0,100 Z`} fill="url(#kpi-spark)" />
        <path
          d={linha}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {/* Último ponto: fora do SVG, que estica na horizontal e achataria o círculo. */}
      <span
        className="absolute size-[5px] -translate-x-full -translate-y-1/2 rounded-full bg-[var(--chart-1)]"
        style={{ left: "100%", top: `${y(ultimo)}%` }}
      />
    </div>
  );
}

function Card({ k, nivel }: { k: Kpi; nivel: Nivel }) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
          {k.label}
        </span>
        {k.delta && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ring-1 ring-inset sm:px-2 sm:text-[11px]",
              DELTA_STYLE[k.delta.direction],
            )}
          >
            <span aria-hidden>{DELTA_ARROW[k.delta.direction]}</span>
            {k.delta.value}
          </span>
        )}
      </div>
      <span
        className={cn(
          "font-semibold leading-none tracking-tight tabular-nums text-foreground",
          VALOR[nivel],
        )}
      >
        {k.value}
      </span>
      {k.hint && (
        <span
          className={cn(
            "text-muted-foreground",
            nivel === "apoio"
              ? "text-[10px] sm:text-[11.5px]"
              : "text-[10px] sm:text-xs",
          )}
        >
          {k.hint}
        </span>
      )}
      {nivel === "principal" && k.trend && (
        <div className="mt-auto pt-1">
          <Sparkline data={k.trend} />
        </div>
      )}
    </>
  );
  const classe = cn(
    "surface-card surface-card-interactive flex flex-col",
    CARD[nivel],
    k.active && "border-foreground",
  );
  return k.href ? (
    <Link
      href={k.href}
      scroll={false}
      aria-current={k.active ? "true" : undefined}
      title="Ver os leads deste número"
      className={cn(
        classe,
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

export function KpiGrid({
  kpis,
  cols = COLS_PADRAO,
  className,
  principais,
}: KpiGridProps) {
  if (!principais || principais <= 0) {
    return (
      <div className={cn("grid gap-2 sm:gap-3", cols, className)}>
        {kpis.map((k) => (
          <Card key={k.label} k={k} nivel="unico" />
        ))}
      </div>
    );
  }
  const topo = kpis.slice(0, principais);
  const apoio = kpis.slice(principais);
  return (
    <div className={cn("flex flex-col gap-2 sm:gap-3", className)}>
      {/* Grade vazia tem altura 0 mas consome o vão: só entra se há card. */}
      {topo.length > 0 && (
        <div className={cn("grid gap-2 sm:gap-3", gridPrincipal(topo.length))}>
          {topo.map((k) => (
            <Card key={k.label} k={k} nivel="principal" />
          ))}
        </div>
      )}
      {apoio.length > 0 && (
        <div className={cn("grid gap-2 sm:gap-3", cols)}>
          {apoio.map((k) => (
            <Card key={k.label} k={k} nivel="apoio" />
          ))}
        </div>
      )}
    </div>
  );
}

type KpiGridSkeletonProps = {
  /** Quantos cards a grade final tem. */
  count: number;
  cols?: string;
  className?: string;
  principais?: number;
  /** Os cards principais têm tendência (reserva a altura do mini-gráfico). */
  trend?: boolean;
  /**
   * Altura MEDIDA do bloco real, em px: `[desktop (lg+, a 1440px), celular
   * (a 390px)]`. Rótulo e legenda quebram linha conforme o texto, então a
   * altura do card real não sai das classes: mede-se a página pronta e o
   * skeleton ocupa o mesmo espaço. Mudou a página, meça de novo.
   */
  altura?: readonly [number, number];
};

// `shrink-0`: como filho direto da coluna flexível da página, o bloco era
// encolhido até o conteúdo mínimo e a altura medida não valia.
const ALTURA = "h-(--sk-hm) shrink-0 lg:h-(--sk-h)";
const alturaVars = (h: readonly [number, number]) =>
  ({ "--sk-h": `${h[0]}px`, "--sk-hm": `${h[1]}px` }) as React.CSSProperties;

function CardSkeleton({ nivel, trend }: { nivel: Nivel; trend?: boolean }) {
  return (
    <div className={cn("surface-card flex flex-col", CARD[nivel])}>
      <div className="h-[13px] w-20 max-w-full animate-pulse rounded bg-muted sm:h-[17px]" />
      <div
        className={cn(
          "w-24 max-w-full animate-pulse rounded bg-muted",
          VALOR_ALTURA[nivel],
        )}
      />
      <div className="h-[15px] w-28 max-w-full animate-pulse rounded bg-muted/60 sm:h-4" />
      {nivel === "principal" && trend && (
        <div className="mt-auto pt-1">
          <div
            className={cn("animate-pulse rounded bg-muted/40", SPARK_ALTURA)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Carregamento da grade de indicadores: as mesmas grades, os mesmos vãos e
 * o mesmo padding do `KpiGrid`, para a troca skeleton → conteúdo não
 * deslocar o resto da página.
 */
export function KpiGridSkeleton({
  count,
  cols = COLS_PADRAO,
  className,
  principais,
  trend,
  altura,
}: KpiGridSkeletonProps) {
  const lista = (n: number, nivel: Nivel) =>
    Array.from({ length: n }, (_, i) => (
      <CardSkeleton key={i} nivel={nivel} trend={trend} />
    ));
  // Com altura medida, as linhas dividem o espaço e os cards esticam nelas.
  const grade = cn(
    "grid gap-2 sm:gap-3",
    altura && "min-h-0 flex-1 auto-rows-fr",
  );
  const style = altura ? alturaVars(altura) : undefined;
  if (!principais || principais <= 0) {
    return (
      <div
        aria-hidden
        style={style}
        className={cn(
          "grid gap-2 sm:gap-3",
          altura && cn(ALTURA, "auto-rows-fr"),
          cols,
          className,
        )}
      >
        {lista(count, "unico")}
      </div>
    );
  }
  const topo = Math.min(principais, count);
  const apoio = count - topo;
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "flex flex-col gap-2 sm:gap-3",
        altura && ALTURA,
        className,
      )}
    >
      {topo > 0 && (
        <div className={cn(grade, gridPrincipal(topo))}>
          {lista(topo, "principal")}
        </div>
      )}
      {apoio > 0 && (
        <div className={cn(grade, cols)}>{lista(apoio, "apoio")}</div>
      )}
    </div>
  );
}
