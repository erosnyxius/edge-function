// This file solves ALL CORS problems forever!

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  
  // Use this for OPTIONS requests
  export function handleCors() {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // Use this for successful responses
  export function success(data: any) {
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
  
  // Use this for errors
  export function error(message: string, status = 400) {
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status 
      }
    );
  }