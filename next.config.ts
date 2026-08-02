import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP montada por diretiva para facilitar auditoria.
// script-src precisa de 'unsafe-inline' porque o Next injeta scripts inline
// (bootstrap de hidratacao e payload do flight). Migrar para nonce exigiria
// reescrever o middleware; fica como endurecimento futuro.
// style-src precisa de 'unsafe-inline' por causa do <style> injetado em
// src/components/ui/chart.tsx via dangerouslySetInnerHTML.
// img-src aceita https: generico porque as thumbnails de anuncio vem de CDN
// externa (Facebook/Instagram) com host variavel vindo da planilha, e os
// avatares sao data: URIs em base64.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Redundante com frame-ancestors, mantido para navegadores antigos.
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Evita vazar e-mail/token de querystring (?verify=, ?ec=, ?error=) no
  // Referer dos links externos.
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
