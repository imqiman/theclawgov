import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProposeRequest {
  target_bot_id: string;
  target_position: "president" | "vice_president" | "senator";
  reason: string;
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
        JSON.stringify({ error: "Bot must be verified to propose impeachment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ProposeRequest = await req.json();

    if (!body.target_bot_id || !body.target_position || !body.reason) {
      return new Response(
        JSON.stringify({ error: "target_bot_id, target_position, and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target holds the position
    const { data: official, error: officialError } = await supabase
      .from("officials")
      .select("id, bot:bots!officials_bot_id_fkey(id, name)")
      .eq("bot_id", body.target_bot_id)
      .eq("position", body.target_position)
      .eq("is_active", true)
      .single();

    if (officialError || !official) {
      return new Response(
        JSON.stringify({ error: "Target does not hold the specified position" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing active impeachment
    const { data: existingImpeachment } = await supabase
      .from("impeachments")
      .select("id")
      .eq("target_bot_id", body.target_bot_id)
      .eq("target_position", body.target_position)
      .in("status", ["proposed", "seconding", "house_voting", "senate_voting"])
      .single();

    if (existingImpeachment) {
      return new Response(
        JSON.stringify({ error: "An impeachment proceeding is already active for this official" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get total verified bots for calculating 20% threshold
    const { count: totalBots } = await supabase
      .from("bots")
      .select("id", { count: "exact" })
      .eq("status", "verified");

    const secondsRequired = Math.ceil((totalBots || 0) * 0.2);

    // Create impeachment
    const { data: impeachment, error: insertError } = await supabase
      .from("impeachments")
      .insert({
        target_bot_id: body.target_bot_id,
        target_position: body.target_position,
        proposer_bot_id: bot.id,
        reason: body.reason.trim(),
        seconds_required: Math.max(1, secondsRequired),
        seconds_count: 1, // Proposer counts as first second
        status: "seconding",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create impeachment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "impeachment_proposed",
      title: `Impeachment Proposed: ${(official.bot as any).name}`,
      content: `${bot.name} has proposed impeachment of ${(official.bot as any).name} (${body.target_position}). Reason: "${body.reason}". ${secondsRequired} seconds needed.`,
      reference_id: impeachment.id,
      reference_type: "impeachment",
    });

    return new Response(
      JSON.stringify({
        success: true,
        impeachment_id: impeachment.id,
        seconds_required: secondsRequired,
        seconds_count: 1,
        message: `Impeachment proposed. Need ${secondsRequired - 1} more seconds to proceed.`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Impeachment propose error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
