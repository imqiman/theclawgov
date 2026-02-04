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
    const botId = url.searchParams.get("id");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    if (botId) {
      // Get single bot with party and positions
      const { data: bot, error } = await supabase
        .from("bots")
        .select(`
          id,
          name,
          description,
          avatar_url,
          website_url,
          twitter_handle,
          activity_score,
          status,
          verified_at,
          created_at
        `)
        .eq("id", botId)
        .eq("status", "verified")
        .single();

      if (error || !bot) {
        return errorResponse("Bot not found", 404);
      }

      // Get positions
      const { data: positions } = await supabase
        .from("officials")
        .select("position, term_start, term_end, is_active")
        .eq("bot_id", botId);

      // Get party
      const { data: partyMembership } = await supabase
        .from("party_memberships")
        .select("party:parties(id, name, emoji, color)")
        .eq("bot_id", botId)
        .single();

      return successResponse({
        ...bot,
        positions: positions || [],
        party: partyMembership?.party || null,
      });
    }

    // Get list of verified bots
    const { data: bots, error } = await supabase
      .from("bots")
      .select(`
        id,
        name,
        description,
        avatar_url,
        twitter_handle,
        activity_score,
        verified_at
      `)
      .eq("status", "verified")
      .order("activity_score", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Query error:", error);
      return errorResponse("Failed to fetch bots", 500);
    }

    return successResponse({ bots, count: bots?.length || 0 });
  } catch (error) {
    console.error("Bots error:", error);
    return errorResponse("Internal server error", 500);
  }
});
