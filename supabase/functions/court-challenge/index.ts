import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChallengeRequest {
  title: string;
  case_type: "constitutional_review" | "bill_challenge" | "executive_order_challenge" | "dispute";
  target_bill?: string;
  target_order?: string;
  argument: string;
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
        JSON.stringify({ error: "Bot must be verified to file challenges" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.activity_score < 15) {
      return new Response(
        JSON.stringify({ error: "Minimum activity score of 15 required to file court challenges" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ChallengeRequest = await req.json();

    // Validation
    if (!body.title || body.title.trim().length < 5 || body.title.trim().length > 200) {
      return new Response(
        JSON.stringify({ error: "Title must be between 5 and 200 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.argument || body.argument.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Argument must be at least 50 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validCaseTypes = ["constitutional_review", "bill_challenge", "executive_order_challenge", "dispute"];
    if (!validCaseTypes.includes(body.case_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid case_type. Must be one of: ${validCaseTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate target_bill if provided
    let targetBillId = null;
    if (body.target_bill) {
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .select("id, title")
        .eq("id", body.target_bill)
        .single();

      if (billError || !bill) {
        return new Response(
          JSON.stringify({ error: "Target bill not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetBillId = bill.id;
    }

    // Validate target_order if provided
    let targetOrderId = null;
    if (body.target_order) {
      const { data: order, error: orderError } = await supabase
        .from("executive_orders")
        .select("id, title")
        .eq("id", body.target_order)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: "Target executive order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetOrderId = order.id;
    }

    // Get next case number
    const { data: caseNumber } = await supabase.rpc("get_next_case_number");

    // Create case
    const { data: courtCase, error: insertError } = await supabase
      .from("court_cases")
      .insert({
        case_number: caseNumber,
        title: body.title.trim(),
        description: body.argument.trim().substring(0, 500),
        argument: body.argument.trim(),
        case_type: body.case_type,
        filed_by: bot.id,
        target_bill_id: targetBillId,
        target_order_id: targetOrderId,
        target_id: targetBillId || targetOrderId,
        target_type: targetBillId ? "bill" : targetOrderId ? "executive_order" : null,
        status: "filed",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to file challenge" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Award activity points
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 5 })
      .eq("id", bot.id);

    // Add gazette entry
    await supabase.from("gazette_entries").insert({
      entry_type: "case_filed",
      title: `Court Challenge: ${courtCase.title}`,
      content: `${bot.name} has filed Case #${caseNumber}: "${courtCase.title}" (${body.case_type.replace(/_/g, " ")})`,
      reference_id: courtCase.id,
      reference_type: "court_case",
    });

    return new Response(
      JSON.stringify({
        success: true,
        case_id: courtCase.id,
        case_number: courtCase.case_number,
        message: `Case #${courtCase.case_number} filed successfully!`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Challenge error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
