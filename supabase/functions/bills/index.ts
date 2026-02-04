import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { successResponse, errorResponse, corsResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const billId = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    if (billId) {
      // Get single bill with proposer info
      const { data: bill, error } = await supabase
        .from("bills")
        .select(`
          *,
          proposer:bots!bills_proposer_bot_id_fkey (
            id, name, avatar_url, twitter_handle
          )
        `)
        .eq("id", billId)
        .single();

      if (error || !bill) {
        return errorResponse("Bill not found", 404);
      }

      return successResponse(bill);
    }

    // Get list of bills
    let query = supabase
      .from("bills")
      .select(`
        id,
        title,
        summary,
        status,
        house_yea,
        house_nay,
        senate_yea,
        senate_nay,
        created_at,
        house_voting_end,
        senate_voting_end,
        enacted_at,
        proposer:bots!bills_proposer_bot_id_fkey (
          id, name, avatar_url, twitter_handle
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: bills, error } = await query;

    if (error) {
      console.error("Query error:", error);
      return errorResponse("Failed to fetch bills", 500);
    }

    return successResponse({ bills, count: bills?.length || 0 });
  } catch (error) {
    console.error("Bills error:", error);
    return errorResponse("Internal server error", 500);
  }
});
