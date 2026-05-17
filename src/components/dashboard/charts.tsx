"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/** Tokens de cor já definidos no globals.css (paleta Metta atual). */
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type SeriesDef = {
  key: string;
  label: string;
  /** Eixo: "left" (default) ou "right" (escala dupla) */
  axis?: "left" | "right";
  /** Override de cor (default = paleta por ordem) */
  color?: string;
  /** Linha tracejada (ex: meta) */
  dashed?: boolean;
};

function buildConfig(series: SeriesDef[]): ChartConfig {
  const cfg: ChartConfig = {};
  series.forEach((s, i) => {
    cfg[s.key] = { label: s.label, color: s.color ?? PALETTE[i % PALETTE.length] };
  });
  return cfg;
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col gap-4 p-5 lg:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="panel-title">{title}</h3>
        {description && <span className="panel-desc">{description}</span>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combo barra + linha (eixo Y duplo opcional)
// ---------------------------------------------------------------------------

export function ComboBarLineChart({
  title,
  description,
  data,
  xKey,
  bars,
  lines,
  height = 300,
  className,
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  bars: SeriesDef[];
  lines: SeriesDef[];
  height?: number;
  className?: string;
}) {
  const config = buildConfig([...bars, ...lines]);
  const hasRight = [...bars, ...lines].some((s) => s.axis === "right");

  return (
    <ChartCard title={title} description={description} className={className}>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={44} />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={44}
            />
          )}
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              yAxisId={b.axis ?? "left"}
              fill={`var(--color-${b.key})`}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
          ))}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              yAxisId={l.axis ?? "left"}
              stroke={`var(--color-${l.key})`}
              strokeWidth={2}
              strokeDasharray={l.dashed ? "5 4" : undefined}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Multi-linha (eixo Y duplo opcional)
// ---------------------------------------------------------------------------

export function MultiLineChart({
  title,
  description,
  data,
  xKey,
  lines,
  height = 280,
  className,
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  lines: SeriesDef[];
  height?: number;
  className?: string;
}) {
  const config = buildConfig(lines);
  const hasRight = lines.some((s) => s.axis === "right");

  return (
    <ChartCard title={title} description={description} className={className}>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={48} />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={48}
            />
          )}
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              yAxisId={l.axis ?? "left"}
              stroke={`var(--color-${l.key})`}
              strokeWidth={2}
              strokeDasharray={l.dashed ? "5 4" : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Área + linha (ex: evolução receita + meta tracejada)
// ---------------------------------------------------------------------------

export function AreaLineChart({
  title,
  description,
  data,
  xKey,
  area,
  lines,
  height = 280,
  className,
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  area: SeriesDef;
  lines: SeriesDef[];
  height?: number;
  className?: string;
}) {
  const config = buildConfig([area, ...lines]);

  return (
    <ChartCard title={title} description={description} className={className}>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis tickLine={false} axisLine={false} width={56} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            type="monotone"
            dataKey={area.key}
            stroke={`var(--color-${area.key})`}
            fill={`var(--color-${area.key})`}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={`var(--color-${l.key})`}
              strokeWidth={2}
              strokeDasharray={l.dashed ? "5 4" : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Donut (com valor central opcional)
// ---------------------------------------------------------------------------

export function DonutChart({
  title,
  description,
  data,
  centerLabel,
  centerValue,
  height = 280,
  className,
}: {
  title: string;
  description?: string;
  /** [{ name, value }] */
  data: { name: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  className?: string;
}) {
  const config: ChartConfig = {};
  data.forEach((d, i) => {
    config[d.name] = { label: d.name, color: PALETTE[i % PALETTE.length] };
  });
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <ChartCard title={title} description={description} className={className}>
      {/* Wrapper de altura fixa: o gráfico preenche por absoluto e o
          valor central fica sobreposto e centrado — sem margem negativa
          (que estourava o card e invadia a seção de baixo no mobile). */}
      <div className="relative w-full" style={{ height }}>
        <ChartContainer
          config={config}
          className="absolute inset-0 aspect-auto h-full w-full"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="name"
                  formatter={(value, name, item) => {
                    const v = Number(value);
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    const fill =
                      (item?.payload?.fill as string | undefined) ?? undefined;
                    return (
                      <div className="flex w-full items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ background: fill }}
                        />
                        <span className="flex-1 text-muted-foreground">
                          {name}
                        </span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {v.toLocaleString("pt-BR")} · {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-xs text-muted-foreground">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      {/* Legenda própria em fluxo normal — não disputa espaço com o
          overlay e quebra linha no mobile sem vazar. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-xs text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Barras agrupadas (2+ barras por categoria)
// ---------------------------------------------------------------------------

export function GroupedBarChart({
  title,
  description,
  data,
  xKey,
  bars,
  height = 280,
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  bars: SeriesDef[];
  height?: number;
}) {
  const config = buildConfig(bars);
  const hasRight = bars.some((s) => s.axis === "right");

  return (
    <ChartCard title={title} description={description}>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={44} />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={48}
            />
          )}
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              yAxisId={b.axis ?? "left"}
              fill={`var(--color-${b.key})`}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
          ))}
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Projeção do mês — realizado (sólido até hoje) + projeção (tracejada)
// + meta (linha horizontal) + marcador vertical "hoje"
// ---------------------------------------------------------------------------

export function ProjectionChart({
  title,
  description,
  data,
  xKey,
  realKey,
  projKey,
  metaValue,
  metaLabel,
  hojeLabel,
  height = 280,
  className,
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  realKey: string;
  projKey: string;
  metaValue?: number | null;
  metaLabel?: string;
  /** Valor de xKey onde fica o marcador "hoje". */
  hojeLabel?: string;
  height?: number;
  className?: string;
}) {
  const config: ChartConfig = {
    [realKey]: { label: "Realizado", color: "var(--chart-1)" },
    [projKey]: { label: "Projeção", color: "var(--chart-2)" },
  };

  return (
    <ChartCard title={title} description={description} className={className}>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis tickLine={false} axisLine={false} width={56} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {metaValue != null && (
            <ReferenceLine
              y={metaValue}
              stroke="var(--primary)"
              strokeDasharray="6 4"
              strokeWidth={2}
              label={{
                value: metaLabel ?? "meta",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
          )}
          {hojeLabel && (
            <ReferenceLine
              x={hojeLabel}
              stroke="var(--border)"
              strokeDasharray="2 3"
              label={{
                value: "hoje",
                position: "top",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey={realKey}
            stroke={`var(--color-${realKey})`}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey={projKey}
            stroke={`var(--color-${projKey})`}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}
