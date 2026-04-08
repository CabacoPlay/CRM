// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-signature, x-n8n-timestamp",
};

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeNumber(raw: string) {
  return raw.split("@")[0].replace(/\D/g, "");
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

    const raw = await req.text();
    const signature = req.headers.get("x-n8n-signature") || "";
    const ts = req.headers.get("x-n8n-timestamp") || "";
    const secret = Deno.env.get("N8N_SHARED_SECRET") || "";
    const bearer = (req.headers.get("authorization") || "").trim();
    const bearerToken = Deno.env.get("N8N_BEARER_TOKEN") || "";
    const bearerOk = bearerToken && bearer.toLowerCase() === `bearer ${bearerToken}`.toLowerCase();
    const hmacEnabled = Boolean(secret);

    if (!hmacEnabled && !bearerToken) {
      return new Response(JSON.stringify({ error: "missing server configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!bearerOk) {
      if (!hmacEnabled) {
        return new Response(JSON.stringify({ error: "missing signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!signature || !ts) {
        return new Response(JSON.stringify({ error: "missing signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const now = Date.now();
      const tsMs = Number(ts);
      if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > 5 * 60 * 1000) {
        return new Response(JSON.stringify({ error: "stale signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expected = await hmacSha256Hex(secret, `${ts}.${raw}`);
      if (!timingSafeEqual(new TextEncoder().encode(expected), new TextEncoder().encode(signature))) {
        return new Response(JSON.stringify({ error: "invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = JSON.parse(raw || "{}");
    const cleanId = (v: unknown) => String(v ?? "")
      .trim()
      .replace(/^=+/, "")
      .replace(/^"+|"+$/g, "");

    let empresaId = cleanId(body?.empresa_id) || undefined;
    let contatoId = cleanId(body?.contato_id) || undefined;
    const remoteJid = cleanId(body?.remoteJid || body?.remote_jid) || undefined;
    const numberRaw = cleanId(body?.number || body?.telefone) || undefined;
    const mediaUrl = cleanId(body?.media_url || body?.mediaUrl || body?.media_url || body?.media) || undefined;
    const mimetype = cleanId(body?.mimetype) || undefined;
    const fileName = cleanId(body?.file_name || body?.fileName) || undefined;
    const tipoIn = cleanId(body?.tipo || body?.type || body?.mediatype) || "";
    const text = String(body?.text ?? body?.mensagem ?? body?.output ?? "")
      .replace(/^[\s\u200B\uFEFF]*=+/g, "")
      .trim();

    if (!text && !mediaUrl) {
      return new Response(JSON.stringify({ error: "text or media_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const number = normalizeNumber(remoteJid || numberRaw || "");

    let contato: any = null;
    if (contatoId) {
      const { data, error } = await supabase
        .from("contatos")
        .select("id, empresa_id, contato, atendimento_mode, conexao_id")
        .eq("id", contatoId)
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: "failed to lookup contato by id", details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contato = data || null;
      if (contato?.empresa_id && !empresaId) empresaId = String(contato.empresa_id);

      if (!contato?.id) {
        if (empresaId && number) {
          const rjid = `${number}@s.whatsapp.net`;
          const { data: data2, error: error2 } = await supabase
            .from("contatos")
            .select("id, empresa_id, contato, atendimento_mode, conexao_id")
            .eq("empresa_id", empresaId)
            .or(`contato.eq.${rjid},contato.eq.${number}`)
            .limit(1)
            .maybeSingle();
          if (error2) {
            return new Response(JSON.stringify({ error: "failed to lookup contato by empresa/number", details: error2.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          contato = data2 || null;
          contatoId = contato?.id ? String(contato.id) : undefined;
        }
      }
    } else {
      if (!empresaId) {
        return new Response(JSON.stringify({ error: "empresa_id or contato_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!number) {
        return new Response(JSON.stringify({ error: "contato_id or number/remoteJid is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rjid = `${number}@s.whatsapp.net`;
      const { data, error } = await supabase
        .from("contatos")
        .select("id, empresa_id, contato, atendimento_mode, conexao_id")
        .eq("empresa_id", empresaId)
        .or(`contato.eq.${rjid},contato.eq.${number}`)
        .limit(1)
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: "failed to lookup contato by empresa/number", details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contato = data || null;
      contatoId = contato?.id ? String(contato.id) : undefined;
    }

    if (!contato?.id) {
      return new Response(JSON.stringify({ error: "contato not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "empresa_id not resolved" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (contato.atendimento_mode === "humano") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "humano" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedTipos = new Set(["text", "image", "video", "document", "audio"]);
    const tipo = (() => {
      if (mediaUrl) {
        if (allowedTipos.has(tipoIn)) return tipoIn;
        return "image";
      }
      if (allowedTipos.has(tipoIn)) return tipoIn;
      return "text";
    })();

    const { data: inserted, error: insErr } = await supabase
      .from("mensagens")
      .insert({
        empresa_id: empresaId,
        contato_id: contatoId,
        conexao_id: contato.conexao_id || null,
        direcao: "out",
        conteudo: text,
        tipo,
        media_url: mediaUrl || null,
        mimetype: mimetype || null,
        file_name: fileName || null,
        status: "pendente",
      } as any)
      .select("id")
      .single();
    if (insErr) {
      return new Response(JSON.stringify({ error: "failed to insert message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fnUrl = `${supabaseUrl}/functions/v1/whatsapp-send`;
    const sendRes = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: inserted.id }),
    });
    const sendBody = await sendRes.text().catch(() => "");
    if (!sendRes.ok) {
      await supabase.from("mensagens").update({ status: "erro" } as any).eq("id", inserted.id);
      return new Response(JSON.stringify({ error: "send failed", details: sendBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeNumber(contato.contato || "");
    return new Response(JSON.stringify({ ok: true, message_id: inserted.id, number: normalized, empresa_id: empresaId, contato_id: contatoId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
