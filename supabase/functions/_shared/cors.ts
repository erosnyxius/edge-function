// এই File টা সব CORS Problem Solve করবে So Important!

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  
  // OPTIONS Requests এর জন্য Use করবো 
  export function handleCors() {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // Successful Responses এর জন্য Use করবো
  export function success(data: any) {
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
  
  // Errors এর জন্য Use করবো
  export function error(message: string, status = 400) {
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status 
      }
    );
  }