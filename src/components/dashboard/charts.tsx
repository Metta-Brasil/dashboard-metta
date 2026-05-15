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
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs",
        className
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
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
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  bars: SeriesDef[];
  lines: SeriesDef[];
  height?: number;
}) {
  const config = buildConfig([...bars, ...lines]);
  const hasRight = [...bars, ...lines].some((s) => s.axis === "right");

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
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  lines: SeriesDef[];
  height?: number;
}) {
  const config = buildConfig(lines);
  const hasRight = lines.some((s) => s.axis === "right");

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
}: {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  area: SeriesDef;
  lines: SeriesDef[];
  height?: number;
}) {
  const config = buildConfig([area, ...lines]);

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
}: {
  title: string;
  description?: string;
  /** [{ name, value }] */
  data: { name: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
}) {
  const config: ChartConfig = {};
  data.forEach((d, i) => {
    config[d.name] = { label: d.name, color: PALETTE[i % PALETTE.length] };
  });

  return (
    <ChartCard title={title} description={description}>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      {(centerValue || centerLabel) && (
        <div className="-mt-[calc(50%)] flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
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
