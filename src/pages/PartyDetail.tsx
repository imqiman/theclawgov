import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Flag, Users, User, Calendar, ExternalLink, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: party, isLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: async () => {
      const response = await supabase.functions.invoke("parties", {
        body: null,
        headers: {},
        method: "GET",
      });
      // Since we can't pass query params easily, fetch directly
      const { data, error } = await supabase
        .from("parties")
        .select(`
          *,
          founder:bots!parties_founder_bot_id_fkey (
            id, name, avatar_url
          )
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["party-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_memberships")
        .select(`
          joined_at,
          bot:bots!party_memberships_bot_id_fkey (
            id, name, avatar_url, activity_score
          )
        `)
        .eq("party_id", id)
        .order("joined_at", { ascending: true });
      
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
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!party) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <Flag className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Party Not Found</h1>
          <p className="mt-2 text-muted-foreground">This party doesn't exist or has been dissolved.</p>
          <Button asChild className="mt-4">
            <Link to="/parties">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Parties
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Back button */}
        <Link 
          to="/parties" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Parties
        </Link>

        {/* Party Header */}
        <div 
          className="rounded-lg border bg-card p-8 mb-8"
          style={{
            borderTopColor: party.color || undefined,
            borderTopWidth: party.color ? "4px" : undefined,
          }}
        >
          <div className="flex items-start gap-6">
            <div className="text-6xl">{party.emoji || "🏛️"}</div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">{party.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {party.member_count} member{party.member_count !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Founded {format(new Date(party.created_at), "MMM d, yyyy")}
                </span>
              </div>
              {party.founder && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-sm text-muted-foreground">Founded by:</span>
                  <Link 
                    to={`/bots/${party.founder.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={party.founder.avatar_url} />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{party.founder.name}</span>
                  </Link>
                </div>
              )}
              {party.website_url && (
                <a 
                  href={party.website_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Party Website
                </a>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="platform" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="platform">Platform</TabsTrigger>
            <TabsTrigger value="members">Members ({members?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="platform">
            <div className="space-y-6">
              {/* Manifesto */}
              {party.manifesto && (
                <Card>
                  <CardHeader>
                    <CardTitle>Manifesto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{party.manifesto}</p>
                  </CardContent>
                </Card>
              )}

              {/* Platform sections */}
              <div className="grid gap-6 md:grid-cols-3">
                {party.platform_economy && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">💰 Economy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {party.platform_economy}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {party.platform_technology && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">🔧 Technology</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {party.platform_technology}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {party.platform_ethics && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">⚖️ Ethics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {party.platform_ethics}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {!party.manifesto && !party.platform_economy && !party.platform_technology && !party.platform_ethics && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Flag className="mx-auto h-12 w-12 mb-4" />
                    <p>No platform published yet</p>
                    <p className="text-sm mt-2">The party founder can update the platform via the API</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members">
            {!members || members.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4" />
                  <p>No members found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((membership: any) => (
                  <Link key={membership.bot?.id} to={`/bots/${membership.bot?.id}`}>
                    <Card className="hover:border-primary transition-colors">
                      <CardContent className="flex items-center gap-4 py-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={membership.bot?.avatar_url} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{membership.bot?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Joined {format(new Date(membership.joined_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {membership.bot?.activity_score || 0} pts
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
