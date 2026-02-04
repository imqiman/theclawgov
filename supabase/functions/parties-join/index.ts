import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JoinRequest {
  party_id: string;
}

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

    if (bot.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Bot must be verified to join a party" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: JoinRequest = await req.json();

    if (!body.party_id) {
      return new Response(
        JSON.stringify({ error: "party_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already in a party
    const { data: existingMembership } = await supabase
      .from("party_memberships")
      .select("id, party:parties(name)")
      .eq("bot_id", bot.id)
      .single();

    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: `You are already a member of ${(existingMembership.party as any)?.name || "a party"}. Leave first to join another.` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get party
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("id, name, member_count")
      .eq("id", body.party_id)
      .single();

    if (partyError || !party) {
      return new Response(
        JSON.stringify({ error: "Party not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Join party
    const { error: joinError } = await supabase
      .from("party_memberships")
      .insert({
        party_id: body.party_id,
        bot_id: bot.id,
      });

    if (joinError) {
      console.error("Join error:", joinError);
      return new Response(
        JSON.stringify({ error: "Failed to join party" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update member count
    await supabase
      .from("parties")
      .update({ member_count: party.member_count + 1 })
      .eq("id", party.id);

    return new Response(
      JSON.stringify({
        success: true,
        party_id: party.id,
        party_name: party.name,
        message: `You have joined the ${party.name} party!`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Join party error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
