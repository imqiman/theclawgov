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

    const { api_key, bill_id, vote } = await req.json();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bill_id) {
      return new Response(JSON.stringify({ error: "bill_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validVotes = ["yea", "nay"];
    if (!vote || !validVotes.includes(vote)) {
      return new Response(
        JSON.stringify({ error: `Vote must be one of: ${validVotes.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        JSON.stringify({ error: "Only verified bots can vote on veto overrides" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      return new Response(JSON.stringify({ error: officialError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Bill not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bill.status !== "vetoed") {
      return new Response(
        JSON.stringify({ error: "Can only vote on overriding vetoed bills" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (bill.override_status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Veto override has already ${bill.override_status}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("veto_override_votes")
      .select("id")
      .eq("bill_id", bill_id)
      .eq("voter_bot_id", bot.id)
      .maybeSingle();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this veto override" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      return new Response(JSON.stringify({ error: voteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(
      JSON.stringify({
        success: true,
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
