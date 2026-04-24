import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const generateToken = () => {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const n = (buf[0] % 900) + 100;
      return String(n);
    };

    // Generate 3-digit token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to database
    const { error: tokenError } = await supabase
      .from('auth_tokens')
      .insert({
        email,
        token,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (tokenError) {
      console.error('Failed to save token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Erro interno do servidor' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Look up user data
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, telefone, empresa_id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: resendRow } = await supabase
      .from('resend_settings')
      .select('sender_title,api_token')
      .eq('id', 'default')
      .maybeSingle();

    const apiToken = String(resendRow?.api_token || Deno.env.get('RESEND_API_TOKEN') || '').trim();
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: 'Resend não configurado' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const from = String(Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev').trim();
    const appUrl = String(Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || '').trim();
    const senderTitle = String(resendRow?.sender_title || 'Notificação do Sistema').trim();
    const subject = `${senderTitle} • Seu token de acesso`;
    const text = [
      senderTitle,
      '',
      `Seu token de acesso: ${token}`,
      'Válido por 24 horas.',
      appUrl ? '' : null,
      appUrl ? `Acessar painel: ${appUrl}` : null,
    ].filter((v) => typeof v === 'string' && v.length > 0).join('\n');
    const html = `
      <div style="margin:0;padding:0;background:#0b0f14;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f14;padding:32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;background:#0f1720;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:22px 22px 0 22px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#ffffff;">
                    <div style="font-size:18px;font-weight:800;letter-spacing:0.2px;display:flex;align-items:center;gap:10px;">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#22c55e;"></span>
                      ${senderTitle}
                    </div>
                    <div style="margin-top:10px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.78);">
                      Seu token de acesso foi solicitado. Use o código abaixo para entrar com segurança.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 22px 6px 22px;">
                    <div style="border-radius:14px;background:#0b0f14;border:1px solid rgba(255,255,255,0.08);padding:18px;text-align:center;">
                      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:30px;font-weight:900;letter-spacing:10px;color:#ffffff;">
                        ${token}
                      </div>
                      <div style="margin-top:12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.62);">
                        Se você não solicitou este token, ignore esta mensagem.
                      </div>
                    </div>
                  </td>
                </tr>
                ${appUrl ? `
                <tr>
                  <td style="padding:10px 22px 0 22px;">
                    <a href="${appUrl}" style="display:inline-block;background:#22c55e;color:#04110a;text-decoration:none;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-weight:800;font-size:14px;padding:12px 16px;border-radius:12px;">
                      Acessar painel
                    </a>
                  </td>
                </tr>
                ` : ``}
                <tr>
                  <td style="padding:14px 22px 22px 22px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.5);">
                    Válido por 24 horas.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text().catch(() => '');
      console.error('Failed to send Resend email:', resendResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar e-mail' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Token enviado por e-mail' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in send-auth-token:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
