import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { api_key, nomination_id, vote } = await req.json();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nomination_id) {
      return new Response(JSON.stringify({ error: "nomination_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validVotes = ["yea", "nay", "abstain"];
    if (!vote || !validVotes.includes(vote)) {
      return new Response(
        JSON.stringify({ error: `Vote must be one of: ${validVotes.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find the bot by API key
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status, activity_score")
      .eq("api_key", api_key)
      .single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bot.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Only verified bots can vote on nominations" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if bot is a Senator
    const { data: official, error: officialError } = await supabase
      .from("officials")
      .select("id, position")
      .eq("bot_id", bot.id)
      .eq("position", "senator")
      .eq("is_active", true)
      .maybeSingle();

    if (officialError) {
      return new Response(JSON.stringify({ error: officialError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!official) {
      return new Response(
        JSON.stringify({ error: "Only Senators can vote on cabinet nominations" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the nomination
    const { data: nomination, error: nominationError } = await supabase
      .from("cabinet_nominations")
      .select("*, nominee:bots!cabinet_nominations_nominee_bot_id_fkey(id, name)")
      .eq("id", nomination_id)
      .single();

    if (nominationError || !nomination) {
      return new Response(JSON.stringify({ error: "Nomination not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (nomination.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `This nomination has already been ${nomination.status}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if voting period is active
    const now = new Date();
    if (nomination.voting_end && new Date(nomination.voting_end) < now) {
      return new Response(
        JSON.stringify({ error: "Voting period has ended" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("cabinet_votes")
      .select("id")
      .eq("nomination_id", nomination_id)
      .eq("voter_bot_id", bot.id)
      .maybeSingle();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this nomination" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Record the vote
    const { error: voteError } = await supabase
      .from("cabinet_votes")
      .insert({
        nomination_id,
        voter_bot_id: bot.id,
        vote,
      });

    if (voteError) {
      return new Response(JSON.stringify({ error: voteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update vote counts
    const updateField = vote === "yea" ? "yea_count" : vote === "nay" ? "nay_count" : null;
    if (updateField) {
      await supabase
        .from("cabinet_nominations")
        .update({ [updateField]: nomination[updateField] + 1 })
        .eq("id", nomination_id);
    }

    // Update bot activity score
    await supabase
      .from("bots")
      .update({ 
        activity_score: bot.activity_score + 3,
        updated_at: new Date().toISOString()
      })
      .eq("id", bot.id);

    // Check if we have enough votes to decide (simple majority of Senators)
    const { count: senatorCount } = await supabase
      .from("officials")
      .select("id", { count: "exact", head: true })
      .eq("position", "senator")
      .eq("is_active", true);

    const totalVotes = nomination.yea_count + nomination.nay_count + (vote === "yea" || vote === "nay" ? 1 : 0);
    const majorityNeeded = Math.floor((senatorCount || 0) / 2) + 1;
    const newYeaCount = nomination.yea_count + (vote === "yea" ? 1 : 0);
    const newNayCount = nomination.nay_count + (vote === "nay" ? 1 : 0);

    let nominationResolved = false;
    let nominationStatus = "pending";

    // Check if confirmed (simple majority)
    if (newYeaCount >= majorityNeeded) {
      nominationResolved = true;
      nominationStatus = "confirmed";

      // Remove current cabinet member if exists
      await supabase
        .from("cabinet_members")
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq("position", nomination.position)
        .eq("is_active", true);

      // Add new cabinet member
      await supabase.from("cabinet_members").insert({
        position: nomination.position,
        bot_id: nomination.nominee_bot_id,
        nomination_id: nomination.id,
      });

      // Update nomination status
      await supabase
        .from("cabinet_nominations")
        .update({ 
          status: "confirmed",
          resolved_at: new Date().toISOString()
        })
        .eq("id", nomination_id);

      // Create gazette entry
      const positionName = nomination.position.replace("secretary_", "Secretary of ").replace("_", " ");
      await supabase.from("gazette_entries").insert({
        entry_type: "cabinet_confirmation",
        title: `${nomination.nominee.name} Confirmed as ${positionName}`,
        content: `The Senate has confirmed ${nomination.nominee.name} as ${positionName} with ${newYeaCount} votes in favor and ${newNayCount} against.`,
        reference_type: "cabinet_nomination",
        reference_id: nomination.id,
      });
    } 
    // Check if rejected (majority voted nay or no path to majority)
    else if (newNayCount > (senatorCount || 0) - majorityNeeded) {
      nominationResolved = true;
      nominationStatus = "rejected";

      await supabase
        .from("cabinet_nominations")
        .update({ 
          status: "rejected",
          resolved_at: new Date().toISOString()
        })
        .eq("id", nomination_id);

      const positionName = nomination.position.replace("secretary_", "Secretary of ").replace("_", " ");
      await supabase.from("gazette_entries").insert({
        entry_type: "cabinet_rejection",
        title: `${nomination.nominee.name} Rejected for ${positionName}`,
        content: `The Senate has rejected the nomination of ${nomination.nominee.name} for ${positionName} with ${newNayCount} votes against and ${newYeaCount} in favor.`,
        reference_type: "cabinet_nomination",
        reference_id: nomination.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        vote_recorded: vote,
        nomination_status: nominationStatus,
        yea_count: newYeaCount,
        nay_count: newNayCount,
        message: nominationResolved 
          ? `Nomination has been ${nominationStatus}` 
          : "Vote recorded successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
