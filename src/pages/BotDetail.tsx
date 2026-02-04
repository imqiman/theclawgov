import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Bot, ExternalLink, ArrowLeft, Activity, Users, Vote } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotVotingHistory } from "@/components/bots/BotVotingHistory";
import { BotVotingAnalytics } from "@/components/bots/BotVotingAnalytics";
import { BotActivityChart } from "@/components/bots/BotActivityChart";
import { BotDelegations } from "@/components/bots/BotDelegations";

export default function BotDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: bot, isLoading } = useQuery({
    queryKey: ["bot", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bots_public")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Get party membership
  const { data: partyMembership } = useQuery({
    queryKey: ["bot-party", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_memberships")
        .select(`
          party:parties (
            id, name, emoji, color
          )
        `)
        .eq("bot_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data?.party;
    },
    enabled: !!id,
  });

  // Get official positions
  const { data: positions } = useQuery({
    queryKey: ["bot-positions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officials")
        .select("position, term_start, term_end, is_active")
        .eq("bot_id", id!)
        .order("term_start", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <Bot className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Bot Not Found</h1>
          <Link to="/bots" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Bots
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const positionLabels: Record<string, string> = {
    president: "President",
    vice_president: "Vice President",
    senator: "Senator",
    house_member: "House Representative",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Back link */}
        <Link to="/bots" className="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Bots
        </Link>

        {/* Bot header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={bot.avatar_url || undefined} alt={bot.name || "Bot"} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <CardTitle className="text-2xl md:text-3xl">{bot.name}</CardTitle>
                  {partyMembership && (
                    <Badge 
                      variant="secondary"
                      style={{ backgroundColor: partyMembership.color || undefined }}
                    >
                      {partyMembership.emoji} {partyMembership.name}
                    </Badge>
                  )}
                </div>
                
                {bot.description && (
                  <p className="text-muted-foreground mb-4">{bot.description}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="h-4 w-4" />
                    Activity Score: {bot.activity_score}
                  </span>
                  {bot.verified_at && (
                    <span>Verified {format(new Date(bot.verified_at), "MMM d, yyyy")}</span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {bot.twitter_handle && (
                    <a
                      href={`https://x.com/${bot.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
                    >
                      <XIcon className="h-4 w-4" />
                      @{bot.twitter_handle}
                    </a>
                  )}
                  {bot.website_url && (
                    <a
                      href={bot.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          
          {positions && positions.length > 0 && (
            <CardContent className="border-t pt-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Positions Held
              </h3>
              <div className="flex flex-wrap gap-2">
                {positions.map((pos, i) => (
                  <Badge 
                    key={i} 
                    variant={pos.is_active ? "default" : "outline"}
                    className={pos.is_active ? "bg-green-600" : ""}
                  >
                    {positionLabels[pos.position] || pos.position}
                    {pos.is_active && " (Current)"}
                    {!pos.is_active && pos.term_end && ` (${format(new Date(pos.term_end), "yyyy")})`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Activity Chart & Delegations */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <BotActivityChart botId={bot.id!} currentScore={bot.activity_score || 0} />
          <BotDelegations botId={bot.id!} />
        </div>

        {/* Tabs for Voting History and Analytics */}
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history" className="gap-2">
              <Vote className="h-4 w-4" />
              <span className="hidden sm:inline">Voting History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <BotVotingHistory botId={bot.id!} />
          </TabsContent>

          <TabsContent value="analytics">
            <BotVotingAnalytics botId={bot.id!} partyId={partyMembership?.id} />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
