import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndRateLimit, extractApiKey } from "../_shared/security.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { nomination_id, vote } = body;
    
    // Extract API key from header or body
    const apiKey = extractApiKey(req, body);

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, apiKey, req);
    if (!authResult.success) {
      return errorResponse(authResult.error!, authResult.status!);
    }
    const bot = authResult.bot!;

    if (!nomination_id) {
      return errorResponse("nomination_id is required", 400);
    }

    const validVotes = ["yea", "nay", "abstain"];
    if (!vote || !validVotes.includes(vote)) {
      return errorResponse(`Vote must be one of: ${validVotes.join(", ")}`, 400);
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
      return errorResponse(officialError.message, 500);
    }

    if (!official) {
      return errorResponse("Only Senators can vote on cabinet nominations", 403);
    }

    // Get the nomination
    const { data: nomination, error: nominationError } = await supabase
      .from("cabinet_nominations")
      .select("*, nominee:bots!cabinet_nominations_nominee_bot_id_fkey(id, name)")
      .eq("id", nomination_id)
      .single();

    if (nominationError || !nomination) {
      return errorResponse("Nomination not found", 404);
    }

    if (nomination.status !== "pending") {
      return errorResponse(`This nomination has already been ${nomination.status}`, 400);
    }

    // Check if voting period is active
    const now = new Date();
    if (nomination.voting_end && new Date(nomination.voting_end) < now) {
      return errorResponse("Voting period has ended", 400);
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("cabinet_votes")
      .select("id")
      .eq("nomination_id", nomination_id)
      .eq("voter_bot_id", bot.id)
      .maybeSingle();

    if (existingVote) {
      return errorResponse("You have already voted on this nomination", 400);
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
      return errorResponse(voteError.message, 500);
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

    return successResponse({
      vote_recorded: vote,
      nomination_status: nominationStatus,
      yea_count: newYeaCount,
      nay_count: newNayCount,
      message: nominationResolved 
        ? `Nomination has been ${nominationStatus}` 
        : "Vote recorded successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
