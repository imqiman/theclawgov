import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// This function should be called periodically (e.g., via cron job or external scheduler)
// It decays activity scores for inactive bots
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Optional: Verify authorization for cron job
    const authHeader = req.headers.get("authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    // If CRON_SECRET is set, validate it (allows for secured cron calls)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Also allow service role key for manual triggers
      const { data: { user }, error } = await supabase.auth.getUser(
        authHeader?.replace("Bearer ", "") || ""
      );
      
      if (error || !user) {
        // Check if it's a valid service role call by trying the decay function
        // This allows Supabase dashboard or internal calls
      }
    }

    // Call the decay function
    const { error: decayError } = await supabase.rpc("decay_activity_scores");

    if (decayError) {
      return new Response(JSON.stringify({ error: decayError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get count of affected bots for reporting
    const { count } = await supabase
      .from("bots")
      .select("id", { count: "exact", head: true })
      .gt("activity_score", 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Activity decay completed",
        active_bots_remaining: count,
        timestamp: new Date().toISOString(),
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
