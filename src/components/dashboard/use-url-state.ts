"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useOptimistic, useTransition } from "react";

/**
 * Leitura e escrita dos filtros na URL, para todos os controles da barra.
 *
 * Dois problemas que cada controle tinha ao montar a URL sozinho, a partir
 * do `useSearchParams()` do próprio render:
 *
 *  1. Entre o clique e a resposta do servidor passam centenas de ms. Um
 *     segundo filtro clicado nesse intervalo montava a URL a partir da
 *     cópia antiga e apagava o primeiro. Aqui a escrita parte SEMPRE da
 *     última URL pedida (`emVoo`) ou, sem navegação pendente, da URL real
 *     do navegador no momento do clique.
 *  2. O controle só mostrava a seleção nova depois de o servidor
 *     recalcular a página. Aqui o valor é otimista: muda no clique e a
 *     navegação corre em transição, sem a tela piscar.
 */

/** Última query pedida e ainda não confirmada pelo roteador (por pathname). */
let emVoo: { pathname: string; search: string } | null = null;

export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const committed = sp?.toString() ?? "";
  const [optimistic, setOptimistic] = useOptimistic(committed);
  const [pending, startTransition] = useTransition();

  // A navegação pedida chegou (ou a página mudou): não há mais nada em voo.
  useEffect(() => {
    if (emVoo && (emVoo.pathname !== pathname || emVoo.search === committed)) {
      emVoo = null;
    }
  }, [pathname, committed]);

  const params = useMemo(() => new URLSearchParams(optimistic), [optimistic]);

  /** Aplica `mutate` sobre a query atual e navega (replace, sem rolar). */
  const setParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const aqui = window.location.pathname;
      const base = new URLSearchParams(
        emVoo && emVoo.pathname === aqui ? emVoo.search : window.location.search
      );
      const antes = base.toString();
      mutate(base);
      const search = base.toString();
      if (search === antes) return;
      emVoo = { pathname: aqui, search };
      startTransition(() => {
        setOptimistic(search);
        router.replace(`?${search}`, { scroll: false });
      });
    },
    [router, setOptimistic]
  );

  return { params, setParams, pending };
}
