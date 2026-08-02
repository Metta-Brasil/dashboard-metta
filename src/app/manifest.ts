import type { MetadataRoute } from "next";

/**
 * Manifest do PWA — é o que transforma "atalho no Safari" em app de
 * verdade na tela de início (ícone da marca, nome curto, tela cheia sem
 * barra de navegação).
 *
 * `start_url: "/"` de propósito: sem isso o atalho guarda a URL em que a
 * pessoa estava quando instalou — normalmente `/login` — e o app abre
 * sempre na tela de entrada mesmo com sessão válida.
 *
 * Os ícones vivem em `public/` (192/512/maskable). O `apple-icon.png` e o
 * `icon.png` seguem a convenção de arquivo do App Router e são
 * referenciados automaticamente pelo Next; o iOS usa o apple-icon e
 * ignora o resto. Todos têm fundo sólido: o iOS não preenche
 * transparência e o ícone sairia com fundo preto na tela de início.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashboard Metta",
    short_name: "Metta",
    description: "Tráfego pago, funil comercial e metas — Metta Brasil",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Sem trava de orientação de propósito: as tabelas são largas e girar
    // o aparelho é o que torna Ranking de mídia, Performance por SDR e a
    // tabela diária legíveis no celular. `portrait` bloqueava isso no
    // Android (o iOS ignora este campo).
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#0c161b",
    theme_color: "#eef2f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
