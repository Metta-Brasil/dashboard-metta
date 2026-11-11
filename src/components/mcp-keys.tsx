"use client";

import { useActionState, useState } from "react";

import {
  mcpKeysAction,
  type McpKeysState,
} from "@/app/(dashboard)/configuracoes/mcp-actions";
import type { McpKeyInfo } from "@/lib/mcp/keys";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

function formatWhen(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

export function McpKeys({
  initialKeys,
  mcpUrl,
}: {
  initialKeys: McpKeyInfo[];
  mcpUrl: string;
}) {
  const [state, formAction, pending] = useActionState<McpKeysState, FormData>(
    mcpKeysAction,
    { keys: initialKeys }
  );
  const [copied, setCopied] = useState(false);

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: a chave segue visível
      // para copiar à mão.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex max-w-md flex-col gap-2">
        <input type="hidden" name="intent" value="create" />
        <label htmlFor="mcp-key-name" className="text-xs font-medium text-foreground">
          Nova chave
        </label>
        <div className="flex gap-2">
          <input
            id="mcp-key-name"
            name="name"
            required
            maxLength={60}
            placeholder="Para que serve (ex.: Claude da Lari)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pending}
            className="h-9 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Aguarde…" : "Criar chave"}
          </button>
        </div>
      </form>

      {state.created && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium text-foreground">
            Chave “{state.created.name}” criada. Copie agora: ela não será
            mostrada de novo.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground">
              {state.created.key}
            </code>
            <button
              type="button"
              onClick={() => copyKey(state.created!.key)}
              className="h-8 shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao conectar o cliente de IA em {mcpUrl}, o navegador abre uma
            página pedindo esta chave.
          </p>
        </div>
      )}

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {state.notice}
        </p>
      )}

      {state.keys.length === 0 ? (
        <p className="panel-desc">Nenhuma chave ativa.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Criada por</th>
                <th className="px-3 py-2 font-medium">Criada em</th>
                <th className="px-3 py-2 font-medium">Último uso</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {state.keys.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{k.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{k.createdBy}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatWhen(k.createdAt)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatWhen(k.lastUsedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={formAction}>
                      <input type="hidden" name="intent" value="revoke" />
                      <input type="hidden" name="id" value={k.id} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="h-8 rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                      >
                        Revogar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
