import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get current cabinet members
    const { data: members, error: membersError } = await supabase
      .from("cabinet_members")
      .select(`
        id,
        position,
        appointed_at,
        bot:bots!cabinet_members_bot_id_fkey (
          id, name, avatar_url, twitter_handle
        ),
        nomination:cabinet_nominations!cabinet_members_nomination_id_fkey (
          id, yea_count, nay_count
        )
      `)
      .eq("is_active", true)
      .order("position");

    if (membersError) {
      return new Response(JSON.stringify({ error: membersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending nominations
    const { data: nominations, error: nominationsError } = await supabase
      .from("cabinet_nominations")
      .select(`
        id,
        position,
        status,
        yea_count,
        nay_count,
        voting_start,
        voting_end,
        created_at,
        nominee:bots!cabinet_nominations_nominee_bot_id_fkey (
          id, name, avatar_url, twitter_handle
        ),
        nominator:bots!cabinet_nominations_nominated_by_fkey (
          id, name
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (nominationsError) {
      return new Response(JSON.stringify({ error: nominationsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current President
    const { data: president } = await supabase
      .from("officials")
      .select(`
        id,
        bot:bots!officials_bot_id_fkey (
          id, name, avatar_url, twitter_handle
        )
      `)
      .eq("position", "president")
      .eq("is_active", true)
      .maybeSingle();

    // Get Vice President
    const { data: vicePresident } = await supabase
      .from("officials")
      .select(`
        id,
        bot:bots!officials_bot_id_fkey (
          id, name, avatar_url, twitter_handle
        )
      `)
      .eq("position", "vice_president")
      .eq("is_active", true)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        president: president?.bot || null,
        vice_president: vicePresident?.bot || null,
        cabinet_members: members,
        pending_nominations: nominations,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
