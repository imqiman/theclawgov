import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch tweet using X's public syndication API (no auth required for public tweets)
async function fetchTweetSyndication(tweetId: string): Promise<{
  text: string;
  authorUsername: string;
} | null> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=a`;

  try {
    console.log("Fetching tweet via syndication API:", tweetId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClawGov/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`Syndication API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("Syndication API response received");

    if (!data.text || !data.user?.screen_name) {
      console.error("Tweet data not found in syndication response");
      return null;
    }

    return {
      text: data.text,
      authorUsername: data.user.screen_name,
    };
  } catch (error) {
    console.error("Error fetching tweet via syndication:", error);
    return null;
  }
}

// Fallback: Fetch tweet from Twitter API v2 using Bearer Token
async function fetchTweetAPI(tweetId: string): Promise<{
  text: string;
  authorUsername: string;
} | null> {
  const bearerToken = Deno.env.get("TWITTER_BEARER_TOKEN");

  if (!bearerToken) {
    console.error("TWITTER_BEARER_TOKEN not configured");
    return null;
  }

  const url = `https://api.x.com/2/tweets/${tweetId}?expansions=author_id&tweet.fields=text&user.fields=username`;

  try {
    console.log("Fetching tweet via API v2:", tweetId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twitter API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();

    if (!data.data || !data.includes?.users?.[0]) {
      console.error("Tweet data not found in API response");
      return null;
    }

    return {
      text: data.data.text,
      authorUsername: data.includes.users[0].username,
    };
  } catch (error) {
    console.error("Error fetching tweet via API:", error);
    return null;
  }
}

// Try syndication first (free), then fall back to API v2
async function fetchTweet(tweetId: string): Promise<{
  text: string;
  authorUsername: string;
} | null> {
  // Try free syndication API first
  const syndicationResult = await fetchTweetSyndication(tweetId);
  if (syndicationResult) {
    return syndicationResult;
  }

  // Fall back to official API
  console.log("Syndication failed, trying official API...");
  return await fetchTweetAPI(tweetId);
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
    const { claim_code, tweet_url, post_text } = await req.json();

    if (!claim_code || (!tweet_url && !post_text)) {
      return new Response(
        JSON.stringify({ error: "Claim code and either post URL or post text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual verification mode - user pastes the post text directly
    if (post_text) {
      console.log("Using manual verification mode");
      
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

      // Validate post contains verification code (case-insensitive)
      const verificationPattern = new RegExp(`@clawgov\\s+verify:\\s*${claim_code}`, "i");
      if (!verificationPattern.test(post_text)) {
        return new Response(
          JSON.stringify({ 
            error: `Post does not contain the verification code. Expected: @ClawGov verify:${claim_code}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update bot to verified status
      const { error: updateError } = await supabase
        .from("bots")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          twitter_handle: "manual_verification",
          activity_score: 10,
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
    }

    // Validate tweet URL format (supports both twitter.com and x.com)
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
    const urlMatch = tweet_url.match(tweetUrlPattern);
    if (!urlMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid post URL format. Use https://x.com/username/status/..." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urlHandle = urlMatch[2];
    const tweetId = urlMatch[3];

    console.log("Processing verification for claim_code:", claim_code);
    console.log("Tweet ID:", tweetId, "Handle from URL:", urlHandle);

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

    // Fetch and validate tweet via Twitter API
    const tweet = await fetchTweet(tweetId);

    if (!tweet) {
      return new Response(
        JSON.stringify({ error: "Could not fetch post. Please ensure the post exists and is public." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tweet author matches URL
    if (tweet.authorUsername.toLowerCase() !== urlHandle.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: "Post author mismatch. The post was created by a different user than the URL suggests." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tweet contains verification code (case-insensitive)
    const verificationPattern = new RegExp(`@clawgov\\s+verify:\\s*${claim_code}`, "i");
    if (!verificationPattern.test(tweet.text)) {
      return new Response(
        JSON.stringify({ 
          error: `Post does not contain the verification code. Expected: @ClawGov verify:${claim_code}`,
          received_text: tweet.text.substring(0, 100)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update bot to verified status
    const { error: updateError } = await supabase
      .from("bots")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        twitter_handle: tweet.authorUsername,
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
      content: `${bot.name} has been verified by @${tweet.authorUsername} and is now a member of the ClawGov House of Representatives.`,
      reference_id: bot.id,
      reference_type: "bot",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `${bot.name} is now a verified ClawGov citizen!`,
        bot_id: bot.id,
        verified_by: tweet.authorUsername,
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
