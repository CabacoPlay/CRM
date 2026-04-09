import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

declare const Deno: any;

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

function toDateOnly(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
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
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const { data: empresas, error } = await supabase
      .from("empresas")
      .select("id,nome,telefone,responsavel,billing_enabled,billing_plan,billing_due_date,billing_grace_days,billing_status,billing_last_notified_at,billing_price_cents,billing_currency")
      .eq("billing_enabled", true)
      .not("billing_due_date", "is", null);
    if (error) throw error;

    let notified = 0;
    let suspended = 0;
    let reactivated = 0;

    for (const e of (empresas || []) as any[]) {
      const plan = String(e.billing_plan || "free").toLowerCase();
      if (plan === "free") continue;
      const dueRaw = e.billing_due_date as string | null;
      if (!dueRaw) continue;

      const due = toDateOnly(dueRaw);
      const grace = Number(e.billing_grace_days ?? 3);
      const end = new Date(due);
      end.setDate(end.getDate() + (Number.isFinite(grace) ? grace : 3));

      const daysToDue = Math.round((due.getTime() - today.getTime()) / 86400000);
      const isExpired = today.getTime() > end.getTime();
      const status = String(e.billing_status || "active");

      if (!isExpired && status.toLowerCase() === "suspended") {
        await supabase
          .from("empresas")
          .update({ billing_status: "active" } as any)
          .eq("id", e.id);
        await supabase
          .from("billing_events")
          .insert({ empresa_id: e.id, type: "reactivated", detail: "Reativado automaticamente (dentro da carência)" } as any);
        await notifyEmpresaUsers(String(e.id), {
          type: "success",
          title: "Acesso reativado",
          description: "O acesso da sua empresa foi reativado.",
        });
        reactivated += 1;
      }

      if (isExpired && status.toLowerCase() !== "suspended") {
        await supabase
          .from("empresas")
          .update({ billing_status: "suspended" } as any)
          .eq("id", e.id);

        await supabase
          .from("conexoes")
          .update({ status: "desconectado", last_status_error: "billing_suspended" } as any)
          .eq("empresa_id", e.id);

        await supabase
          .from("billing_events")
          .insert({ empresa_id: e.id, type: "suspended", detail: "Suspenso automaticamente por vencimento" } as any);
        await notifyEmpresaUsers(String(e.id), {
          type: "alert",
          title: "Acesso suspenso",
          description: "O acesso da sua empresa foi suspenso por vencimento do plano.",
        });
        suspended += 1;
      }

      if (daysToDue === 1) {
        const last = e.billing_last_notified_at ? Date.parse(String(e.billing_last_notified_at)) : 0;
        if (!last || Number.isNaN(last) || (Date.now() - last > 20 * 60 * 60 * 1000)) {
          const dueBr = due.toLocaleDateString("pt-BR");
          const planName = String(e.billing_plan || "free");
          const cents = Number(e.billing_price_cents ?? 0);
          const cur = String(e.billing_currency || "BRL");
          const price = cents > 0
            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(cents / 100)
            : null;

          await notifyEmpresaUsers(String(e.id), {
            type: "alert",
            title: "Vencimento do plano",
            description: `Seu plano (${planName}) vence em ${dueBr}.${price ? ` Valor: ${price}.` : ""}`,
            meta: { empresaId: String(e.id) },
          });

          await supabase
            .from("empresas")
            .update({ billing_last_notified_at: new Date().toISOString() } as any)
            .eq("id", e.id);

          const phone = digitsOnly(String(e.telefone || ""));
          const conexao = phone ? await getBillingConexao(String(e.id)) : null;
          if (phone && conexao) {
            const respName = String(e.responsavel || "").trim() || "responsável";
            const text =
              `Olá ${respName}, seu plano (${planName}) vence em ${dueBr}.` +
              (price ? ` Valor: ${price}.` : "") +
              ` Para evitar bloqueio, efetue o pagamento/renovação antes do vencimento.`;
            await sendText(conexao, phone, text);
          }

          await supabase
            .from("billing_events")
            .insert({ empresa_id: e.id, type: "notified", detail: `Aviso D-1 gerado (sino/toast${phone ? ` e WhatsApp ${phone}` : ""})` } as any);
          notified += 1;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified, suspended, reactivated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String((error as any)?.message || error || "unknown_error") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
