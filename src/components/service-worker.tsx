"use client";

import { useEffect } from "react";

/**
 * Registra o service worker. Fica no layout raiz (e não só no dashboard)
 * porque o Chrome avalia a instalabilidade na página em que a pessoa
 * está — inclusive no /login, que costuma ser a primeira que ela abre ao
 * receber o link.
 *
 * O SW é passthrough, sem cache (ver public/sw.js). Falha no registro é
 * silenciosa de propósito: sem SW o app continua funcionando igual, só
 * perde o prompt nativo de instalação no Android.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    // Depois do load: registrar durante a hidratação disputa banda com o
    // primeiro render das páginas, que já puxam bastante dado.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
