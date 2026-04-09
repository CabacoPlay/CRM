import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

type DenoEnv = { get?: (key: string) => string | undefined };
type DenoLike = { env?: DenoEnv };
const DenoRef = (globalThis as unknown as { Deno?: DenoLike }).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = DenoRef?.env?.get?.("SUPABASE_URL") ?? "";
const supabaseKey = DenoRef?.env?.get?.("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function loadSettings() {
  const { data } = await supabase.from("mp_settings").select("*").eq("id", "default").maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

function toDateOnly(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function notifyEmpresaUsers(empresaId: string, payload: { type: string; title: string; description: string; meta?: unknown }) {
  const { data } = await supabase.from("usuarios").select("id").eq("empresa_id", empresaId);
  const users = Array.isArray(data) ? data : [];
  if (!users.length) return;
  const rows = users.map((u) => ({
    user_id: String((u as Record<string, unknown>)["id"] || ""),
    empresa_id: empresaId,
    type: payload.type,
    title: payload.title,
    description: payload.description,
    meta: payload.meta ?? null,
  }));
  await supabase.from("user_notifications").insert(rows);
}

function parseXSignature(value: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return { ts: "", v1: "" };
  const parts = raw.split(",");
  let ts = "";
  let v1 = "";
  for (const p of parts) {
    const [k, v] = p.split("=", 2);
    if (!k || !v) continue;
    const key = k.trim();
    const val = v.trim();
    if (key === "ts") ts = val;
    if (key === "v1") v1 = val;
  }
  return { ts, v1 };
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function mpGetPayment(accessToken: string, paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`mp_get_payment_failed:${res.status}:${text}`);
  return (JSON.parse(text || "{}") as unknown) as Record<string, unknown>;
}

async function handlePaid(paymentId: string, payload: unknown) {
  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("id,empresa_id,status,paid_at")
    .eq("provider", "mercadopago")
    .eq("provider_txid", paymentId)
    .maybeSingle();
  if (!invoice) return { ok: false, reason: "invoice_not_found" };
  const invoiceRow = invoice as Record<string, unknown>;
  if (String(invoiceRow["status"] || "") === "paid" || invoiceRow["paid_at"]) return { ok: true, already: true };

  const now = new Date();
  const nowIso = now.toISOString();

  await supabase
    .from("billing_invoices")
    .update({ status: "paid", paid_at: nowIso, raw: payload })
    .eq("id", String(invoiceRow["id"]));

  const empresaId = String(invoiceRow["empresa_id"]);
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id,billing_due_date,billing_status")
    .eq("id", empresaId)
    .maybeSingle();

  const today = toDateOnly(now);
  let base = today;
  const empresaRow = (empresa as Record<string, unknown> | null) ?? null;
  const currentDueRaw = empresaRow ? (empresaRow["billing_due_date"] as string | null | undefined) : null;
  if (currentDueRaw) {
    const currentDue = toDateOnly(new Date(currentDueRaw));
    if (currentDue.getTime() > today.getTime()) base = currentDue;
  }
  const newDue = addDays(base, 30);
  const dueDate = `${newDue.getFullYear()}-${String(newDue.getMonth() + 1).padStart(2, "0")}-${String(newDue.getDate()).padStart(2, "0")}`;

  await supabase.from("empresas").update({ billing_status: "active", billing_due_date: dueDate }).eq("id", empresaId);
  await supabase.from("conexoes").update({ status: "pendente", last_status_error: null }).eq("empresa_id", empresaId);
  await supabase.from("billing_events").insert({ empresa_id: empresaId, type: "paid", detail: `Pagamento confirmado (MP payment ${paymentId})` });

  await notifyEmpresaUsers(empresaId, {
    type: "success",
    title: "Pagamento confirmado",
    description: `Pagamento confirmado. Novo vencimento: ${newDue.toLocaleDateString("pt-BR")}.`,
    meta: { empresaId, paymentId, dueDate, provider: "mercadopago" },
  });

  return { ok: true, empresaId, dueDate };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const settings = await loadSettings();
    const accessToken = String((settings?.["access_token"] ?? DenoRef?.env?.get?.("MP_ACCESS_TOKEN") ?? "")).trim();
    if (!accessToken) throw new Error("missing_mp_access_token");

    const secret = String((settings?.["webhook_secret"] ?? DenoRef?.env?.get?.("MP_WEBHOOK_SECRET") ?? "")).trim();
    if (secret) {
      const dataId = String(url.searchParams.get("data.id") || "").trim();
      const xRequestId = String(req.headers.get("x-request-id") || "").trim();
      const { ts, v1 } = parseXSignature(req.headers.get("x-signature"));
      if (!dataId || !xRequestId || !ts || !v1) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const sha = await hmacSha256Hex(secret, manifest);
      if (sha !== String(v1).toLowerCase()) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bodyData = isRecord(body["data"]) ? (body["data"] as Record<string, unknown>) : null;
    const paymentId = String(url.searchParams.get("data.id") || bodyData?.["id"] || body["id"] || "").trim();
    if (!paymentId) return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payment = await mpGetPayment(accessToken, paymentId);
    const status = String(payment["status"] || "").trim();
    if (status !== "approved") {
      return new Response(JSON.stringify({ ok: true, paymentId, status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await handlePaid(paymentId, { webhook: { url: req.url, headers: Object.fromEntries(req.headers), body }, payment });
    return new Response(JSON.stringify({ ok: true, paymentId, status, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error || "unknown_error");
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
