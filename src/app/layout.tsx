import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Metta",
  description: "Dashboard interno - tráfego pago + funil high-ticket",
  // Instalado na tela de início, o nome curto é o que aparece sob o
  // ícone. Sem isso o iOS sugere o <title> da página em que a pessoa
  // estava ao instalar (ex.: "Entrar · Dashboard Metta").
  appleWebApp: {
    capable: true,
    title: "Metta",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // `cover` deixa o app usar a tela toda no iPhone; o recorte do notch e
  // da barra inferior é devolvido via env(safe-area-inset-*) no CSS.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // Barra de status acompanha o fundo do dashboard em cada tema.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#131f26" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
