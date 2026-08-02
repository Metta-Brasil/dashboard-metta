/**
 * Service worker mínimo — existe por um motivo só: o Chrome no Android
 * exige um SW com handler de `fetch` para considerar o app instalável e
 * disparar o `beforeinstallprompt` (o botão "Instalar" do banner). Sem
 * ele, no Android só aparece "Adicionar à tela de início" como atalho
 * comum, sem virar app de verdade.
 *
 * PASSTHROUGH DELIBERADO: não há cache de nada. Este dashboard mostra
 * número financeiro ao vivo (investimento, vendas, faturamento) — servir
 * resposta cacheada seria mostrar dado velho com cara de atual, que é
 * pior do que não abrir. O handler existe, registra o evento e deixa a
 * rede responder normalmente.
 *
 * Consequência assumida: o app NÃO funciona offline. É o certo aqui.
 */

self.addEventListener("install", () => {
  // Assume o controle sem esperar as abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Sem respondWith(): a requisição segue para a rede como sempre.
});
