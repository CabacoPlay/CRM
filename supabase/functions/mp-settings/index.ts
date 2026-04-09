import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DenoEnv = { get?: (key: string) => string | undefined };
type DenoLike = { env?: DenoEnv };
const DenoRef = (globalThis as unknown as { Deno?: DenoLike }).Deno;
const supabaseUrl = DenoRef?.env?.get?.("SUPABASE_URL") ?? "";
const supabaseKey = DenoRef?.env?.get?.("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

function maskValue(value: unknown, keepStart: number, keepEnd: number) {
  const s = String(value || "");
  if (!s) return null;
  if (s.length <= keepStart + keepEnd) return "••••••••";
  return `${s.slice(0, keepStart)}…${s.slice(-keepEnd)}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body["action"] || "");

    if (action === "get") {
      const { data } = await supabase
        .from("mp_settings")
        .select("id,env,access_token,webhook_secret,updated_at")
        .eq("id", "default")
        .maybeSingle();
      const row = (data as Record<string, unknown> | null) ?? null;
      if (!row) {
        return new Response(JSON.stringify({ ok: true, settings: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const settings = {
        id: String(row["id"] || "default"),
        env: row["env"] == null ? null : String(row["env"]),
        has_access_token: Boolean(row["access_token"]),
        has_webhook_secret: Boolean(row["webhook_secret"]),
        access_token_preview: maskValue(row["access_token"], 10, 4),
        webhook_secret_preview: row["webhook_secret"] ? "••••••••" : null,
        updated_at: row["updated_at"] == null ? null : String(row["updated_at"]),
      };
      return new Response(JSON.stringify({ ok: true, settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set") {
      const { data: current } = await supabase.from("mp_settings").select("*").eq("id", "default").maybeSingle();
      const cur = (current as Record<string, unknown> | null) ?? {};

      const next = {
        id: "default",
        env: String(body["env"] || "").trim() ? String(body["env"]).trim() : (cur["env"] ?? null),
        access_token: String(body["access_token"] || "").trim() ? String(body["access_token"]).trim() : (cur["access_token"] ?? null),
        webhook_secret: String(body["webhook_secret"] || "").trim() ? String(body["webhook_secret"]).trim() : (cur["webhook_secret"] ?? null),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase.from("mp_settings").upsert(next, { onConflict: "id" });
      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown_action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || "unknown_error");
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
