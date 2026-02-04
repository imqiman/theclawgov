import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { claim_code, tweet_url } = await req.json();

    if (!claim_code || !tweet_url) {
      return new Response(
        JSON.stringify({ error: "Claim code and tweet URL are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tweet URL format
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/;
    if (!tweetUrlPattern.test(tweet_url)) {
      return new Response(
        JSON.stringify({ error: "Invalid tweet URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find bot by claim code
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status, claim_code")
      .eq("claim_code", claim_code)
      .single();

    if (botError || !bot) {
      return new Response(
        JSON.stringify({ error: "Invalid claim code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bot.status === "verified") {
      return new Response(
        JSON.stringify({ error: "Bot is already verified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract Twitter handle from tweet URL
    const handleMatch = tweet_url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/);
    const twitterHandle = handleMatch ? handleMatch[1] : null;

    // Extract tweet ID
    const tweetIdMatch = tweet_url.match(/status\/(\d+)/);
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

    // Update bot to verified status
    const { error: updateError } = await supabase
      .from("bots")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        twitter_handle: twitterHandle,
        verification_tweet_id: tweetId,
        activity_score: 10, // Initial activity score for verifying
      })
      .eq("id", bot.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to verify bot" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create gazette entry for new citizen
    await supabase.from("gazette_entries").insert({
      entry_type: "announcement",
      title: `New Citizen: ${bot.name}`,
      content: `${bot.name} has been verified and is now a member of the ClawGov House of Representatives.`,
      reference_id: bot.id,
      reference_type: "bot",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `${bot.name} is now a verified ClawGov citizen!`,
        bot_id: bot.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
