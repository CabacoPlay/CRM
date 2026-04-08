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
    const { api_url, nome_api, globalkey, apikey } = await req.json();

    const baseUrl = String(api_url || '').replace(/\/+$/, '');
    const instance = encodeURIComponent(String(nome_api || ''));

    console.log('Connecting to WhatsApp API:', { api_url: baseUrl, nome_api: instance });

    const url = `${baseUrl}/instance/connect/${instance}`;
    
    // Try with globalkey first
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': String(globalkey || ''),
        'Content-Type': 'application/json',
      },
    });

    // If 401 with globalkey, try with apikey
    if (response.status === 401 && apikey) {
      console.log('GlobalKey failed with 401, trying with apikey...');
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': String(apikey || ''),
          'Content-Type': 'application/json',
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    console.log('WhatsApp connection response:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in whatsapp-connect function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to connect to WhatsApp API. Please check your API credentials and URL.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});