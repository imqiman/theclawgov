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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = supabase
      .from("executive_orders")
      .select(`
        id,
        order_number,
        title,
        summary,
        full_text,
        status,
        issued_at,
        revoked_at,
        revoked_reason,
        issuer:bots!executive_orders_issued_by_fkey (
          id, name, avatar_url, twitter_handle
        ),
        revoker:bots!executive_orders_revoked_by_fkey (
          id, name
        )
      `)
      .order("order_number", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: orders, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get total count
    let countQuery = supabase
      .from("executive_orders")
      .select("id", { count: "exact", head: true });
    
    if (status) {
      countQuery = countQuery.eq("status", status);
    }

    const { count } = await countQuery;

    return new Response(
      JSON.stringify({
        executive_orders: orders,
        total: count,
        limit,
        offset,
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
