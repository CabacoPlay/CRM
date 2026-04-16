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
        .from("resend_settings")
        .select("id,sender_title,api_token,updated_at")
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
        sender_title: row["sender_title"] == null ? null : String(row["sender_title"]),
        has_api_token: Boolean(row["api_token"]),
        api_token_preview: maskValue(row["api_token"], 10, 4),
        updated_at: row["updated_at"] == null ? null : String(row["updated_at"]),
      };
      return new Response(JSON.stringify({ ok: true, settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set") {
      const { data: current } = await supabase.from("resend_settings").select("*").eq("id", "default").maybeSingle();
      const cur = (current as Record<string, unknown> | null) ?? {};

      const next = {
        id: "default",
        sender_title: String(body["sender_title"] || "").trim()
          ? String(body["sender_title"]).trim()
          : (cur["sender_title"] ?? null),
        api_token: String(body["api_token"] || "").trim()
          ? String(body["api_token"]).trim()
          : (cur["api_token"] ?? null),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase.from("resend_settings").upsert(next, { onConflict: "id" });
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
