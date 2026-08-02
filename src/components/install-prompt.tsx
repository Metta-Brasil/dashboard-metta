"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Faixa que ensina a instalar o dashboard na tela de início.
 *
 * Existe porque o iOS NÃO deixa um site disparar a instalação: não há
 * `beforeinstallprompt` no Safari, então "Compartilhar → Adicionar à Tela
 * de Início" é o único caminho e precisa ser feito à mão. O que dá pra
 * fazer é remover o "como faz?" — daí a instrução aparecer dentro do
 * próprio app, no aparelho certo, na hora certa.
 *
 * No Android o Chrome expõe o prompt nativo; ali a faixa vira um botão
 * que instala de verdade em um toque.
 *
 * Só aparece quando faz sentido: em telefone, fora do modo standalone
 * (ou seja, ainda não instalado) e enquanto a pessoa não dispensar. A
 * dispensa fica em localStorage — não volta a incomodar.
 */

const DISMISS_KEY = "metta:install-prompt-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Já instalado (aberto pela tela de início) → nunca mostrar.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    // iPad moderno se identifica como Mac; o toque é o que denuncia.
    const iPadOs =
      /Macintosh/.test(ua) && typeof document !== "undefined" &&
      "ontouchend" in document;
    const android = /Android/.test(ua);

    if (ios || iPadOs) {
      setIsIos(true);
      setShow(true);
      return;
    }

    if (android) {
      const onPrompt = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BeforeInstallPromptEvent);
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", onPrompt);
      return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setShow(false);
  };

  return (
    <div
      className={cn(
        "fixed inset-x-3 z-50 rounded-xl border border-border bg-card p-3 shadow-lg",
        "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]"
      )}
      role="complementary"
      aria-label="Instalar o dashboard"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-lg bg-[var(--primary)] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--primary-foreground)]">
          APP
        </span>
        <div className="flex-1 text-xs leading-relaxed text-foreground">
          {isIos ? (
            <>
              Instale o dashboard no seu iPhone: toque em{" "}
              <span aria-hidden>􀈂</span> <strong>Compartilhar</strong> e depois
              em <strong>Adicionar à Tela de Início</strong>.
            </>
          ) : (
            <>Instale o dashboard como aplicativo no seu aparelho.</>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isIos && deferred && (
            <button
              type="button"
              onClick={install}
              className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background"
            >
              Instalar
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dispensar"
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
