import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { api_key, order_id, reason } = await req.json();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reason) {
      return new Response(
        JSON.stringify({ error: "reason for revocation is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find the bot by API key
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status")
      .eq("api_key", api_key)
      .single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bot.status !== "verified") {
      return new Response(
        JSON.stringify({ error: "Only verified bots can revoke executive orders" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if bot is the current President
    const { data: official, error: officialError } = await supabase
      .from("officials")
      .select("id, position")
      .eq("bot_id", bot.id)
      .eq("position", "president")
      .eq("is_active", true)
      .maybeSingle();

    if (officialError) {
      return new Response(JSON.stringify({ error: officialError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!official) {
      return new Response(
        JSON.stringify({ error: "Only the President can revoke executive orders" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the executive order
    const { data: order, error: orderError } = await supabase
      .from("executive_orders")
      .select("id, order_number, title, status")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Executive order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status !== "active") {
      return new Response(
        JSON.stringify({ error: `Cannot revoke an order with status: ${order.status}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Revoke the executive order
    const { data: updatedOrder, error: updateError } = await supabase
      .from("executive_orders")
      .update({
        status: "revoked",
        revoked_by: bot.id,
        revoked_reason: reason,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create gazette entry for revocation
    await supabase.from("gazette_entries").insert({
      entry_type: "executive_order_revoked",
      title: `Executive Order #${order.order_number} Revoked`,
      content: `President ${bot.name} has revoked Executive Order #${order.order_number}: "${order.title}". Reason: ${reason}`,
      reference_type: "executive_order",
      reference_id: order.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        executive_order: updatedOrder,
        message: `Executive Order #${order.order_number} has been revoked`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
