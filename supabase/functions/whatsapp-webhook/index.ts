/// <reference path="../types.d.ts" />
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp_id, ia_id, tipo } = await req.json();

    if (!whatsapp_id || !tipo) {
      return new Response(JSON.stringify({ error: "whatsapp_id and tipo are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cx, error: cxError } = await supabase
      .from("conexoes")
      .select("id, api_url, nome_api, apikey, globalkey, empresa_id")
      .eq("id", whatsapp_id)
      .maybeSingle();
    if (cxError) throw cxError;
    if (!cx?.id || !cx.api_url || !cx.nome_api) {
      return new Response(JSON.stringify({ error: "Conexão não encontrada ou incompleta" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(cx.api_url || "").replace(/\/+$/, "");
    const instance = encodeURIComponent(String(cx.nome_api || ""));
    const apiKey = String(cx.apikey || cx.globalkey || "");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key da conexão não configurada" }), {
        status: 400,
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

    const evoResp = await fetch(`${baseUrl}/webhook/set/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(evoBody),
    });

    const evoText = await evoResp.text().catch(() => "");
    if (!evoResp.ok) {
      return new Response(JSON.stringify({ error: "Falha ao configurar webhook na Evolution", status: evoResp.status, body: evoText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook configurado com sucesso",
        webhook_enabled: enabled,
        webhook_url: webhookUrl,
        response: evoText,
        ia_id: ia_id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
