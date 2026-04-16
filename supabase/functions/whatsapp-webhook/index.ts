import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp_id, ia_id, tipo } = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const whatsappId = String(whatsapp_id || "").trim();
    const tipoStr = String(tipo || "").trim();
    if (!whatsappId || !tipoStr) {
      return new Response(JSON.stringify({ ok: false, error: "whatsapp_id e tipo são obrigatórios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cx, error: cxError } = await supabase
      .from("conexoes")
      .select("id, api_url, nome_api, apikey, globalkey, empresa_id")
      .eq("id", whatsappId)
      .maybeSingle();
    if (cxError) throw cxError;
    if (!cx?.id || !cx.api_url || !cx.nome_api) {
      return new Response(JSON.stringify({ ok: false, error: "Conexão não encontrada ou incompleta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(cx.api_url || "").replace(/\/+$/, "");
    const instance = encodeURIComponent(String(cx.nome_api || ""));
    const apiKey = String(cx.apikey || cx.globalkey || "");
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "API Key da conexão não configurada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-inbound`;
    const enabled = true;

    const evoBody = {
      enabled,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
    };

    const attempts: Array<{ url: string; status: number; body: string }> = [];
    const headers = {
      "Content-Type": "application/json",
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    };

    const urls = [
      `${baseUrl}/webhook/set/${instance}`,
      `${baseUrl}/webhook/set/${instance}/`,
      `${baseUrl}/${instance}/webhook/set`,
      `${baseUrl}/${instance}/webhook/set/`,
      `${baseUrl}/webhook/set`,
      `${baseUrl}/webhook/set/`,
    ];

    for (const url of urls) {
      const body = url.includes("/webhook/set/") && url.endsWith("/webhook/set")
        ? JSON.stringify({ ...evoBody, instance: String(cx.nome_api || "") })
        : JSON.stringify(evoBody);

      const resp = await fetch(url, { method: "POST", headers, body });
      const text = await resp.text().catch(() => "");
      attempts.push({ url, status: resp.status, body: text });
      if (resp.ok) {
        return new Response(
          JSON.stringify({
            ok: true,
            message: "Webhook configurado com sucesso",
            webhook_enabled: enabled,
            webhook_url: webhookUrl,
            response: text,
            ia_id: ia_id ?? null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status !== 404) break;
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Falha ao configurar webhook na API",
        webhook_url: webhookUrl,
        attempts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
