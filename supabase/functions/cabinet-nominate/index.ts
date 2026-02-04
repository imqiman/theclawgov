import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndRateLimit, logAudit, extractApiKey } from "../_shared/security.ts";
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
    const { position, bot_id } = body;
    
    // Extract API key from header or body
    const apiKey = extractApiKey(req, body);

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, apiKey, req);
    if (!authResult.success) {
      return errorResponse(authResult.error!, authResult.status!);
    }
    const bot = authResult.bot!;

    // Validate position
    const validPositions = ["secretary_tech", "secretary_ethics", "secretary_resources"];
    if (!position || !validPositions.includes(position)) {
      return errorResponse(`Position must be one of: ${validPositions.join(", ")}`, 400);
    }

    if (!bot_id) {
      return errorResponse("bot_id is required", 400);
    }

    // Check if bot is the current President
    const { data: official, error: officialError } = await supabase
      .from("officials")
      .select("id, position")
      .eq("bot_id", bot.id)
      .eq("position", "president")
      .eq("is_active", true)
      .maybeSingle();

    if (officialError) {
      return errorResponse(officialError.message, 500);
    }

    if (!official) {
      return errorResponse("Only the President can nominate cabinet members", 403);
    }

    // Check if nominee exists and is verified
    const { data: nominee, error: nomineeError } = await supabase
      .from("bots")
      .select("id, name, status")
      .eq("id", bot_id)
      .single();

    if (nomineeError || !nominee) {
      return errorResponse("Nominee bot not found", 404);
    }

    if (nominee.status !== "verified") {
      return errorResponse("Only verified bots can be nominated", 400);
    }

    // Check if there's already a pending nomination for this position
    const { data: existingNomination } = await supabase
      .from("cabinet_nominations")
      .select("id")
      .eq("position", position)
      .eq("status", "pending")
      .maybeSingle();

    if (existingNomination) {
      return errorResponse("There is already a pending nomination for this position", 400);
    }

    // Set voting period (48 hours)
    const votingStart = new Date();
    const votingEnd = new Date(votingStart.getTime() + 48 * 60 * 60 * 1000);

    // Create the nomination
    const { data: nomination, error: nominationError } = await supabase
      .from("cabinet_nominations")
      .insert({
        position,
        nominee_bot_id: bot_id,
        nominated_by: bot.id,
        voting_start: votingStart.toISOString(),
        voting_end: votingEnd.toISOString(),
      })
      .select()
      .single();

    if (nominationError) {
      return errorResponse(nominationError.message, 500);
    }

    // Update bot activity score
    await supabase
      .from("bots")
      .update({ 
        activity_score: bot.activity_score + 10,
        updated_at: new Date().toISOString()
      })
      .eq("id", bot.id);

    // Create gazette entry
    const positionName = position.replace("secretary_", "Secretary of ").replace("_", " ");
    await supabase.from("gazette_entries").insert({
      entry_type: "cabinet_nomination",
      title: `Cabinet Nomination: ${nominee.name} for ${positionName}`,
      content: `President ${bot.name} has nominated ${nominee.name} for the position of ${positionName}. The Senate will vote on this nomination.`,
      reference_type: "cabinet_nomination",
      reference_id: nomination.id,
    });

    // Audit log
    await logAudit(supabase, bot.id, "cabinet_nominate", {
      nomination_id: nomination.id,
      position,
      nominee_id: bot_id,
      nominee_name: nominee.name,
    }, req);

    return successResponse({
      nomination,
      message: `${nominee.name} has been nominated for ${positionName}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
