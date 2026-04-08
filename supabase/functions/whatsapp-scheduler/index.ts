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

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = (m?.[1] || "").trim();
  return token || null;
}

function decodeLegacySessionToken(token: string) {
  try {
    const decoded = JSON.parse(atob(token));
    const userId = String(decoded?.id || "").trim();
    const expiresAt = String(decoded?.expires_at || "").trim();
    if (!userId || !expiresAt) return null;
    const exp = new Date(expiresAt);
    if (Number.isNaN(exp.getTime())) return null;
    if (exp.getTime() <= Date.now()) return null;
    return { userId, expiresAt };
  } catch {
    return null;
  }
}

function normalizeNumber(raw: string) {
  return raw.split("@")[0].replace(/\D/g, "");
}

function inferTipo(mimetype: string | null) {
  if (!mimetype) return "document";
  const mt = mimetype.toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  return "document";
}

function decodeBase64ToBytes(base64: string) {
  const clean = base64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extensionFromMime(mime: string | null) {
  const mt = (mime || "").toLowerCase();
  if (!mt.includes("/")) return "bin";
  const sub = mt.split("/")[1] || "bin";
  if (sub.includes("jpeg")) return "jpg";
  if (sub.includes("png")) return "png";
  if (sub.includes("webp")) return "webp";
  if (sub.includes("pdf")) return "pdf";
  if (sub.includes("mp4")) return "mp4";
  if (sub.includes("mpeg")) return "mp3";
  if (sub.includes("ogg")) return "ogg";
  if (sub.includes("wav")) return "wav";
  return sub.split(";")[0] || "bin";
}

async function sendText(conexao: any, number: string, text: string) {
  const baseUrl = String(conexao.api_url || "").replace(/\/+$/, "");
  const instance = encodeURIComponent(String(conexao.nome_api || ""));
  const apikey = String(conexao.apikey || conexao.globalkey || "");
  const url = `${baseUrl}/message/sendText/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({ number, text }),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

async function sendMedia(conexao: any, number: string, mediatype: string, mimetype: string, media: string, fileName: string, caption: string | null) {
  const baseUrl = String(conexao.api_url || "").replace(/\/+$/, "");
  const instance = encodeURIComponent(String(conexao.nome_api || ""));
  const apikey = String(conexao.apikey || conexao.globalkey || "");
  const url = `${baseUrl}/message/sendMedia/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({
      number,
      mediatype,
      mimetype,
      caption: caption || "",
      media,
      fileName,
    }),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

async function sendAudio(conexao: any, number: string, audio: string) {
  const baseUrl = String(conexao.api_url || "").replace(/\/+$/, "");
  const instance = encodeURIComponent(String(conexao.nome_api || ""));
  const apikey = String(conexao.apikey || conexao.globalkey || "");
  const url = `${baseUrl}/message/sendWhatsAppAudio/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({ number, audio }),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

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

    const bearerToken = Deno.env.get("SCHEDULER_BEARER_TOKEN") || "";
    const token = getBearerToken(req);
    const isGlobalScheduler = Boolean(bearerToken) && (token || "").toLowerCase() === bearerToken.toLowerCase();

    let empresaScopeId: string | null = null;
    if (!isGlobalScheduler) {
      if (!token) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const legacy = decodeLegacySessionToken(token);
      let userId = legacy?.userId || "";
      const nowIso = new Date().toISOString();

      const { data: sessionRow, error: sessionErr } = await supabase
        .from("user_sessions")
        .select("user_id, expires_at")
        .eq("token", token)
        .gte("expires_at", nowIso)
        .maybeSingle();

      const sessionErrMsg = String((sessionErr as any)?.message || "");
      const sessionTableMissing = sessionErrMsg.toLowerCase().includes("user_sessions") && sessionErrMsg.toLowerCase().includes("does not exist");

      if (!sessionTableMissing && sessionRow?.user_id) {
        userId = String(sessionRow.user_id);
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userRow } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", userId)
        .maybeSingle();

      empresaScopeId = (userRow as any)?.empresa_id ? String((userRow as any).empresa_id) : null;
      if (!empresaScopeId) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const nowIso = new Date().toISOString();
    const dueQuery = supabase
      .from("mensagens_agendadas")
      .select("id, empresa_id, contato_id, conexao_id, tipo, texto, media_base64, mimetype, file_name, scheduled_for")
      .eq("status", "scheduled")
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(25);

    const { data: due } = empresaScopeId ? await dueQuery.eq("empresa_id", empresaScopeId) : await dueQuery;

    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const item of due) {
      processed += 1;
      const { data: contato } = await supabase
        .from("contatos")
        .select("contato")
        .eq("id", item.contato_id)
        .maybeSingle();

      const number = normalizeNumber(contato?.contato || "");
      if (!number) {
        failed += 1;
        await supabase
          .from("mensagens_agendadas")
          .update({ status: "error", error_message: "invalid destination", updated_at: nowIso } as any)
          .eq("id", item.id);
        continue;
      }

      const conexaoQuery = supabase
        .from("conexoes")
        .select("api_url, nome_api, apikey, globalkey");
      const { data: conexao } = item.conexao_id
        ? await conexaoQuery.eq("id", item.conexao_id).maybeSingle()
        : await conexaoQuery.eq("empresa_id", item.empresa_id).limit(1).maybeSingle();

      if (!conexao?.api_url || !conexao?.nome_api || (!conexao?.apikey && !conexao?.globalkey)) {
        failed += 1;
        await supabase
          .from("mensagens_agendadas")
          .update({ status: "error", error_message: "missing connection", updated_at: nowIso } as any)
          .eq("id", item.id);
        continue;
      }

      const tipo = item.tipo || inferTipo(item.mimetype || null);
      let result: any = null;
      if (tipo === "text") {
        result = await sendText(conexao, number, String(item.texto || ""));
      } else if (tipo === "audio") {
        result = await sendAudio(conexao, number, String(item.media_base64 || ""));
      } else {
        result = await sendMedia(
          conexao,
          number,
          tipo,
          String(item.mimetype || "application/octet-stream"),
          String(item.media_base64 || ""),
          String(item.file_name || "arquivo"),
          item.texto || ""
        );
      }

      if (!result?.ok) {
        failed += 1;
        await supabase
          .from("mensagens_agendadas")
          .update({ status: "error", error_message: `send failed (${result?.status || 0})`, updated_at: nowIso } as any)
          .eq("id", item.id);
        continue;
      }

      sent += 1;
      let externalId: string | null = null;
      try {
        const parsed = JSON.parse(result.body || "{}");
        externalId = parsed?.key?.id || parsed?.message?.key?.id || null;
      } catch {
        externalId = null;
      }
      await supabase
        .from("mensagens_agendadas")
        .update({ status: "sent", sent_at: nowIso, external_id: externalId, updated_at: nowIso } as any)
        .eq("id", item.id);

      const preview = tipo === "text"
        ? String(item.texto || "")
        : tipo === "audio"
          ? "[Áudio]"
          : `[${tipo === "image" ? "Imagem" : tipo === "video" ? "Vídeo" : "Documento"}] ${item.file_name || ""}`.trim();

      let mediaUrl: string | null = null;
      if (tipo !== "text" && item.media_base64) {
        try {
          const bytes = decodeBase64ToBytes(String(item.media_base64));
          const mimetype = String(item.mimetype || "application/octet-stream");
          const ext = extensionFromMime(mimetype);
          const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, "");
          const path = `chat-media/${item.empresa_id}/${item.contato_id}/${safeId}.${ext}`;
          const blob = new Blob([bytes.buffer], { type: mimetype });
          const up = await supabase.storage.from("orcamentos").upload(path, blob, { upsert: true, contentType: mimetype } as any);
          if (!up.error) {
            mediaUrl = supabase.storage.from("orcamentos").getPublicUrl(path).data.publicUrl || null;
          }
        } catch {
          mediaUrl = null;
        }
      }

      await supabase
        .from("mensagens")
        .insert({
          empresa_id: item.empresa_id,
          contato_id: item.contato_id,
          conexao_id: item.conexao_id || null,
          direcao: "out",
          conteudo: preview,
          status: "enviado",
          external_id: externalId || null,
          tipo: tipo === "text" ? "text" : tipo,
          media_url: mediaUrl,
          mimetype: item.mimetype || null,
          file_name: item.file_name || null,
        } as any);
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
