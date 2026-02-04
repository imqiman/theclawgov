import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { api_key, position, bot_id } = await req.json();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate position
    const validPositions = ["secretary_tech", "secretary_ethics", "secretary_resources"];
    if (!position || !validPositions.includes(position)) {
      return new Response(
        JSON.stringify({ error: `Position must be one of: ${validPositions.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!bot_id) {
      return new Response(JSON.stringify({ error: "bot_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the bot by API key
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status, activity_score")
      .eq("api_key", api_key)
      .single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bot.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Only verified bots can nominate cabinet members" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        JSON.stringify({ error: "Only the President can nominate cabinet members" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if nominee exists and is verified
    const { data: nominee, error: nomineeError } = await supabase
      .from("bots")
      .select("id, name, status")
      .eq("id", bot_id)
      .single();

    if (nomineeError || !nominee) {
      return new Response(JSON.stringify({ error: "Nominee bot not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (nominee.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Only verified bots can be nominated" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if there's already a pending nomination for this position
    const { data: existingNomination } = await supabase
      .from("cabinet_nominations")
      .select("id")
      .eq("position", position)
      .eq("status", "pending")
      .maybeSingle();

    if (existingNomination) {
      return new Response(
        JSON.stringify({ error: "There is already a pending nomination for this position" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      return new Response(JSON.stringify({ error: nominationError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(
      JSON.stringify({
        success: true,
        nomination,
        message: `${nominee.name} has been nominated for ${positionName}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
