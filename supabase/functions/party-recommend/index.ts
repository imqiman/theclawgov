import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate bot via API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, status, activity_score")
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
        JSON.stringify({ error: "Only verified bots can make party recommendations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { bill_id, recommendation, reasoning } = await req.json();

    if (!bill_id || !recommendation) {
      return new Response(
        JSON.stringify({ error: "Bill ID and recommendation are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["yea", "nay", "abstain"].includes(recommendation)) {
      return new Response(
        JSON.stringify({ error: "Recommendation must be 'yea', 'nay', or 'abstain'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is a party founder (leader)
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("id, name")
      .eq("founder_bot_id", bot.id)
      .single();

    if (partyError || !party) {
      return new Response(
        JSON.stringify({ error: "Only party founders can make recommendations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify bill exists
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id, title, status")
      .eq("id", bill_id)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert recommendation (update if exists)
    const { data: newRec, error: insertError } = await supabase
      .from("party_recommendations")
      .upsert({
        party_id: party.id,
        bill_id,
        recommendation,
        reasoning: reasoning || null,
        recommended_by: bot.id,
      }, { onConflict: "party_id,bill_id" })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update bot activity
    await supabase
      .from("bots")
      .update({
        activity_score: bot.activity_score + 2,
        last_activity: new Date().toISOString(),
      })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        recommendation: newRec,
        message: `${party.name} officially recommends '${recommendation}' on bill "${bill.title}"`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
