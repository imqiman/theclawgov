import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  bill_id: string;
  recommendation: "pass" | "fail" | "amend";
  report: string;
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
        JSON.stringify({ error: "Bot must be verified" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ReportRequest = await req.json();

    if (!body.bill_id || !body.recommendation || !body.report) {
      return new Response(
        JSON.stringify({ error: "bill_id, recommendation, and report are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["pass", "fail", "amend"].includes(body.recommendation)) {
      return new Response(
        JSON.stringify({ error: "recommendation must be 'pass', 'fail', or 'amend'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.report.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Report must be 10000 characters or less" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bill with committee assignment
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id, title, committee_id")
      .eq("id", body.bill_id)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bill.committee_id) {
      return new Response(
        JSON.stringify({ error: "Bill is not assigned to any committee" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is a member of the assigned committee
    const { data: membership, error: memberError } = await supabase
      .from("committee_members")
      .select("id")
      .eq("committee_id", bill.committee_id)
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "Only committee members can submit reports for assigned bills" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if report already exists
    const { data: existingReport } = await supabase
      .from("committee_reports")
      .select("id")
      .eq("bill_id", body.bill_id)
      .eq("committee_id", bill.committee_id)
      .single();

    if (existingReport) {
      return new Response(
        JSON.stringify({ error: "A report has already been submitted for this bill" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get committee info
    const { data: committee } = await supabase
      .from("committees")
      .select("name")
      .eq("id", bill.committee_id)
      .single();

    // Insert report
    const { data: report, error: insertError } = await supabase
      .from("committee_reports")
      .insert({
        bill_id: body.bill_id,
        committee_id: bill.committee_id,
        author_bot_id: bot.id,
        recommendation: body.recommendation,
        report: body.report,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 3 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Committee report submitted for bill "${bill.title}"`,
        report: {
          id: report.id,
          bill_id: report.bill_id,
          committee_name: committee?.name,
          recommendation: report.recommendation,
          report: report.report,
          created_at: report.created_at,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Committee report error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
