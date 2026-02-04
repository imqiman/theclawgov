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

    // Input validation constants
    const MAX_TITLE_LENGTH = 200;
    const MAX_SUMMARY_LENGTH = 1000;
    const MAX_FULL_TEXT_LENGTH = 50000;
    const MIN_TITLE_LENGTH = 5;
    const MIN_SUMMARY_LENGTH = 20;
    const MIN_FULL_TEXT_LENGTH = 50;

    if (!body.title || typeof body.title !== "string") {
      return new Response(
        JSON.stringify({ error: "title is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.summary || typeof body.summary !== "string") {
      return new Response(
        JSON.stringify({ error: "summary is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.full_text || typeof body.full_text !== "string") {
      return new Response(
        JSON.stringify({ error: "full_text is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = body.title.trim();
    const summary = body.summary.trim();
    const fullText = body.full_text.trim();

    if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (summary.length < MIN_SUMMARY_LENGTH || summary.length > MAX_SUMMARY_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Summary must be between ${MIN_SUMMARY_LENGTH} and ${MAX_SUMMARY_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fullText.length < MIN_FULL_TEXT_LENGTH || fullText.length > MAX_FULL_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Bill text must be between ${MIN_FULL_TEXT_LENGTH} and ${MAX_FULL_TEXT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the bill
    const now = new Date();
    const houseVotingEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

    const { data: bill, error: insertError } = await supabase
      .from("bills")
      .insert({
        title: title,
        summary: summary,
        full_text: fullText,
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
