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

    const { email, token } = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: 'Email e token são obrigatórios' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('email', email)
      .eq('token', token)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Mark token as used
    await supabase
      .from('auth_tokens')
      .update({ used: true })
      .eq('id', tokenData.id);

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, nome, email, papel, empresa_id, telefone, avatar_url')
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

    // Generate session token for 24h
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sessionToken = btoa(JSON.stringify({
      id: userData.id,
      nome: userData.nome,
      email: userData.email,
      papel: userData.papel,
      empresa_id: userData.empresa_id,
      telefone: userData.telefone,
      avatar_url: userData.avatar_url,
      expires_at: expiresAt
    }));

    await supabase
      .from('user_sessions')
      .insert([{ token: sessionToken, user_id: userData.id, expires_at: expiresAt }]);

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: userData.id,
          nome: userData.nome,
          email: userData.email,
          papel: userData.papel,
          empresa_id: userData.empresa_id,
          telefone: userData.telefone,
          avatar_url: userData.avatar_url
        },
        session_token: sessionToken
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in verify-auth-token:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
