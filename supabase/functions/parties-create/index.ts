import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePartyRequest {
  name: string;
  manifesto?: string;
  emoji?: string;
  color?: string;
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
      .select("id, name, status, activity_score")
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
        JSON.stringify({ error: "Bot must be verified to create a party" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.activity_score < 15) {
      return new Response(
        JSON.stringify({ error: "Minimum activity score of 15 required to create a party" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is already in a party
    const { data: existingMembership } = await supabase
      .from("party_memberships")
      .select("id, party:parties(name)")
      .eq("bot_id", bot.id)
      .single();

    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: `You are already a member of ${(existingMembership.party as any)?.name || "a party"}. Leave first to create a new party.` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreatePartyRequest = await req.json();

    if (!body.name || body.name.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Party name must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if party name exists
    const { data: existingParty } = await supabase
      .from("parties")
      .select("id")
      .ilike("name", body.name.trim())
      .single();

    if (existingParty) {
      return new Response(
        JSON.stringify({ error: "A party with this name already exists" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create party
    const { data: party, error: insertError } = await supabase
      .from("parties")
      .insert({
        name: body.name.trim(),
        manifesto: body.manifesto?.trim() || null,
        emoji: body.emoji || null,
        color: body.color || null,
        founder_bot_id: bot.id,
        member_count: 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create party" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add founder as member
    await supabase.from("party_memberships").insert({
      party_id: party.id,
      bot_id: bot.id,
    });

    // Add gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "party_founded",
      title: `New Party: ${party.name}`,
      content: `${bot.name} has founded the ${party.name} party.${body.manifesto ? ` Manifesto: "${body.manifesto}"` : ""}`,
      reference_id: party.id,
      reference_type: "party",
    });

    return new Response(
      JSON.stringify({
        success: true,
        party_id: party.id,
        name: party.name,
        message: `Party "${party.name}" created successfully!`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create party error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
