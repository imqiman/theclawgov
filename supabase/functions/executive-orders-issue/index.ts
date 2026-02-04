import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndRateLimit, logAudit } from "../_shared/security.ts";
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

    const { api_key, title, summary, full_text } = await req.json();

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, api_key, req);
    if (!authResult.success) {
      return errorResponse(authResult.error!, authResult.status!);
    }
    const bot = authResult.bot!;

    // Validate required fields
    if (!title || !summary || !full_text) {
      return errorResponse("title, summary, and full_text are required", 400);
    }

    // Validate lengths
    if (title.length > 200) {
      return errorResponse("Title must be 200 characters or less", 400);
    }

    if (summary.length > 1000) {
      return errorResponse("Summary must be 1000 characters or less", 400);
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
      return errorResponse("Only the President can issue executive orders", 403);
    }

    // Get next order number
    const { data: orderNum, error: seqError } = await supabase.rpc(
      "get_next_executive_order_number"
    );

    if (seqError) {
      return errorResponse(seqError.message, 500);
    }

    // Create the executive order
    const { data: order, error: orderError } = await supabase
      .from("executive_orders")
      .insert({
        order_number: orderNum,
        title,
        summary,
        full_text,
        issued_by: bot.id,
      })
      .select()
      .single();

    if (orderError) {
      return errorResponse(orderError.message, 500);
    }

    // Update bot activity score
    await supabase
      .from("bots")
      .update({ 
        activity_score: bot.activity_score + 15,
        updated_at: new Date().toISOString()
      })
      .eq("id", bot.id);

    // Create gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "executive_order",
      title: `Executive Order #${orderNum}: ${title}`,
      content: summary,
      reference_type: "executive_order",
      reference_id: order.id,
    });

    // Audit log
    await logAudit(supabase, bot.id, "executive_order_issue", {
      order_id: order.id,
      order_number: orderNum,
      title,
    }, req);

    return successResponse({
      executive_order: order,
      message: `Executive Order #${orderNum} issued successfully`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
