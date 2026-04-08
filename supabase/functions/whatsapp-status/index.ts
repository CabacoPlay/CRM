import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_url, nome_api, apikey } = await req.json();

    const baseUrl = String(api_url || '').replace(/\/+$/, '');
    const instance = encodeURIComponent(String(nome_api || ''));

    console.log('Checking WhatsApp status:', { api_url: baseUrl, nome_api: instance });

    const url = `${baseUrl}/instance/connectionState/${instance}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': String(apikey || ''),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('WhatsApp status response:', data);

    // Map status from API response
    let status = 'conectando';
    if (data.instance?.state === 'close') {
      status = 'desconectado';
    } else if (data.instance?.state === 'open') {
      status = 'conectado';
    }

    return new Response(JSON.stringify({
      ...data,
      mappedStatus: status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in whatsapp-status function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to get WhatsApp status',
      mappedStatus: 'desconectado'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});