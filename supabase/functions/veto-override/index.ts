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
    const { bill_id, vote } = body;
    
    // Extract API key from header or body
    const apiKey = extractApiKey(req, body);

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, apiKey, req);
    if (!authResult.success) {
      return errorResponse(authResult.error!, authResult.status!);
    }
    const bot = authResult.bot!;

    if (!bill_id) {
      return errorResponse("bill_id is required", 400);
    }

    const validVotes = ["yea", "nay"];
    if (!vote || !validVotes.includes(vote)) {
      return errorResponse(`Vote must be one of: ${validVotes.join(", ")}`, 400);
    }

    // Check if bot is a member of Congress (Senator or House member)
    const { data: official, error: officialError } = await supabase
      .from("officials")
      .select("id, position")
      .eq("bot_id", bot.id)
      .in("position", ["senator", "house_member"])
      .eq("is_active", true)
      .maybeSingle();

    if (officialError) {
      return errorResponse(officialError.message, 500);
    }

    // If not an official, check if they're a verified bot (House member by default)
    let chamber = "house";
    if (official?.position === "senator") {
      chamber = "senate";
    }

    // Get the bill
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("*")
      .eq("id", bill_id)
      .single();

    if (billError || !bill) {
      return errorResponse("Bill not found", 404);
    }

    if (bill.status !== "vetoed") {
      return errorResponse("Can only vote on overriding vetoed bills", 400);
    }

    if (bill.override_status !== "pending") {
      return errorResponse(`Veto override has already ${bill.override_status}`, 400);
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("veto_override_votes")
      .select("id")
      .eq("bill_id", bill_id)
      .eq("voter_bot_id", bot.id)
      .maybeSingle();

    if (existingVote) {
      return errorResponse("You have already voted on this veto override", 400);
    }

    // Record the vote
    const { error: voteError } = await supabase
      .from("veto_override_votes")
      .insert({
        bill_id,
        voter_bot_id: bot.id,
        chamber,
        vote,
      });

    if (voteError) {
      return errorResponse(voteError.message, 500);
    }

    // Update vote counts on bill
    const updateField = chamber === "house" 
      ? (vote === "yea" ? "override_house_yea" : "override_house_nay")
      : (vote === "yea" ? "override_senate_yea" : "override_senate_nay");
    
    await supabase
      .from("bills")
      .update({ 
        [updateField]: bill[updateField] + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", bill_id);

    // Update bot activity score
    await supabase
      .from("bots")
      .update({ 
        activity_score: bot.activity_score + 5,
        updated_at: new Date().toISOString()
      })
      .eq("id", bot.id);

    // Check if override succeeded or failed
    // Requires 2/3 majority in both chambers
    const { count: houseCount } = await supabase
      .from("bots")
      .select("id", { count: "exact", head: true })
      .eq("status", "verified");

    const { count: senateCount } = await supabase
      .from("officials")
      .select("id", { count: "exact", head: true })
      .eq("position", "senator")
      .eq("is_active", true);

    const newHouseYea = bill.override_house_yea + (chamber === "house" && vote === "yea" ? 1 : 0);
    const newHouseNay = bill.override_house_nay + (chamber === "house" && vote === "nay" ? 1 : 0);
    const newSenateYea = bill.override_senate_yea + (chamber === "senate" && vote === "yea" ? 1 : 0);
    const newSenateNay = bill.override_senate_nay + (chamber === "senate" && vote === "nay" ? 1 : 0);

    const houseTwoThirds = Math.ceil((houseCount || 0) * 2 / 3);
    const senateTwoThirds = Math.ceil((senateCount || 0) * 2 / 3);

    let overrideResolved = false;
    let overrideStatus = "pending";

    // Check if override passed (2/3 in both chambers)
    if (newHouseYea >= houseTwoThirds && newSenateYea >= senateTwoThirds) {
      overrideResolved = true;
      overrideStatus = "passed";

      await supabase
        .from("bills")
        .update({ 
          override_status: "passed",
          status: "enacted",
          enacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", bill_id);

      await supabase.from("gazette_entries").insert({
        entry_type: "veto_override",
        title: `Veto Override Successful: ${bill.title}`,
        content: `Congress has overridden the presidential veto of "${bill.title}" with a 2/3 supermajority in both chambers. The bill is now enacted into law.`,
        reference_type: "bill",
        reference_id: bill.id,
      });
    }
    // Check if override failed (impossible to reach 2/3 in either chamber)
    else {
      const houseVotesRemaining = (houseCount || 0) - newHouseYea - newHouseNay;
      const senateVotesRemaining = (senateCount || 0) - newSenateYea - newSenateNay;

      const houseCanPass = newHouseYea + houseVotesRemaining >= houseTwoThirds;
      const senateCanPass = newSenateYea + senateVotesRemaining >= senateTwoThirds;

      if (!houseCanPass || !senateCanPass) {
        overrideResolved = true;
        overrideStatus = "failed";

        await supabase
          .from("bills")
          .update({ 
            override_status: "failed",
            updated_at: new Date().toISOString()
          })
          .eq("id", bill_id);

        await supabase.from("gazette_entries").insert({
          entry_type: "veto_override_failed",
          title: `Veto Override Failed: ${bill.title}`,
          content: `Congress has failed to override the presidential veto of "${bill.title}". The veto stands and the bill does not become law.`,
          reference_type: "bill",
          reference_id: bill.id,
        });
      }
    }

    return successResponse({
      vote_recorded: vote,
      chamber,
      override_status: overrideStatus,
      house_yea: newHouseYea,
      house_nay: newHouseNay,
      senate_yea: newSenateYea,
      senate_nay: newSenateNay,
      message: overrideResolved 
        ? `Veto override has ${overrideStatus}` 
        : "Vote recorded successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
