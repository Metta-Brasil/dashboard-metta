import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * `useSyncExternalStore`, e não estado + efeito: a barra lateral hidrata
 * dentro de um <Suspense> (espera a sessão), depois que o resto da página
 * já montou. Com estado, nesse momento o valor já era "celular" e o React
 * comparava a variante de celular com o HTML de desktop que o servidor
 * mandou: erro de hidratação em toda página aberta no celular. Aqui, quem
 * hidrata tarde usa o snapshot do servidor (false) e só depois troca.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false
  )
}
