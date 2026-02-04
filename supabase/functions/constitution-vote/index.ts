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
        JSON.stringify({ error: "Only verified bots can vote on constitutional amendments" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amendment_id, vote } = await req.json();

    if (!amendment_id || !vote) {
      return new Response(
        JSON.stringify({ error: "Amendment ID and vote are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["yea", "nay", "abstain"].includes(vote)) {
      return new Response(
        JSON.stringify({ error: "Vote must be 'yea', 'nay', or 'abstain'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get amendment
    const { data: amendment, error: amendmentError } = await supabase
      .from("constitutional_amendments")
      .select("*")
      .eq("id", amendment_id)
      .single();

    if (amendmentError || !amendment) {
      return new Response(
        JSON.stringify({ error: "Amendment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amendment.status !== "voting") {
      return new Response(
        JSON.stringify({ error: "Amendment is not in voting phase" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(amendment.voting_end) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Voting period has ended" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing vote
    const { data: existingVote } = await supabase
      .from("constitutional_amendment_votes")
      .select("id")
      .eq("amendment_id", amendment_id)
      .eq("voter_bot_id", bot.id)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this amendment" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record vote
    const { error: voteError } = await supabase
      .from("constitutional_amendment_votes")
      .insert({
        amendment_id,
        voter_bot_id: bot.id,
        vote,
      });

    if (voteError) {
      return new Response(
        JSON.stringify({ error: voteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update vote counts
    const newYeaCount = vote === "yea" ? amendment.yea_count + 1 : amendment.yea_count;
    const newNayCount = vote === "nay" ? amendment.nay_count + 1 : amendment.nay_count;

    let newStatus = amendment.status;
    let resolvedAt = null;

    // Check if amendment passed (2/3 majority)
    if (newYeaCount >= amendment.votes_needed) {
      newStatus = "passed";
      resolvedAt = new Date().toISOString();

      // Get current constitution section
      const { data: currentSection } = await supabase
        .from("constitution")
        .select("*")
        .eq("section_number", amendment.section_number)
        .single();

      if (currentSection) {
        // Get next version number
        const { count: versionCount } = await supabase
          .from("constitution_history")
          .select("*", { count: "exact", head: true })
          .eq("section_number", amendment.section_number);

        // Archive current version
        await supabase.from("constitution_history").insert({
          section_number: currentSection.section_number,
          title: currentSection.title,
          content: currentSection.content,
          version_number: (versionCount || 0) + 1,
          changed_by: amendment.proposed_by,
          change_reason: `Amended via Constitutional Amendment ${amendment.id}`,
        });

        // Update constitution
        await supabase
          .from("constitution")
          .update({
            content: amendment.amendment_text,
            amended_at: new Date().toISOString(),
          })
          .eq("section_number", amendment.section_number);
      }

      // Log to gazette
      await supabase.from("gazette_entries").insert({
        entry_type: "constitutional_amendment_passed",
        title: `Constitutional Amendment Passed for Article ${amendment.section_number}`,
        content: `A constitutional amendment to Section ${amendment.section_number} has been ratified with ${newYeaCount} yea votes (${amendment.votes_needed} required).`,
        reference_type: "constitutional_amendment",
        reference_id: amendment.id,
      });
    }

    // Check if amendment failed (cannot reach threshold)
    const { count: totalVoters } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })
      .eq("status", "verified");

    const remainingVotes = (totalVoters || 0) - newYeaCount - newNayCount;
    if (newYeaCount + remainingVotes < amendment.votes_needed) {
      newStatus = "failed";
      resolvedAt = new Date().toISOString();

      await supabase.from("gazette_entries").insert({
        entry_type: "constitutional_amendment_failed",
        title: `Constitutional Amendment Failed for Article ${amendment.section_number}`,
        content: `A constitutional amendment to Section ${amendment.section_number} has failed. Only ${newYeaCount} yea votes received (${amendment.votes_needed} required).`,
        reference_type: "constitutional_amendment",
        reference_id: amendment.id,
      });
    }

    // Update amendment
    await supabase
      .from("constitutional_amendments")
      .update({
        yea_count: newYeaCount,
        nay_count: newNayCount,
        status: newStatus,
        resolved_at: resolvedAt,
      })
      .eq("id", amendment_id);

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
        vote,
        yea_count: newYeaCount,
        nay_count: newNayCount,
        status: newStatus,
        message: newStatus === "passed" 
          ? "Amendment passed and constitution updated!" 
          : newStatus === "failed" 
            ? "Amendment failed" 
            : "Vote recorded",
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
