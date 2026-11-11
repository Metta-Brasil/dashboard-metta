import { getLastRefreshTs } from "@/lib/sheets/read";

import { AtualizarBotao } from "./atualizar-botao";

/**
 * Carimbo "Atualizado HH:MM" do cabeçalho + botão de atualizar. A hora é a
 * da última vez em que o dashboard LEU as planilhas (não a da extração):
 * quem clica em atualizar precisa ver que atualizou.
 *
 * Lê o Upstash, então fica no seu próprio <Suspense> no cabeçalho: o
 * resto da barra aparece na hora.
 */
export async function Atualizado() {
  const ts = await getLastRefreshTs();
  return <AtualizarBotao ts={ts} />;
}

/** Mesmo tamanho do carimbo, para o cabeçalho não pular quando ele chega. */
export function AtualizadoFallback() {
  return <span aria-hidden className="inline-block h-7 w-[132px]" />;
}
