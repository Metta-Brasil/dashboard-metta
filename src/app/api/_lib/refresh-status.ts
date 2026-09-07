/** Resultado por aba de um `refreshAllSheets`. */
export type PersistedMap = Record<
  string,
  { rows: number; ok: boolean; skipped?: boolean }
>;

export type RefreshProblems = {
  /** Abas cuja escrita foi ABORTADA pela trava anti-clobber. */
  skipped: string[];
  /** Abas cuja escrita no Upstash falhou. */
  failed: string[];
};

/**
 * Abas que ficaram com cache velho depois de um refresh.
 *
 * `skipped` é o caso perigoso: a trava anti-clobber recusa sobrescrever um
 * cache saudável com um fetch bem menor (defesa contra resposta truncada).
 * A trava está certa, mas até 07/09/2026 o resultado dela morria num
 * `console.warn` — o refresh respondia 200, o cron ficava verde e o
 * dashboard servia dado velho sem sinal nenhum. Quem chama tem que saber.
 *
 * Encolhimento legítimo (ex: uma aba perder um dump histórico de propósito)
 * também cai aqui: nesse caso a resolução é apagar a chave `raw:<aba>` do
 * Upstash, o que faz a varredura seguinte repovoar sem comparação.
 */
export function refreshProblems(persisted: PersistedMap): RefreshProblems {
  const skipped: string[] = [];
  const failed: string[] = [];
  for (const [tab, r] of Object.entries(persisted)) {
    if (r.skipped) skipped.push(tab);
    else if (!r.ok) failed.push(tab);
  }
  return { skipped, failed };
}

export function hasProblems(p: RefreshProblems): boolean {
  return p.skipped.length > 0 || p.failed.length > 0;
}
