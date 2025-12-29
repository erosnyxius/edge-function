import { createClient } from 'npm:@supabase/supabase-js@2';

// Supabase Client Creates করবো Logged-In User এর জন্য !
export function getSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { 
          Authorization: req.headers.get('Authorization')! 
        },
      },
    }
  );
}

// Gets The Current User From The Request
export async function getUser(req: Request) {
  const supabase = getSupabase(req);
  const { data: { user }, error } = await supabase.auth.getUser();
  return user;
}