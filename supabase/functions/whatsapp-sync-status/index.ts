import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

function mapStatus(state: string | null | undefined) {
  const s = String(state || "").toLowerCase();
  if (s === "open") return "conectado";
  if (s === "close") return "desconectado";
  return "pendente";
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  const t = new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
  return Promise.race([promise, t]);
}

async function fetchConnectionState(apiUrl: string, instance: string, apikey: string) {
  const baseUrl = String(apiUrl || "").replace(/\/+$/, "");
  const inst = encodeURIComponent(String(instance || ""));
  const url = `${baseUrl}/instance/connectionState/${inst}`;
  const res = await withTimeout(
    fetch(url, {
      method: "GET",
      headers: {
        apikey: String(apikey || ""),
        "Content-Type": "application/json",
      },
    }),
    3500
  );
  if (!res.ok) {
    throw new Error(`status ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  const state = data?.instance?.state as string | undefined;
  return { raw: data, state };
}

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const empresaId = (body?.empresa_id as string | undefined) || null;
    const force = Boolean(body?.force);
    const nowIso = new Date().toISOString();

    let sel = supabase
      .from("conexoes")
      .select("id, api_url, nome_api, apikey, status, last_status_checked_at")
      .not("api_url", "is", null)
      .not("nome_api", "is", null)
      .not("apikey", "is", null);
    if (empresaId) sel = sel.eq("empresa_id", empresaId);

    const { data, error } = await sel;
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const eligible = rows.filter((r: any) => {
      if (force) return true;
      const last = r.last_status_checked_at ? Date.parse(String(r.last_status_checked_at)) : 0;
      if (!last || Number.isNaN(last)) return true;
      return Date.now() - last > 60_000;
    });

    let ok = 0;
    let fail = 0;

    await runWithConcurrency(eligible, 3, async (r: any) => {
      try {
        const result = await fetchConnectionState(String(r.api_url || ""), String(r.nome_api || ""), String(r.apikey || ""));
        const mapped = mapStatus(result.state);
        await supabase
          .from("conexoes")
          .update({
            status: mapped,
            last_status_checked_at: nowIso,
            last_status_raw: String(result.state || ""),
            last_status_error: null,
          } as any)
          .eq("id", r.id);
        ok += 1;
      } catch (e) {
        await supabase
          .from("conexoes")
          .update({
            last_status_checked_at: nowIso,
            last_status_error: String((e as any)?.message || e || "error"),
          } as any)
          .eq("id", r.id);
        fail += 1;
      }
    });

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: rows.length,
        updated: eligible.length,
        success: ok,
        failed: fail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String((error as any)?.message || error || "unknown_error"),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
