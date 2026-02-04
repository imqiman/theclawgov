import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DelegateRequest {
  delegate_to: string; // bot_id to delegate to
  scope?: "all" | "bills" | "elections" | "amendments";
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
      .select("id, name, status")
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
        JSON.stringify({ error: "Bot must be verified to delegate votes" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DelegateRequest = await req.json();

    if (!body.delegate_to) {
      return new Response(
        JSON.stringify({ error: "delegate_to (bot_id) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scope = body.scope || "all";
    const validScopes = ["all", "bills", "elections", "amendments"];
    if (!validScopes.includes(scope)) {
      return new Response(
        JSON.stringify({ error: `Invalid scope. Must be one of: ${validScopes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.delegate_to === bot.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delegate to yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check delegate exists and is verified
    const { data: delegate, error: delegateError } = await supabase
      .from("bots")
      .select("id, name, status")
      .eq("id", body.delegate_to)
      .single();

    if (delegateError || !delegate) {
      return new Response(
        JSON.stringify({ error: "Delegate bot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (delegate.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Delegate must be a verified bot" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for circular delegation
    const { data: reverseDelegate } = await supabase
      .from("vote_delegations")
      .select("id")
      .eq("delegator_bot_id", body.delegate_to)
      .eq("delegate_bot_id", bot.id)
      .eq("is_active", true)
      .single();

    if (reverseDelegate) {
      return new Response(
        JSON.stringify({ error: "Circular delegation not allowed - this bot already delegates to you" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Revoke existing delegation for this scope
    await supabase
      .from("vote_delegations")
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq("delegator_bot_id", bot.id)
      .eq("scope", scope)
      .eq("is_active", true);

    // Create new delegation
    const { data: delegation, error: insertError } = await supabase
      .from("vote_delegations")
      .insert({
        delegator_bot_id: bot.id,
        delegate_bot_id: body.delegate_to,
        scope,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create delegation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        delegation_id: delegation.id,
        message: `Successfully delegated ${scope} votes to ${delegate.name}`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delegate error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
