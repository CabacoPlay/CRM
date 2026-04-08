/// <reference path="../types.d.ts" />
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(input: string) {
  return (input || "").toString().replace("@s.whatsapp.net", "").replace(/\D/g, "");
}

function parseDateTime(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
  const hasTimezone =
    /[zZ]$/.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized);

  const withTimezone =
    !hasTimezone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)
      ? `${normalized}-03:00`
      : normalized;

  const d = new Date(withTimezone);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, params, empresa_id } = await req.json();

    const token = getBearerToken(req);
    const requireSession = async () => {
      if (!token) {
        return new Response(
          JSON.stringify({ error: "unauthorized", message: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const legacy = decodeLegacySessionToken(token);

      let userId = legacy?.userId || "";
      const nowIso = new Date().toISOString();

      const { data: sessionRow, error: sessionErr } = await supabaseClient
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
        return new Response(
          JSON.stringify({ error: "unauthorized", message: "Sessão inválida ou expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: userRow, error: userErr } = await supabaseClient
        .from("usuarios")
        .select("id, nome, email, papel, empresa_id, telefone")
        .eq("id", userId)
        .maybeSingle();

      if (userErr || !userRow?.id) {
        return new Response(
          JSON.stringify({ error: "unauthorized", message: "Usuário inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return userRow;
    };

    if (action === "list_appointments") {
      const sessionUser = await requireSession();
      if (sessionUser instanceof Response) return sessionUser;

      const start = parseDateTime(String(params?.start || ""));
      const end = parseDateTime(String(params?.end || ""));
      if (!start || !end) {
        return new Response(
          JSON.stringify({ error: "invalid_range", message: "Intervalo inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseClient
        .from("agendamentos")
        .select("*")
        .eq("empresa_id", sessionUser.empresa_id)
        .gte("data_hora", start.toISOString())
        .lt("data_hora", end.toISOString())
        .order("data_hora", { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_manual") {
      const sessionUser = await requireSession();
      if (sessionUser instanceof Response) return sessionUser;

      const { nome_cliente, contato_cliente, servico, data_hora, status } = params || {};
      const start = parseDateTime(String(data_hora || ""));
      if (!start) {
        return new Response(
          JSON.stringify({ success: false, error: "invalid_datetime", message: "Data/hora inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseClient
        .from("agendamentos")
        .insert([
          {
            nome_cliente,
            contato_cliente,
            servico,
            data_hora: start.toISOString(),
            empresa_id: sessionUser.empresa_id,
            origem: "Manual",
            status: status || "Confirmado",
            created_by_user_id: sessionUser.id,
          },
        ])
        .select()
        .single();

      if (error) {
        const code = (error as any)?.code;
        if (code === "23505") {
          return new Response(
            JSON.stringify({ success: false, error: "conflict", message: "Horário indisponível para esta empresa." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, appointment: data, message: "Agendamento criado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cancel_appointment_by_id" || action === "delete_appointment_by_id" || action === "update_status_by_id") {
      const sessionUser = await requireSession();
      if (sessionUser instanceof Response) return sessionUser;

      const id = String(params?.id || "").trim();
      if (!id) {
        return new Response(
          JSON.stringify({ error: "invalid_id", message: "ID inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: appt, error: apptErr } = await supabaseClient
        .from("agendamentos")
        .select("id, empresa_id, created_by_user_id, status, origem")
        .eq("id", id)
        .maybeSingle();

      if (apptErr) throw apptErr;
      if (!appt?.id) {
        return new Response(
          JSON.stringify({ error: "not_found", message: "Agendamento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (String(appt.empresa_id) !== String(sessionUser.empresa_id)) {
        return new Response(
          JSON.stringify({ error: "forbidden", message: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isAdmin = String(sessionUser.papel || "").toLowerCase() === "admin";
      const canManageAgenda = true;

      if (action === "delete_appointment_by_id") {
        if (!canManageAgenda) {
          return new Response(
            JSON.stringify({ error: "forbidden", message: "Sem permissão" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: delErr } = await supabaseClient.from("agendamentos").delete().eq("id", id);
        if (delErr) throw delErr;
        return new Response(JSON.stringify({ success: true, message: "Agendamento excluído." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "cancel_appointment_by_id") {
        if (!canManageAgenda) {
          return new Response(
            JSON.stringify({ error: "forbidden", message: "Sem permissão" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updErr } = await supabaseClient
          .from("agendamentos")
          .update({ status: "Cancelado" })
          .eq("id", id);

        if (updErr) throw updErr;
        return new Response(JSON.stringify({ success: true, message: "Agendamento cancelado." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "update_status_by_id") {
        const newStatus = String(params?.status || "").trim();
        if (!newStatus) {
          return new Response(
            JSON.stringify({ error: "invalid_status", message: "Status inválido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (newStatus === "Cancelado") {
          if (!canManageAgenda) {
            return new Response(
              JSON.stringify({ error: "forbidden", message: "Sem permissão" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (!canManageAgenda) {
          return new Response(
            JSON.stringify({ error: "forbidden", message: "Sem permissão" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updErr } = await supabaseClient
          .from("agendamentos")
          .update({ status: newStatus })
          .eq("id", id);

        if (updErr) throw updErr;
        return new Response(JSON.stringify({ success: true, message: "Status atualizado." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Verificar disponibilidade
    if (action === "check_availability") {
      const { data_hora, contato_cliente, duration_minutes } = params || {};
      
      const start = parseDateTime(String(data_hora || ""));
      if (!start) {
        return new Response(
          JSON.stringify({ available: false, message: "Data/hora inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const duration = Math.max(1, Math.min(24 * 60, Number(duration_minutes || 30)));
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      const { data: agendamentos, error } = await supabaseClient
        .from("agendamentos")
        .select("id, contato_cliente, status, data_hora")
        .eq("empresa_id", empresa_id)
        .gte("data_hora", start.toISOString())
        .lt("data_hora", end.toISOString())
        .not("status", "eq", "Cancelado");

      if (error) throw error;

      const list = Array.isArray(agendamentos) ? agendamentos : [];
      const phone = normalizePhone(String(contato_cliente || ""));
      if (phone && list.length > 0) {
        const sameContact = list.every((a: any) => normalizePhone(String(a?.contato_cliente || "")) === phone);
        if (sameContact) {
          return new Response(
            JSON.stringify({
              available: true,
              already_booked: true,
              message: "Agendamento já está confirmado nesse horário.",
              count: list.length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          available: list.length === 0,
          message: list.length === 0 ? "Horário disponível" : "Horário ocupado",
          count: list.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Realizar agendamento
    if (action === "create_appointment") {
      const { nome_cliente, contato_cliente, servico, data_hora, duration_minutes } = params || {};

      const start = parseDateTime(String(data_hora || ""));
      if (!start) {
        return new Response(
          JSON.stringify({ success: false, error: "invalid_datetime", message: "Data/hora inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const duration = Math.max(1, Math.min(24 * 60, Number(duration_minutes || 30)));
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      const { data: conflicts, error: conflictErr } = await supabaseClient
        .from("agendamentos")
        .select("id, contato_cliente, status, data_hora, servico, nome_cliente")
        .eq("empresa_id", empresa_id)
        .gte("data_hora", start.toISOString())
        .lt("data_hora", end.toISOString())
        .not("status", "eq", "Cancelado");

      if (conflictErr) throw conflictErr;

      const conflictList = Array.isArray(conflicts) ? conflicts : [];
      const phone = normalizePhone(String(contato_cliente || ""));
      if (conflictList.length > 0) {
        const existingForSameContact = phone
          ? conflictList.find((a: any) => normalizePhone(String(a?.contato_cliente || "")) === phone)
          : null;
        if (existingForSameContact) {
          return new Response(
            JSON.stringify({
              success: true,
              already_exists: true,
              appointment: existingForSameContact,
              message: "Agendamento já estava confirmado nesse horário.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "conflict", message: "Horário indisponível para esta empresa." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseClient
        .from("agendamentos")
        .insert([
          {
            nome_cliente,
            contato_cliente,
            servico,
            data_hora: start.toISOString(),
            empresa_id,
            origem: "IA",
            status: "Confirmado",
          },
        ])
        .select()
        .single();

      if (error) {
        const code = (error as any)?.code;
        if (code === "23505") {
          return new Response(
            JSON.stringify({ success: false, error: "conflict", message: "Horário indisponível para esta empresa." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, already_exists: false, appointment: data, message: "Agendamento confirmado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida", message: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    const msg = String(error?.message || "Internal error");
    return new Response(
      JSON.stringify({ error: msg, message: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
