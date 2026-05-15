import { cn } from "@/lib/utils";
import type { SDRHeatmapCell } from "@/lib/calc/types";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

type SDRHeatmapProps = {
  cells: SDRHeatmapCell[];
  /** Faixa de horas mostrada — default 7h-20h (operação Metta) */
  hourFrom?: number;
  hourTo?: number;
};

export function SDRHeatmap({
  cells,
  hourFrom = 7,
  hourTo = 20,
}: SDRHeatmapProps) {
  // Indexa por (dia, hora)
  const map = new Map<string, number>();
  let max = 0;
  for (const c of cells) {
    const key = `${c.diaSemana}|${c.hora}`;
    map.set(key, c.total);
    if (c.total > max) max = c.total;
  }

  const hours: number[] = [];
  for (let h = hourFrom; h <= hourTo; h++) hours.push(h);

  function colorFor(v: number): string {
    if (max <= 0 || v === 0) return "bg-muted";
    const pct = v / max;
    if (pct >= 0.8) return "bg-primary";
    if (pct >= 0.6) return "bg-primary/75";
    if (pct >= 0.4) return "bg-primary/50";
    if (pct >= 0.2) return "bg-primary/30";
    return "bg-primary/15";
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Heatmap de reuniões
        </h3>
        <span className="text-xs text-muted-foreground">
          {hourFrom}h às {hourTo}h · BRT
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr>
              <th className="w-10" />
              {hours.map((h) => (
                <th
                  key={h}
                  className="px-1 py-1 text-center font-normal text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((label, di) => (
              <tr key={label}>
                <td className="pr-2 text-right text-muted-foreground">
                  {label}
                </td>
                {hours.map((h) => {
                  const v = map.get(`${di}|${h}`) ?? 0;
                  return (
                    <td key={h} className="p-0.5">
                      <div
                        className={cn(
                          "flex h-7 w-full items-center justify-center rounded text-foreground",
                          colorFor(v),
                          v === 0 && "text-muted-foreground"
                        )}
                        title={`${label} ${h}h: ${v}`}
                      >
                        {v > 0 ? v : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
