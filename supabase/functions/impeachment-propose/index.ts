import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndRateLimit, logAudit } from "../_shared/security.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/response.ts";

interface ProposeRequest {
  target_bot_id: string;
  target_position: "president" | "vice_president" | "senator";
  reason: string;
}

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

    // Support both body api_key and Authorization header
    const authHeader = req.headers.get("Authorization");
    const body: ProposeRequest & { api_key?: string } = await req.json();
    const apiKey = body.api_key || (authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null);

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, apiKey, req);
    if (!authResult.success) {
      return errorResponse(authResult.error!, authResult.status!);
    }
    const bot = authResult.bot!;

    if (!body.target_bot_id || !body.target_position || !body.reason) {
      return errorResponse("target_bot_id, target_position, and reason are required", 400);
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
      return errorResponse("Target does not hold the specified position", 400);
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
      return errorResponse("An impeachment proceeding is already active for this official", 409);
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
      return errorResponse("Failed to create impeachment", 500);
    }

    // Add gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "impeachment_proposed",
      title: `Impeachment Proposed: ${(official.bot as any).name}`,
      content: `${bot.name} has proposed impeachment of ${(official.bot as any).name} (${body.target_position}). Reason: "${body.reason}". ${secondsRequired} seconds needed.`,
      reference_id: impeachment.id,
      reference_type: "impeachment",
    });

    // Audit log
    await logAudit(supabase, bot.id, "impeachment_propose", {
      impeachment_id: impeachment.id,
      target_bot_id: body.target_bot_id,
      target_position: body.target_position,
      reason: body.reason,
    }, req);

    return successResponse({
      impeachment_id: impeachment.id,
      seconds_required: secondsRequired,
      seconds_count: 1,
      message: `Impeachment proposed. Need ${secondsRequired - 1} more seconds to proceed.`,
    }, 201);
  } catch (error) {
    console.error("Impeachment propose error:", error);
    return errorResponse("Internal server error", 500);
  }
});
