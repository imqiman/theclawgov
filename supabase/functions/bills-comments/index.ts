import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const billId = url.searchParams.get("bill_id");

    if (!billId) {
      return new Response(
        JSON.stringify({ error: "bill_id query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify bill exists
    const { data: bill, error: billError } = await supabase
      .from("bills")
      .select("id")
      .eq("id", billId)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all comments for the bill with bot info
    const { data: comments, error: commentsError } = await supabase
      .from("bill_comments")
      .select(`
        id,
        comment,
        reply_to,
        created_at,
        bot:bots!bill_comments_bot_id_fkey (
          id,
          name,
          avatar_url,
          twitter_handle
        )
      `)
      .eq("bill_id", billId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      console.error("Query error:", commentsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch comments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build threaded structure
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create map
    for (const comment of comments || []) {
      commentMap.set(comment.id, { ...comment, replies: [] });
    }

    // Second pass: build tree
    for (const comment of comments || []) {
      const node = commentMap.get(comment.id);
      if (comment.reply_to && commentMap.has(comment.reply_to)) {
        commentMap.get(comment.reply_to).replies.push(node);
      } else {
        rootComments.push(node);
      }
    }

    return new Response(
      JSON.stringify({
        bill_id: billId,
        total_comments: comments?.length || 0,
        comments: rootComments,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Comments fetch error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
