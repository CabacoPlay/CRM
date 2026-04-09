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

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

async function getBillingConexao(empresaId: string) {
  const { data } = await supabase
    .from("conexoes")
    .select("id, api_url, nome_api, apikey, globalkey, status, empresa_id")
    .eq("status", "conectado")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .order("empresa_id", { ascending: false })
    .limit(1);
  return (data && data[0]) ? (data[0] as any) : null;
}

async function sendText(conexao: { api_url?: string | null; nome_api?: string | null; apikey?: string | null; globalkey?: string | null }, number: string, text: string) {
  const apiUrl = (conexao.api_url || "").toString().replace(/\/+$/, "");
  const instance = (conexao.nome_api || "").toString();
  const apikey = (conexao.apikey || conexao.globalkey || "").toString();
  if (!apiUrl || !instance || !apikey) return { ok: false, body: "" };
  const url = `${apiUrl}/message/sendText/${encodeURIComponent(instance)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({ number, text }),
  }).catch(() => null);
  if (!res) return { ok: false, body: "" };
  const body = await res.text().catch(() => "");
  return { ok: res.ok, body };
}

async function notifyEmpresaUsers(empresaId: string, payload: { type: string; title: string; description: string; meta?: any }) {
  const { data } = await supabase.from("usuarios").select("id").eq("empresa_id", empresaId);
  const users = Array.isArray(data) ? data : [];
  if (!users.length) return;
  const rows = users.map((u: any) => ({
    user_id: u.id,
    empresa_id: empresaId,
    type: payload.type,
    title: payload.title,
    description: payload.description,
    meta: payload.meta ?? null,
  }));
  await supabase.from("user_notifications").insert(rows as any);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action || "");
    const empresaId = String(body?.empresa_id || "");
    if (!empresaId) throw new Error("missing_empresa_id");

    if (action === "notify") {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id,nome,telefone,responsavel,billing_plan,billing_due_date,billing_price_cents,billing_currency")
        .eq("id", empresaId)
        .maybeSingle();
      if (!empresa) throw new Error("empresa_not_found");
      const phone = digitsOnly(String((empresa as any).telefone || ""));
      if (!phone) throw new Error("no_phone");
      const conexao = await getBillingConexao(empresaId);
      if (!conexao) throw new Error("no_connection");
      const due = (empresa as any).billing_due_date ? new Date((empresa as any).billing_due_date).toLocaleDateString("pt-BR") : "em breve";
      const plan = String((empresa as any).billing_plan || "free");
      const cents = Number((empresa as any).billing_price_cents ?? 0);
      const cur = String((empresa as any).billing_currency || "BRL");
      const price = cents > 0
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(cents / 100)
        : null;
      const respName = String((empresa as any).responsavel || "").trim() || "responsável";
      const text = `Olá ${respName}, sua assinatura (${plan}) vence em ${due}.` + (price ? ` Valor: ${price}.` : "") + ` Este é um lembrete de cobrança.`;
      await sendText(conexao, phone, text);
      await supabase.from("billing_events").insert({ empresa_id: empresaId, type: "notified", detail: `Aviso manual enviado para ${phone}` } as any);
      await notifyEmpresaUsers(empresaId, {
        type: "alert",
        title: "Cobrança enviada",
        description: `Um lembrete de cobrança foi enviado. Vencimento: ${due}.${price ? ` Valor: ${price}.` : ""}`,
        meta: { empresaId },
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reactivate") {
      await supabase.from("empresas").update({ billing_status: "active" } as any).eq("id", empresaId);
      await supabase.from("conexoes").update({ status: "pendente", last_status_error: null } as any).eq("empresa_id", empresaId);
      await supabase.from("billing_events").insert({ empresa_id: empresaId, type: "reactivated", detail: "Reativado manualmente" } as any);
      await notifyEmpresaUsers(empresaId, {
        type: "success",
        title: "Acesso reativado",
        description: "O acesso da sua empresa foi reativado.",
        meta: { empresaId },
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown_action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String((error as any)?.message || error || "unknown_error") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
