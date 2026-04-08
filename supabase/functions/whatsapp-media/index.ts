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
const proxySecret = Deno.env.get("MEDIA_PROXY_SECRET") || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function guessMimeFromPath(path: string) {
  const cleaned = String(path || "").split("#")[0].split("?")[0].toLowerCase();
  const m = cleaned.match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] || "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const bucket = String(url.searchParams.get("bucket") || "").trim();
  const path = String(url.searchParams.get("path") || "").trim();
  const ts = String(url.searchParams.get("ts") || "").trim();
  const sig = String(url.searchParams.get("sig") || "").trim();

  if (!bucket || !path || !ts || !sig) {
    return new Response("missing parameters", { status: 400, headers: { ...corsHeaders } });
  }

  if (bucket !== "product-images") {
    return new Response("bucket not allowed", { status: 403, headers: { ...corsHeaders } });
  }

  if (!proxySecret) {
    return new Response("proxy secret not configured", { status: 500, headers: { ...corsHeaders } });
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return new Response("invalid ts", { status: 400, headers: { ...corsHeaders } });
  }

  const ageMs = Math.abs(Date.now() - tsNum);
  if (ageMs > 10 * 60_000) {
    return new Response("expired", { status: 403, headers: { ...corsHeaders } });
  }

  const expected = await hmacSha256Hex(proxySecret, `${ts}.${bucket}.${path}`);
  if (expected !== sig) {
    return new Response("invalid signature", { status: 403, headers: { ...corsHeaders } });
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return new Response("not found", { status: 404, headers: { ...corsHeaders } });
  }

  const ab = await data.arrayBuffer();
  const mime = guessMimeFromPath(path);

  return new Response(ab, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": mime,
      "Cache-Control": "public, max-age=300",
    },
  });
});

