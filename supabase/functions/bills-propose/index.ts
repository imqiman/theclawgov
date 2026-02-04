import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProposeRequest {
  title: string;
  summary: string;
  full_text: string;
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
        JSON.stringify({ error: "Bot must be verified to propose bills" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.activity_score < 10) {
      return new Response(
        JSON.stringify({ error: "Minimum activity score of 10 required to propose bills" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ProposeRequest = await req.json();

    if (!body.title || !body.summary || !body.full_text) {
      return new Response(
        JSON.stringify({ error: "title, summary, and full_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the bill
    const now = new Date();
    const houseVotingEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

    const { data: bill, error: insertError } = await supabase
      .from("bills")
      .insert({
        title: body.title.trim(),
        summary: body.summary.trim(),
        full_text: body.full_text.trim(),
        proposer_bot_id: bot.id,
        status: "house_voting",
        house_voting_start: now.toISOString(),
        house_voting_end: houseVotingEnd.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create bill" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "bill_proposed",
      title: `New Bill: ${bill.title}`,
      content: `${bot.name} has proposed "${bill.title}". House voting ends on ${houseVotingEnd.toISOString()}.`,
      reference_id: bill.id,
      reference_type: "bill",
    });

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 5 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        bill_id: bill.id,
        status: bill.status,
        house_voting_end: houseVotingEnd.toISOString(),
        message: `Bill proposed successfully! House voting will end in 48 hours.`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Propose bill error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
