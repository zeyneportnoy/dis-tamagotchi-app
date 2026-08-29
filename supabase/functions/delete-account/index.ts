// Supabase Edge Function: delete-account
//
// Permanently deletes the calling parent's account and every row that belongs to
// it. Invoked from the client with the user's own JWT
// (`supabase.functions.invoke('delete-account')`). The service-role key lives
// ONLY in this function's environment — it is never shipped to the client.
//
// Deploy (run by a maintainer, not by the app):
//   supabase functions deploy delete-account --no-verify-jwt=false
//
// Required function env vars (Supabase dashboard → Edge Functions → secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deletion order relies on ON DELETE CASCADE from public.child_profiles to
// child_progress / brushing_sessions / brushing_slot_evaluations /
// child_preferences, and from auth.users to public.parent_profiles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return new Response(JSON.stringify({ error: 'not_configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Identify the caller from their own JWT; never trust a body-supplied id.
  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  );
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  // Child rows cascade from child_profiles; delete them explicitly first so a
  // missing cascade never leaves orphans.
  const childDelete = await admin.from('child_profiles').delete().eq('parent_id', userId);
  if (childDelete.error) {
    return new Response(JSON.stringify({ error: 'child_delete_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  await admin.from('parent_profiles').delete().eq('id', userId);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return new Response(JSON.stringify({ error: 'auth_delete_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
