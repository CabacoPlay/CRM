import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

function getNested(obj: unknown, path: string[]) {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function normalizePlan(value: unknown) {
  const v = String(value || "").toLowerCase().trim();
  if (v === "basic" || v === "pro") return v;
  return "free";
}

function centsToAmount(cents: number) {
  const v = Math.round(Number(cents || 0));
  return Number((v / 100).toFixed(2));
}

async function loadSettings() {
  const { data } = await supabase.from("mp_settings").select("*").eq("id", "default").maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
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

function cleanEmail(value: unknown) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (!v.includes("@")) return "";
  return v;
}

async function mpCreatePixPayment(accessToken: string, payload: Record<string, unknown>) {
  const idempotencyKey = crypto.randomUUID();
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`mp_payment_failed:${res.status}:${text}`);
  return (JSON.parse(text || "{}") as unknown) as Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const empresaId = String(body["empresa_id"] || "");
    if (!empresaId) throw new Error("missing_empresa_id");

    const { data: empresa } = await supabase
      .from("empresas")
      .select("id,nome,billing_enabled,billing_plan,billing_price_cents,billing_currency")
      .eq("id", empresaId)
      .maybeSingle();
    if (!empresa) throw new Error("empresa_not_found");
    const empresaRow = empresa as Record<string, unknown>;

    const plan = normalizePlan(empresaRow["billing_plan"]);
    const enabled = Boolean(empresaRow["billing_enabled"]);
    if (!enabled || plan === "free") throw new Error("billing_not_enabled");

    const amountCents = Number(body["amount_cents"] ?? empresaRow["billing_price_cents"] ?? 0);
    if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error("missing_price");

    const { data: existing } = await supabase
      .from("billing_invoices")
      .select("id,empresa_id,provider,provider_txid,amount_cents,currency,status,expires_at,pix_copy_paste,pix_qr_image,created_at")
      .eq("empresa_id", empresaId)
      .eq("provider", "mercadopago")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingRow = (existing as Record<string, unknown> | null) ?? null;
    const existingExpiresAt = existingRow ? existingRow["expires_at"] : null;
    if (existingRow && (existingExpiresAt == null || Date.parse(String(existingExpiresAt)) > Date.now())) {
      return new Response(JSON.stringify({ ok: true, invoice: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const settings = await loadSettings();
    const accessToken = String(settings?.["access_token"] || DenoRef?.env?.get?.("MP_ACCESS_TOKEN") || "").trim();
    if (!accessToken) throw new Error("missing_mp_access_token");

    let payerEmail = cleanEmail(body["payer_email"] || body["email"] || "");
    if (!payerEmail) {
      const { data: userRow } = await supabase.from("usuarios").select("email").eq("empresa_id", empresaId).order("created_at", { ascending: true }).limit(1).maybeSingle();
      const userRec = (userRow as Record<string, unknown> | null) ?? null;
      payerEmail = cleanEmail(userRec?.["email"] || "");
    }
    if (!payerEmail) throw new Error("missing_payer_email");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const expiresAtIso = expiresAt.toISOString();

    const paymentPayload: Record<string, unknown> = {
      transaction_amount: centsToAmount(amountCents),
      description: `Assinatura ${plan} - ${String(empresaRow["nome"] || "Empresa")}`,
      payment_method_id: "pix",
      payer: { email: payerEmail },
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      date_of_expiration: expiresAtIso,
      metadata: { empresa_id: empresaId, plan },
      external_reference: empresaId,
    };

    const payment = await mpCreatePixPayment(accessToken, paymentPayload);
    const paymentId = String(payment["id"] || "").trim();
    if (!paymentId) throw new Error("missing_payment_id");

    const txData = getNested(payment, ["point_of_interaction", "transaction_data"]);
    const txRec = isRecord(txData) ? txData : {};
    const copyPaste = String(txRec["qr_code"] || "").trim();
    const qrBase64 = String(txRec["qr_code_base64"] || "").trim();

    const currency = String(empresaRow["billing_currency"] || "BRL");
    const nowIso = new Date().toISOString();

    const insertRow = {
      empresa_id: empresaId,
      provider: "mercadopago",
      provider_txid: paymentId,
      provider_location_id: null,
      amount_cents: Math.round(amountCents),
      currency,
      status: "pending",
      expires_at: expiresAtIso,
      pix_copy_paste: copyPaste || null,
      pix_qr_image: qrBase64 || null,
      raw: { payment },
      created_at: nowIso,
    };

    const { data: invoice, error: invErr } = await supabase
      .from("billing_invoices")
      .insert(insertRow)
      .select("id,empresa_id,provider,provider_txid,amount_cents,currency,status,expires_at,pix_copy_paste,pix_qr_image,created_at")
      .single();
    if (invErr) throw invErr;

    await supabase.from("billing_events").insert({ empresa_id: empresaId, type: "invoice_created", detail: `Cobrança Pix MP criada (payment ${paymentId})` });
    await notifyEmpresaUsers(empresaId, {
      type: "alert",
      title: "Pagamento disponível",
      description: "Uma cobrança Pix foi gerada para renovação do seu plano. Abra o menu do sino para ver os detalhes.",
      meta: { empresaId, paymentId, provider: "mercadopago" },
    });

    return new Response(JSON.stringify({ ok: true, invoice }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error || "unknown_error");
    const safe = raw.replace(/\s+/g, " ").slice(0, 900);
    return new Response(JSON.stringify({ ok: false, error: safe }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
