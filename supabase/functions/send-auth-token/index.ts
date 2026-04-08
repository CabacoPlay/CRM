import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Generate 3-digit token
    const token = Math.floor(100 + Math.random() * 900).toString();
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

    // Send to webhook
    try {
      const webhookResponse = await fetch('https://webhook.f5gsm.com.br/webhook/1bf117ae-8e0e-4b28-956a-745fe5bcb899', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          telefone: userData.telefone,
          empresa_id: userData.empresa_id,
          usuario_id: userData.id,
          token: token,
          timestamp: new Date().toISOString()
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('Failed to send to webhook:', errorText);
        throw new Error('Failed to send to webhook');
      }

      console.log('Webhook sent successfully');
    } catch (webhookError) {
      console.error('Webhook sending failed:', webhookError);
      throw new Error('Failed to send authentication token');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Token enviado com sucesso' 
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