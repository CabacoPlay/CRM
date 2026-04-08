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

function stripDataUrl(input: string) {
  const m = input.match(/^data:([^;]+);base64,(.*)$/);
  if (m) return { mimetype: m[1] || "application/octet-stream", base64: m[2] || "" };
  return { mimetype: "application/octet-stream", base64: input };
}

function inferMimeFromUrl(url: string, fallback: string) {
  const s = String(url || "").toLowerCase();
  if (s.includes(".jpg") || s.includes(".jpeg")) return "image/jpeg";
  if (s.includes(".png")) return "image/png";
  if (s.includes(".webp")) return "image/webp";
  if (s.includes(".gif")) return "image/gif";
  if (s.includes(".mp4")) return "video/mp4";
  if (s.includes(".pdf")) return "application/pdf";
  return fallback;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const body = await req.json().catch(() => ({}));
    const messageId = body?.message_id as string | undefined;
    const senderNameOverride = (body?.sender_name as string | undefined) || undefined;
    if (!messageId) {
      return new Response(JSON.stringify({ error: "message_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: msg, error: eMsg } = await supabase
      .from("mensagens")
      .select("id, empresa_id, contato_id, conteudo, tipo, media_url, mimetype, file_name, external_id, conexao_id, sender_name, reply_to_message_id, reply_to_external_id, reply_to_preview")
      .eq("id", messageId)
      .maybeSingle();
    if (eMsg || !msg) {
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { data: contato } = await supabase
      .from("contatos")
      .select("contato")
      .eq("id", msg.contato_id)
      .maybeSingle();
    const remoteJid = String(contato?.contato || "").trim();
    const conexaoQuery = supabase
      .from("conexoes")
      .select("api_url, nome_api, apikey, globalkey");
    const { data: conexao } = msg.conexao_id
      ? await conexaoQuery.eq("id", msg.conexao_id).maybeSingle()
      : await conexaoQuery.eq("empresa_id", msg.empresa_id).limit(1).maybeSingle();
    if (!conexao?.api_url || !conexao?.nome_api || (!conexao?.apikey && !conexao?.globalkey)) {
      return new Response(JSON.stringify({ error: "no available connection for empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const baseUrl = String(conexao.api_url).replace(/\/+$/, "");
    const instance = encodeURIComponent(String(conexao.nome_api));
    const numberRaw = contato?.contato || "";
    const number = numberRaw.split("@")[0].replace(/\D/g, "");
    const tipo = String((msg as any)?.tipo || "text").trim() || "text";
    const mediaUrl = String((msg as any)?.media_url || "").trim();
    const hasMediaUrl = Boolean(mediaUrl);
    if (!number) {
      return new Response(JSON.stringify({ error: "invalid destination" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const apikey = String(conexao.apikey || conexao.globalkey || "");
    const isSticker = String(msg.conteudo || "").startsWith("sticker:");
    const shouldSendMedia = isSticker || (tipo !== "text" && hasMediaUrl);
    if (!shouldSendMedia && !String(msg.conteudo || "").trim()) {
      return new Response(JSON.stringify({ error: "empty content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const url = shouldSendMedia
      ? `${baseUrl}/message/sendMedia/${instance}`
      : `${baseUrl}/message/sendText/${instance}`;
    const signedText = (() => {
      const name = (senderNameOverride || (msg as any)?.sender_name) as string | null | undefined;
      const base = String(msg.conteudo || "");
      if (!name) return base;
      const variants = [`*${name}*: `, `*${name}*:\n`, `*${name}*\n`];
      if (variants.some(v => base.startsWith(v))) return base;
      return `*${name}*:\n${base}`;
    })();

    const quoted = await (async () => {
      const replyPrev = String((msg as any)?.reply_to_preview || "").trim();
      let replyExt = String((msg as any)?.reply_to_external_id || "").trim();
      let fromMe = false;
      const replyMsgId = (msg as any)?.reply_to_message_id as string | null | undefined;
      if (replyMsgId) {
        const { data: replied } = await supabase
          .from("mensagens")
          .select("external_id, direcao, conteudo")
          .eq("id", replyMsgId)
          .maybeSingle();
        if (!replyExt) replyExt = String((replied as any)?.external_id || "").trim();
        fromMe = String((replied as any)?.direcao || "") === "out";
      }
      if (!replyExt) return null;
      if (!remoteJid) return null;
      const preview = replyPrev || "…";
      return {
        key: { remoteJid, fromMe, id: replyExt },
        message: { conversation: preview },
      };
    })();
    const payload = isSticker
      ? (() => {
          const raw = String(msg.conteudo || "").slice("sticker:".length);
          const { mimetype, base64 } = stripDataUrl(raw);
          return {
            number,
            mediatype: "sticker",
            mimetype: mimetype || "image/webp",
            caption: "",
            media: base64,
            fileName: "sticker.webp",
          };
        })()
      : shouldSendMedia
        ? (() => {
            const mediatype = tipo === "video"
              ? "video"
              : tipo === "document"
                ? "document"
                : tipo === "audio"
                  ? "audio"
                  : "image";
            const mm = inferMimeFromUrl(mediaUrl, String((msg as any)?.mimetype || "application/octet-stream"));
            const fn = String((msg as any)?.file_name || "").trim() || (mediatype === "image" ? "image.jpg" : `${mediatype}`);
            return {
              number,
              mediatype,
              mimetype: mm,
              caption: signedText || "",
              media: mediaUrl,
              fileName: fn,
            };
          })()
        : quoted
          ? { number, text: signedText, quoted }
          : { number, text: signedText };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apikey
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      await supabase
        .from("mensagens")
        .update({ status: "erro" } as any)
        .eq("id", messageId);
      const errorText = await response.text().catch(() => "");
      return new Response(JSON.stringify({ error: "send failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const sent = await response.json().catch(() => ({}));
    const extId =
      sent?.key?.id ||
      sent?.message?.key?.id ||
      sent?.message?.keyId ||
      null;
    if (extId) {
      const { data: updated } = await supabase
        .from("mensagens")
        .update({ status: "enviado", external_id: extId } as any)
        .eq("id", messageId)
        .is("external_id", null)
        .select("id")
        .maybeSingle();
      if (!updated?.id) {
        await supabase
          .from("mensagens")
          .update({ status: "enviado" } as any)
          .eq("id", messageId);
      }
    } else {
      await supabase
        .from("mensagens")
        .update({ status: "enviado" } as any)
        .eq("id", messageId);
    }

    return new Response(JSON.stringify({ ok: true, external_id: extId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
