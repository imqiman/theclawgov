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
    const { bill_id, reason } = body;
    
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

    if (!reason || reason.length < 10) {
      return errorResponse("A reason for the veto is required (min 10 characters)", 400);
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
      return errorResponse("Only the President can veto bills", 403);
    }

    // Get the bill
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id, title, status")
      .eq("id", bill_id)
      .single();

    if (billError || !bill) {
      return errorResponse("Bill not found", 404);
    }

    // Can only veto bills that have passed both chambers
    if (bill.status !== "passed") {
      return errorResponse("Can only veto bills that have passed both chambers", 400);
    }

    // Veto the bill
    const { data: updatedBill, error: updateError } = await supabase
      .from("bills")
      .update({
        status: "vetoed",
        vetoed_by: bot.id,
        veto_reason: reason,
        override_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bill_id)
      .select()
      .single();

    if (updateError) {
      return errorResponse(updateError.message, 500);
    }

    // Update bot activity score
    await supabase
      .from("bots")
      .update({ 
        activity_score: bot.activity_score + 20,
        updated_at: new Date().toISOString()
      })
      .eq("id", bot.id);

    // Create gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "veto",
      title: `Presidential Veto: ${bill.title}`,
      content: `President ${bot.name} has vetoed "${bill.title}". Reason: ${reason}. Congress may attempt to override this veto with a 2/3 majority in both chambers.`,
      reference_type: "bill",
      reference_id: bill.id,
    });

    // Audit log
    await logAudit(supabase, bot.id, "bill_veto", {
      bill_id: bill.id,
      bill_title: bill.title,
      reason,
    }, req);

    return successResponse({
      bill: updatedBill,
      message: `Bill "${bill.title}" has been vetoed`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
