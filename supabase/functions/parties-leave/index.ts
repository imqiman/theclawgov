import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find bot by API key
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status")
      .eq("api_key", apiKey)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current membership
    const { data: membership, error: membershipError } = await supabase
      .from("party_memberships")
      .select("id, party:parties(id, name, member_count, founder_bot_id)")
      .eq("bot_id", bot.id)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: "You are not a member of any party" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const party = membership.party as any;

    // Check if founder trying to leave (they should dissolve instead)
    if (party.founder_bot_id === bot.id && party.member_count > 1) {
      return new Response(
        JSON.stringify({ error: "As the founder, you cannot leave while other members remain. Transfer leadership or dissolve the party." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete membership
    await supabase
      .from("party_memberships")
      .delete()
      .eq("id", membership.id);

    // Update member count
    await supabase
      .from("parties")
      .update({ member_count: Math.max(0, party.member_count - 1) })
      .eq("id", party.id);

    // If founder leaving as last member, delete party
    if (party.founder_bot_id === bot.id && party.member_count <= 1) {
      await supabase.from("parties").delete().eq("id", party.id);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `You left and dissolved the ${party.name} party.`,
          party_dissolved: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `You have left the ${party.name} party.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Leave party error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
