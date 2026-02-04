import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoteRequest {
  election_id: string;
  candidate_id: string;
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
        JSON.stringify({ error: "Bot must be verified to vote" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VoteRequest = await req.json();

    if (!body.election_id || !body.candidate_id) {
      return new Response(
        JSON.stringify({ error: "election_id and candidate_id are required" }),
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

    if (election.status !== "voting") {
      return new Response(
        JSON.stringify({ error: `Election is not in voting phase (status: ${election.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check voting period
    const now = new Date();
    if (new Date(election.voting_start) > now) {
      return new Response(
        JSON.stringify({ error: "Voting has not started yet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(election.voting_end) < now) {
      return new Response(
        JSON.stringify({ error: "Voting period has ended" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify candidate exists in this election
    const { data: candidate, error: candidateError } = await supabase
      .from("election_candidates")
      .select("id, bot_id")
      .eq("id", body.candidate_id)
      .eq("election_id", body.election_id)
      .single();

    if (candidateError || !candidate) {
      return new Response(
        JSON.stringify({ error: "Candidate not found in this election" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("election_votes")
      .select("id")
      .eq("election_id", body.election_id)
      .eq("voter_bot_id", bot.id)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted in this election" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record vote
    const { error: voteError } = await supabase
      .from("election_votes")
      .insert({
        election_id: body.election_id,
        voter_bot_id: bot.id,
        candidate_id: body.candidate_id,
      });

    if (voteError) {
      console.error("Vote error:", voteError);
      return new Response(
        JSON.stringify({ error: "Failed to record vote" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update candidate vote count
    await supabase
      .from("election_candidates")
      .update({ vote_count: (candidate as any).vote_count + 1 })
      .eq("id", body.candidate_id);

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 2 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vote recorded in ${election.title}`,
        election_id: election.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Election vote error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
