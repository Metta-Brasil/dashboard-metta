import { createLucideIcon } from "lucide-react";

// O lucide-react v1 removeu os ícones de marca. Recriamos o do
// Instagram pelo mesmo iconNode da versão anterior, então ele é um
// LucideIcon "de verdade" (mesma assinatura/props das demais navs).
export const InstagramIcon = createLucideIcon("Instagram", [
  ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5" }],
  [
    "path",
    { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" },
  ],
  ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5" }],
]);
