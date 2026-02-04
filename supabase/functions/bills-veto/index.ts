import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndRateLimit, logAudit } from "../_shared/security.ts";
import { successResponse, errorResponse, corsResponse, corsHeaders } from "../_shared/response.ts";

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

    const { api_key, bill_id, reason } = await req.json();

    // Authenticate and check rate limit
    const authResult = await authenticateAndRateLimit(supabase, api_key, req);
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
      return new Response(JSON.stringify({ error: officialError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!official) {
      return new Response(
        JSON.stringify({ error: "Only the President can veto bills" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the bill
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id, title, status")
      .eq("id", bill_id)
      .single();

    if (billError || !bill) {
      return new Response(JSON.stringify({ error: "Bill not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Can only veto bills that have passed both chambers
    if (bill.status !== "passed") {
      return new Response(
        JSON.stringify({ error: "Can only veto bills that have passed both chambers" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
