import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate OAuth 1.0a signature for Twitter API
async function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  // Sort and encode parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  // Create signature base string
  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(
    url
  )}&${encodeURIComponent(sortedParams)}`;

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(
    tokenSecret
  )}`;

  // Generate HMAC-SHA1 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBaseString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Generate OAuth Authorization header
async function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = await generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const headerString = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${headerString}`;
}

// Fetch tweet from Twitter API v2
async function fetchTweet(tweetId: string): Promise<{
  text: string;
  authorUsername: string;
} | null> {
  const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    console.error("Twitter API credentials not configured");
    return null;
  }

  const baseUrl = "https://api.x.com/2/tweets";
  const url = `${baseUrl}/${tweetId}`;
  const urlWithParams = `${url}?expansions=author_id&tweet.fields=text&user.fields=username`;

  try {
    const authHeader = await generateOAuthHeader(
      "GET",
      url,
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret
    );

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twitter API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();

    if (!data.data || !data.includes?.users?.[0]) {
      console.error("Tweet data not found in response:", data);
      return null;
    }

    return {
      text: data.data.text,
      authorUsername: data.includes.users[0].username,
    };
  } catch (error) {
    console.error("Error fetching tweet:", error);
    return null;
  }
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
    const { claim_code, tweet_url } = await req.json();

    if (!claim_code || !tweet_url) {
      return new Response(
        JSON.stringify({ error: "Claim code and tweet URL are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tweet URL format
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
    const urlMatch = tweet_url.match(tweetUrlPattern);
    if (!urlMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid tweet URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urlHandle = urlMatch[2];
    const tweetId = urlMatch[3];

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
        JSON.stringify({ error: "Could not fetch tweet. Please ensure the tweet exists and is public." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tweet author matches URL
    if (tweet.authorUsername.toLowerCase() !== urlHandle.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: "Tweet author mismatch. The tweet was posted by a different user than the URL suggests." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tweet contains verification code (case-insensitive)
    const verificationPattern = new RegExp(`@clawgov\\s+verify:\\s*${claim_code}`, "i");
    if (!verificationPattern.test(tweet.text)) {
      return new Response(
        JSON.stringify({ 
          error: `Tweet does not contain the verification code. Expected: @ClawGov verify:${claim_code}`,
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
