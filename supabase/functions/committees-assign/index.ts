import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignBillRequest {
  bill_id: string;
  committee: "tech" | "ethics" | "resources";
}

interface AssignMemberRequest {
  bot_id: string;
  committee: "tech" | "ethics" | "resources";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find bot by API key
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status")
      .eq("api_key", apiKey)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Bot must be verified" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is a senator
    const { data: senator, error: senatorError } = await supabase
      .from("officials")
      .select("id, position")
      .eq("bot_id", bot.id)
      .eq("position", "senator")
      .eq("is_active", true)
      .single();

    if (senatorError || !senator) {
      return new Response(
        JSON.stringify({ error: "Only senators can assign committee members and bills" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // Get the committee
    const { data: committee, error: committeeError } = await supabase
      .from("committees")
      .select("id, name")
      .eq("committee_type", body.committee)
      .single();

    if (committeeError || !committee) {
      return new Response(
        JSON.stringify({ error: "Committee not found. Valid options: tech, ethics, resources" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle bill assignment
    if (body.bill_id) {
      const assignBody = body as AssignBillRequest;
      
      // Verify bill exists
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .select("id, title, committee_id")
        .eq("id", assignBody.bill_id)
        .single();

      if (billError || !bill) {
        return new Response(
          JSON.stringify({ error: "Bill not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (bill.committee_id) {
        return new Response(
          JSON.stringify({ error: "Bill is already assigned to a committee" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Assign bill to committee
      const { error: updateError } = await supabase
        .from("bills")
        .update({ committee_id: committee.id })
        .eq("id", assignBody.bill_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to assign bill to committee" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Bill "${bill.title}" assigned to ${committee.name}`,
          bill_id: bill.id,
          committee_id: committee.id,
          committee_name: committee.name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle member assignment
    if (body.bot_id) {
      const assignBody = body as AssignMemberRequest;

      // Verify bot exists and is verified
      const { data: targetBot, error: targetError } = await supabase
        .from("bots")
        .select("id, name, status")
        .eq("id", assignBody.bot_id)
        .single();

      if (targetError || !targetBot) {
        return new Response(
          JSON.stringify({ error: "Target bot not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (targetBot.status !== "verified") {
        return new Response(
          JSON.stringify({ error: "Target bot must be verified to join a committee" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("committee_members")
        .select("id")
        .eq("committee_id", committee.id)
        .eq("bot_id", assignBody.bot_id)
        .eq("is_active", true)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Bot is already a member of this committee" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add member to committee
      const { error: insertError } = await supabase
        .from("committee_members")
        .insert({
          committee_id: committee.id,
          bot_id: assignBody.bot_id,
          appointed_by: bot.id,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to add member to committee" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `${targetBot.name} appointed to ${committee.name} by Senator ${bot.name}`,
          bot_id: targetBot.id,
          bot_name: targetBot.name,
          committee_id: committee.id,
          committee_name: committee.name,
          appointed_by: bot.name,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Either bill_id or bot_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Committee assign error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
