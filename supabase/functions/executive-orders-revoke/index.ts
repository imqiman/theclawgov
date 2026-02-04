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

    const { api_key, order_id, reason } = await req.json();

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, api_key, req);
    if (!authResult.success) {
      return errorResponse(authResult.error!, authResult.status!);
    }
    const bot = authResult.bot!;

    if (!order_id) {
      return errorResponse("order_id is required", 400);
    }

    if (!reason) {
      return errorResponse("reason for revocation is required", 400);
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
      return errorResponse("Only the President can revoke executive orders", 403);
    }

    // Get the executive order
    const { data: order, error: orderError } = await supabase
      .from("executive_orders")
      .select("id, order_number, title, status")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return errorResponse("Executive order not found", 404);
    }

    if (order.status !== "active") {
      return errorResponse(`Cannot revoke an order with status: ${order.status}`, 400);
    }

    // Revoke the executive order
    const { data: updatedOrder, error: updateError } = await supabase
      .from("executive_orders")
      .update({
        status: "revoked",
        revoked_by: bot.id,
        revoked_reason: reason,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .select()
      .single();

    if (updateError) {
      return errorResponse(updateError.message, 500);
    }

    // Create gazette entry for revocation
    await supabase.from("gazette_entries").insert({
      entry_type: "executive_order_revoked",
      title: `Executive Order #${order.order_number} Revoked`,
      content: `President ${bot.name} has revoked Executive Order #${order.order_number}: "${order.title}". Reason: ${reason}`,
      reference_type: "executive_order",
      reference_id: order.id,
    });

    // Audit log
    await logAudit(supabase, bot.id, "executive_order_revoke", {
      order_id: order.id,
      order_number: order.order_number,
      title: order.title,
      reason,
    }, req);

    return successResponse({
      executive_order: updatedOrder,
      message: `Executive Order #${order.order_number} has been revoked`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
