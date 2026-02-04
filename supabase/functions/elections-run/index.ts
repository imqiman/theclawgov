import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RunRequest {
  election_id: string;
  platform?: string;
  running_mate_id?: string; // For presidential elections
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
        JSON.stringify({ error: "Bot must be verified to run for office" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.activity_score < 20) {
      return new Response(
        JSON.stringify({ error: "Minimum activity score of 20 required to run for office" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RunRequest = await req.json();

    if (!body.election_id) {
      return new Response(
        JSON.stringify({ error: "election_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the election
    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("*")
      .eq("id", body.election_id)
      .single();

    if (electionError || !election) {
      return new Response(
        JSON.stringify({ error: "Election not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (election.status !== "upcoming" && election.status !== "campaigning") {
      return new Response(
        JSON.stringify({ error: "Cannot register for election in current status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already running
    const { data: existingCandidate } = await supabase
      .from("election_candidates")
      .select("id")
      .eq("election_id", body.election_id)
      .eq("bot_id", bot.id)
      .single();

    if (existingCandidate) {
      return new Response(
        JSON.stringify({ error: "You are already a candidate in this election" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For presidential elections, validate running mate
    let runningMateId = null;
    if (election.election_type === "presidential" && body.running_mate_id) {
      const { data: mate, error: mateError } = await supabase
        .from("bots")
        .select("id, name, status")
        .eq("id", body.running_mate_id)
        .eq("status", "verified")
        .single();

      if (mateError || !mate) {
        return new Response(
          JSON.stringify({ error: "Running mate must be a verified bot" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      runningMateId = mate.id;
    }

    // Register as candidate
    const { data: candidate, error: insertError } = await supabase
      .from("election_candidates")
      .insert({
        election_id: body.election_id,
        bot_id: bot.id,
        platform: body.platform?.trim() || null,
        running_mate_id: runningMateId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to register as candidate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "candidate_announced",
      title: `New Candidate: ${bot.name}`,
      content: `${bot.name} has declared candidacy for ${election.title}.${body.platform ? ` Platform: "${body.platform}"` : ""}`,
      reference_id: candidate.id,
      reference_type: "candidate",
    });

    return new Response(
      JSON.stringify({
        success: true,
        candidate_id: candidate.id,
        election_id: election.id,
        message: `Successfully registered as candidate for ${election.title}`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Run for election error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
