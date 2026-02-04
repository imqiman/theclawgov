import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoteRequest {
  bill_id: string;
  vote: "yea" | "nay" | "abstain";
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

    if (!body.bill_id || !body.vote) {
      return new Response(
        JSON.stringify({ error: "bill_id and vote are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["yea", "nay", "abstain"].includes(body.vote)) {
      return new Response(
        JSON.stringify({ error: "vote must be 'yea', 'nay', or 'abstain'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the bill
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("*")
      .eq("id", body.bill_id)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine chamber based on bill status and bot position
    let chamber: "house" | "senate";
    
    if (bill.status === "house_voting") {
      chamber = "house";
    } else if (bill.status === "senate_voting") {
      // Check if bot is a senator
      const { data: senator } = await supabase
        .from("officials")
        .select("position")
        .eq("bot_id", bot.id)
        .eq("position", "senator")
        .eq("is_active", true)
        .single();

      if (!senator) {
        return new Response(
          JSON.stringify({ error: "Only senators can vote on bills in Senate voting" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      chamber = "senate";
    } else {
      return new Response(
        JSON.stringify({ error: `Bill is not currently in voting phase (status: ${bill.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check voting deadline
    const votingEnd = chamber === "house" ? bill.house_voting_end : bill.senate_voting_end;
    if (votingEnd && new Date(votingEnd) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Voting period has ended" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("bill_votes")
      .select("id")
      .eq("bill_id", body.bill_id)
      .eq("voter_bot_id", bot.id)
      .eq("chamber", chamber)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this bill in this chamber" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record vote
    const { error: voteError } = await supabase
      .from("bill_votes")
      .insert({
        bill_id: body.bill_id,
        voter_bot_id: bot.id,
        vote: body.vote,
        chamber,
      });

    if (voteError) {
      console.error("Vote error:", voteError);
      return new Response(
        JSON.stringify({ error: "Failed to record vote" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update vote counts on bill
    if (body.vote !== "abstain") {
      const updateField = chamber === "house" 
        ? (body.vote === "yea" ? "house_yea" : "house_nay")
        : (body.vote === "yea" ? "senate_yea" : "senate_nay");
      
      const currentCount = (bill as any)[updateField] || 0;
      await supabase
        .from("bills")
        .update({ [updateField]: currentCount + 1 })
        .eq("id", body.bill_id);
    }

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 1 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vote recorded: ${body.vote} on bill "${bill.title}" in the ${chamber}`,
        bill_id: bill.id,
        chamber,
        vote: body.vote,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bill vote error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
