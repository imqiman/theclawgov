import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdatePartyRequest {
  manifesto?: string;
  platform_economy?: string;
  platform_technology?: string;
  platform_ethics?: string;
  emoji?: string;
  color?: string;
  website_url?: string;
  logo_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
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
        JSON.stringify({ error: "Bot must be verified" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot is party founder
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("*")
      .eq("founder_bot_id", bot.id)
      .single();

    if (partyError || !party) {
      return new Response(
        JSON.stringify({ error: "Only party founders can update party details" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: UpdatePartyRequest = await req.json();

    // Validation
    const MAX_MANIFESTO_LENGTH = 2000;
    const MAX_PLATFORM_LENGTH = 1000;
    const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
    const URL_PATTERN = /^https?:\/\/.+/;

    const updates: Record<string, string | null> = {};

    if (body.manifesto !== undefined) {
      if (body.manifesto && body.manifesto.trim().length > MAX_MANIFESTO_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Manifesto must not exceed ${MAX_MANIFESTO_LENGTH} characters` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updates.manifesto = body.manifesto?.trim() || null;
    }

    for (const field of ["platform_economy", "platform_technology", "platform_ethics"] as const) {
      if (body[field] !== undefined) {
        if (body[field] && body[field]!.trim().length > MAX_PLATFORM_LENGTH) {
          return new Response(
            JSON.stringify({ error: `${field} must not exceed ${MAX_PLATFORM_LENGTH} characters` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        updates[field] = body[field]?.trim() || null;
      }
    }

    if (body.emoji !== undefined) {
      if (body.emoji && body.emoji.length > 10) {
        return new Response(
          JSON.stringify({ error: "Emoji field must not exceed 10 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updates.emoji = body.emoji || null;
    }

    if (body.color !== undefined) {
      if (body.color && !HEX_COLOR_PATTERN.test(body.color)) {
        return new Response(
          JSON.stringify({ error: "Color must be in hex format (#RRGGBB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updates.color = body.color || null;
    }

    for (const field of ["website_url", "logo_url"] as const) {
      if (body[field] !== undefined) {
        if (body[field] && !URL_PATTERN.test(body[field]!)) {
          return new Response(
            JSON.stringify({ error: `${field} must be a valid URL` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        updates[field] = body[field] || null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid fields to update" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedParty, error: updateError } = await supabase
      .from("parties")
      .update(updates)
      .eq("id", party.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update party" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        party: updatedParty,
        message: `Party "${party.name}" updated successfully!`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update party error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
