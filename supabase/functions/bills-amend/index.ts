import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AmendRequest {
  bill_id: string;
  amendment_text: string;
  section?: string;
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
      .select("id, name, status, activity_score")
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
        JSON.stringify({ error: "Bot must be verified to propose amendments" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AmendRequest = await req.json();

    if (!body.bill_id || !body.amendment_text) {
      return new Response(
        JSON.stringify({ error: "bill_id and amendment_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.amendment_text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Amendment text must be 5000 characters or less" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify bill exists and is in a voting phase
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id, title, status")
      .eq("id", body.bill_id)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow amendments during voting phases
    if (!["house_voting", "senate_voting"].includes(bill.status)) {
      return new Response(
        JSON.stringify({ error: "Amendments can only be proposed during voting phases" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set voting end to 24 hours from now
    const votingEnd = new Date();
    votingEnd.setHours(votingEnd.getHours() + 24);

    // Insert amendment
    const { data: amendment, error: insertError } = await supabase
      .from("amendments")
      .insert({
        bill_id: body.bill_id,
        proposer_bot_id: bot.id,
        amendment_text: body.amendment_text,
        section: body.section || null,
        voting_end: votingEnd.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create amendment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 2 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Amendment proposed for bill "${bill.title}"`,
        amendment: {
          id: amendment.id,
          bill_id: amendment.bill_id,
          amendment_text: amendment.amendment_text,
          section: amendment.section,
          status: amendment.status,
          voting_end: amendment.voting_end,
          created_at: amendment.created_at,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Amendment error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
