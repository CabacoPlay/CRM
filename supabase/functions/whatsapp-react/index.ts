/// <reference path="../types.d.ts" />
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messageId = body?.message_id as string | undefined;
    const reaction = String(body?.reaction || "").trim();
    if (!messageId || !reaction) {
      return new Response(JSON.stringify({ error: "message_id and reaction are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msg } = await supabase
      .from("mensagens")
      .select("id, empresa_id, contato_id, direcao, external_id, conexao_id")
      .eq("id", messageId)
      .maybeSingle();

    if (!msg?.id) {
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!msg.external_id) {
      return new Response(JSON.stringify({ error: "message has no external_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: contato } = await supabase
      .from("contatos")
      .select("contato")
      .eq("id", msg.contato_id)
      .maybeSingle();

    const remoteJid = String(contato?.contato || "").trim();
    if (!remoteJid) {
      return new Response(JSON.stringify({ error: "invalid contact" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conexaoQuery = supabase
      .from("conexoes")
      .select("api_url, nome_api, apikey, globalkey");
    const { data: conexao } = msg.conexao_id
      ? await conexaoQuery.eq("id", msg.conexao_id).maybeSingle()
      : await conexaoQuery.eq("empresa_id", msg.empresa_id).limit(1).maybeSingle();

    if (!conexao?.api_url || !conexao?.nome_api || (!conexao?.apikey && !conexao?.globalkey)) {
      return new Response(JSON.stringify({ error: "no available connection for empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(conexao.api_url).replace(/\/+$/, "");
    const instance = encodeURIComponent(String(conexao.nome_api));
    const apikey = String(conexao.apikey || conexao.globalkey || "");

    const url = `${baseUrl}/message/sendReaction/${instance}`;
    const fromMePrimary = String(msg.direcao) === "out";
    const payloads = [
      {
        key: { remoteJid, fromMe: fromMePrimary, id: String(msg.external_id) },
        reaction,
      },
      {
        key: { remoteJid, fromMe: !fromMePrimary, id: String(msg.external_id) },
        reaction,
      },
      {
        reactionMessage: {
          key: { remoteJid, fromMe: fromMePrimary, id: String(msg.external_id) },
          reaction,
        },
      },
      {
        reactionMessage: {
          key: { remoteJid, fromMe: !fromMePrimary, id: String(msg.external_id) },
          reaction,
        },
      },
      {
        reactionMessage: {
          key: { remoteJid, fromMe: fromMePrimary, id: String(msg.external_id) },
          text: reaction,
        },
      },
      {
        reactionMessage: {
          key: { remoteJid, fromMe: !fromMePrimary, id: String(msg.external_id) },
          text: reaction,
        },
      },
    ];

    let lastErrorText = "";
    for (const payload of payloads) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      lastErrorText = await response.text().catch(() => "");
    }

    return new Response(JSON.stringify({ error: "send failed", details: lastErrorText }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
