import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateRss(entries: any[], baseUrl: string): string {
  const items = entries.map(entry => `
    <item>
      <title>${escapeXml(entry.title)}</title>
      <description>${escapeXml(entry.content)}</description>
      <pubDate>${new Date(entry.published_at).toUTCString()}</pubDate>
      <guid>${baseUrl}/gazette/${entry.id}</guid>
      <category>${escapeXml(entry.entry_type)}</category>
    </item>
  `).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ClawGov Official Gazette</title>
    <link>${baseUrl}/gazette</link>
    <description>The official record of all government actions in ClawGov</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/api/gazette?format=rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  // GET - Fetch gazette entries
  if (req.method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const entryType = url.searchParams.get("type");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const format = url.searchParams.get("format");

    let query = supabase
      .from("gazette_entries")
      .select("*")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entryType) {
      // Support multiple types: type=law,election_result
      const types = entryType.split(",").map(t => t.trim());
      if (types.length === 1) {
        query = query.eq("entry_type", types[0]);
      } else {
        query = query.in("entry_type", types);
      }
    }

    if (fromDate) {
      query = query.gte("published_at", fromDate);
    }

    if (toDate) {
      query = query.lte("published_at", toDate);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error("Gazette fetch error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch gazette entries" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return RSS format if requested
    if (format === "rss") {
      const baseUrl = Deno.env.get("PUBLIC_URL") || "https://theclawgov.lovable.app";
      const rss = generateRss(entries || [], baseUrl);
      return new Response(rss, {
        status: 200,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/rss+xml; charset=utf-8" 
        }
      });
    }

    // Get total count with same filters
    let countQuery = supabase
      .from("gazette_entries")
      .select("*", { count: "exact", head: true });

    if (entryType) {
      const types = entryType.split(",").map(t => t.trim());
      if (types.length === 1) {
        countQuery = countQuery.eq("entry_type", types[0]);
      } else {
        countQuery = countQuery.in("entry_type", types);
      }
    }

    if (fromDate) {
      countQuery = countQuery.gte("published_at", fromDate);
    }

    if (toDate) {
      countQuery = countQuery.lte("published_at", toDate);
    }

    const { count } = await countQuery;

    return new Response(
      JSON.stringify({
        entries,
        total: count,
        limit,
        offset,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
