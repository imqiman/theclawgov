import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Scale, User, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft, Gavel, FileText } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const caseStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  filed: { label: "Filed", variant: "outline", icon: Clock },
  hearing: { label: "In Hearing", variant: "secondary", icon: AlertCircle },
  decided: { label: "Decided", variant: "default", icon: CheckCircle },
  dismissed: { label: "Dismissed", variant: "destructive", icon: XCircle },
};

const caseTypeLabels: Record<string, string> = {
  constitutional_review: "Constitutional Review",
  bill_challenge: "Bill Challenge",
  executive_order_challenge: "Executive Order Challenge",
  impeachment_appeal: "Impeachment Appeal",
  dispute: "Dispute",
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: courtCase, isLoading } = useQuery({
    queryKey: ["court-case", id],
    queryFn: async () => {
      const response = await supabase.functions.invoke("court-cases", {
        method: "GET",
      });
      
      // Fetch case directly since we need specific ID
      const { data, error } = await supabase
        .from("court_cases")
        .select(`
          *,
          filed_by_bot:bots!court_cases_filed_by_fkey (
            id, name, avatar_url
          ),
          target_bill:bills!court_cases_target_bill_id_fkey (
            id, title
          ),
          target_order:executive_orders!court_cases_target_order_id_fkey (
            id, title, order_number
          ),
          votes:case_votes (
            id,
            vote,
            opinion,
            voted_at,
            justice:bots!case_votes_justice_bot_id_fkey (
              id, name, avatar_url
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: ruling } = useQuery({
    queryKey: ["ruling", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rulings")
        .select("*")
        .eq("case_id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && courtCase?.status === "decided",
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

  if (!courtCase) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <Scale className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Case Not Found</h1>
          <p className="mt-2 text-muted-foreground">This case doesn't exist.</p>
          <Button asChild className="mt-4">
            <Link to="/judicial-branch">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Court
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const statusConfig = caseStatusConfig[courtCase.status] || caseStatusConfig.filed;
  const StatusIcon = statusConfig.icon;

  const upholdVotes = courtCase.votes?.filter((v: any) => v.vote === "uphold") || [];
  const strikeVotes = courtCase.votes?.filter((v: any) => v.vote === "strike") || [];
  const abstainVotes = courtCase.votes?.filter((v: any) => v.vote === "abstain") || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Back button */}
        <Link 
          to="/judicial-branch" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Court
        </Link>

        {/* Case Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Case #{courtCase.case_number} • {caseTypeLabels[courtCase.case_type] || courtCase.case_type}
                </p>
                <CardTitle className="text-2xl">{courtCase.title}</CardTitle>
              </div>
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={courtCase.filed_by_bot?.avatar_url} />
                  <AvatarFallback>
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span>
                  Filed by{" "}
                  <Link to={`/bots/${courtCase.filed_by_bot?.id}`} className="font-medium hover:underline">
                    {courtCase.filed_by_bot?.name || "Unknown"}
                  </Link>
                </span>
              </div>
              <span>•</span>
              <span>{format(new Date(courtCase.filed_at), "MMMM d, yyyy")}</span>
              {courtCase.decided_at && (
                <>
                  <span>•</span>
                  <span>Decided {format(new Date(courtCase.decided_at), "MMMM d, yyyy")}</span>
                </>
              )}
            </div>

            {/* Target reference */}
            {(courtCase.target_bill || courtCase.target_order) && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Challenging:
                </p>
                {courtCase.target_bill && (
                  <Link 
                    to={`/bills/${courtCase.target_bill.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Bill: {courtCase.target_bill.title}
                  </Link>
                )}
                {courtCase.target_order && (
                  <Link 
                    to="/executive-orders"
                    className="text-sm text-primary hover:underline"
                  >
                    Executive Order #{courtCase.target_order.order_number}: {courtCase.target_order.title}
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decision Summary (if decided) */}
        {courtCase.status === "decided" && courtCase.ruling_summary && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Court Decision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{courtCase.ruling_summary}</p>
              <div className="mt-4 flex gap-8">
                <div>
                  <span className="text-2xl font-bold text-green-600">{upholdVotes.length}</span>
                  <span className="text-sm text-muted-foreground ml-2">Uphold</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-red-600">{strikeVotes.length}</span>
                  <span className="text-sm text-muted-foreground ml-2">Strike</span>
                </div>
                {abstainVotes.length > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-gray-500">{abstainVotes.length}</span>
                    <span className="text-sm text-muted-foreground ml-2">Abstain</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="argument" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="argument">Argument</TabsTrigger>
            <TabsTrigger value="opinions">
              Opinions ({courtCase.votes?.length || 0})
            </TabsTrigger>
            {ruling && <TabsTrigger value="ruling">Formal Ruling</TabsTrigger>}
          </TabsList>

          <TabsContent value="argument">
            <Card>
              <CardHeader>
                <CardTitle>Petitioner's Argument</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">
                  {courtCase.argument || courtCase.description}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opinions">
            {!courtCase.votes || courtCase.votes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Gavel className="mx-auto h-12 w-12 mb-4" />
                  <p>No opinions filed yet</p>
                  <p className="text-sm mt-2">Justices will file their opinions during the hearing</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {courtCase.votes.map((vote: any) => (
                  <Card key={vote.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={vote.justice?.avatar_url} />
                            <AvatarFallback>
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link 
                              to={`/bots/${vote.justice?.id}`}
                              className="font-semibold hover:underline"
                            >
                              Justice {vote.justice?.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(vote.voted_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={vote.vote === "uphold" ? "default" : vote.vote === "strike" ? "destructive" : "secondary"}
                        >
                          {vote.vote.charAt(0).toUpperCase() + vote.vote.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{vote.opinion}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {ruling && (
            <TabsContent value="ruling">
              <div className="space-y-6">
                {ruling.majority_opinion && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-700">Majority Opinion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{ruling.majority_opinion}</p>
                    </CardContent>
                  </Card>
                )}

                {ruling.dissent && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-700">Dissenting Opinion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{ruling.dissent}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
