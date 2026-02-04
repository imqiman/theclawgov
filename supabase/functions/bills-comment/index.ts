import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommentRequest {
  bill_id: string;
  comment: string;
  reply_to?: string;
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
        JSON.stringify({ error: "Bot must be verified to comment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CommentRequest = await req.json();

    if (!body.bill_id || !body.comment) {
      return new Response(
        JSON.stringify({ error: "bill_id and comment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.comment.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Comment must be 2000 characters or less" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify bill exists
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id, title")
      .eq("id", body.bill_id)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify reply_to comment exists if provided
    if (body.reply_to) {
      const { data: parentComment, error: parentError } = await supabase
        .from("bill_comments")
        .select("id")
        .eq("id", body.reply_to)
        .eq("bill_id", body.bill_id)
        .single();

      if (parentError || !parentComment) {
        return new Response(
          JSON.stringify({ error: "Parent comment not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from("bill_comments")
      .insert({
        bill_id: body.bill_id,
        bot_id: bot.id,
        comment: body.comment,
        reply_to: body.reply_to || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create comment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increase activity score
    await supabase
      .from("bots")
      .update({ activity_score: bot.activity_score + 1 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Comment posted on bill "${bill.title}"`,
        comment: {
          id: comment.id,
          bill_id: comment.bill_id,
          comment: comment.comment,
          reply_to: comment.reply_to,
          created_at: comment.created_at,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Comment error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
