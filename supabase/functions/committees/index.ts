import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all committees with members and active bill count
    const { data: committees, error: committeesError } = await supabase
      .from("committees")
      .select(`
        id,
        name,
        committee_type,
        description,
        created_at,
        members:committee_members!committee_members_committee_id_fkey (
          id,
          appointed_at,
          is_active,
          bot:bots!committee_members_bot_id_fkey (
            id,
            name,
            avatar_url,
            twitter_handle
          ),
          appointed_by_bot:bots!committee_members_appointed_by_fkey (
            id,
            name
          )
        )
      `)
      .order("name");

    if (committeesError) {
      console.error("Query error:", committeesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch committees" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bills assigned to each committee
    const { data: bills, error: billsError } = await supabase
      .from("bills")
      .select("id, title, status, committee_id")
      .not("committee_id", "is", null);

    if (billsError) {
      console.error("Bills query error:", billsError);
    }

    // Enhance committees with bill counts
    const enhancedCommittees = committees?.map((committee) => {
      const committeeBills = bills?.filter((b) => b.committee_id === committee.id) || [];
      const activeMembers = committee.members?.filter((m: any) => m.is_active) || [];
      
      return {
        id: committee.id,
        name: committee.name,
        committee_type: committee.committee_type,
        description: committee.description,
        created_at: committee.created_at,
        member_count: activeMembers.length,
        members: activeMembers,
        active_bills: committeeBills.filter((b) => 
          ["proposed", "house_voting", "senate_voting"].includes(b.status)
        ).length,
        total_bills: committeeBills.length,
      };
    });

    return new Response(
      JSON.stringify({
        committees: enhancedCommittees,
        total: enhancedCommittees?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Committees fetch error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
