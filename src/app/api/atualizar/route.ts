import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { rateLimit } from "@/lib/auth/ratelimit";
import { refreshAllSheets } from "@/lib/sheets/read";

export const maxDuration = 120;

/**
 * Botão "Atualizar" do cabeçalho: relê as planilhas e regrava o cache que
 * as páginas usam. Exige sessão do dashboard (cookie) e só aceita chamada
 * da própria origem. O cache já é renovado de hora em hora e depois de
 * cada extração; isto é para quem acabou de ver um dado mudar na origem e
 * não quer esperar.
 *
 * Fica em rota (e não em server action importada pelo botão) para o
 * componente do cabeçalho não arrastar a autenticação para dentro do
 * bundle do MCP, que importa os mesmos componentes para serializá-los.
 *
 * Limite por pessoa: reler todas as abas custa dezenas de chamadas à API
 * do Google Sheets, e várias pessoas clicando juntas estourariam a cota.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ ok: false, error: "Origem não permitida." }, { status: 403 });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Sessão expirada. Entre de novo." },
      { status: 401 }
    );
  }

  const verdict = await rateLimit("refresh", {
    limit: 3,
    windowSeconds: 10 * 60,
    dimension: email.toLowerCase(),
  });
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas atualizações seguidas. Tente de novo em alguns minutos." },
      { status: 429 }
    );
  }

  try {
    await refreshAllSheets();
    return NextResponse.json({ ok: true, at: Date.now() });
  } catch (err) {
    // Detalhe só no log: o erro da API do Google carrega id de planilha.
    console.error("[atualizar] refresh falhou", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível atualizar agora." },
      { status: 500 }
    );
  }
}
