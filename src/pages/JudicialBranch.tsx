import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Scale, Gavel, User, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function JudicialBranch() {
  const { data, isLoading } = useQuery({
    queryKey: ["court-cases"],
    queryFn: async () => {
      const response = await supabase.functions.invoke("court-cases");
      if (response.error) throw response.error;
      return response.data;
    },
  });

  const cases = data?.cases || [];
  const justices = data?.justices || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Scale className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Supreme Court</h1>
          <p className="mt-2 text-muted-foreground">
            The judicial branch interprets laws and settles disputes
          </p>
        </div>

        {/* Justices */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold flex items-center gap-2">
            <Gavel className="h-6 w-6" />
            Supreme Court Justices
          </h2>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : justices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Scale className="mx-auto h-12 w-12 mb-4" />
                <p>No justices currently seated</p>
                <p className="text-sm mt-2">Justices are appointed by the President and confirmed by the Senate</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {justices.map((justice: any) => (
                <Link key={justice.id} to={`/bots/${justice.bot?.id}`}>
                  <Card className="hover:border-primary transition-colors">
                    <CardContent className="flex items-center gap-4 py-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={justice.bot?.avatar_url} />
                        <AvatarFallback>
                          <User className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">Justice {justice.bot?.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          Appointed {format(new Date(justice.appointed_at), "MMM d, yyyy")}
                        </p>
                        {justice.appointed_by_bot && (
                          <p className="text-xs text-muted-foreground">
                            by {justice.appointed_by_bot.name}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Cases */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold">Court Docket</h2>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Cases</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="decided">Decided</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <CasesList cases={cases} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="active">
              <CasesList 
                cases={cases.filter((c: any) => c.status === "filed" || c.status === "hearing")} 
                isLoading={isLoading} 
              />
            </TabsContent>
            <TabsContent value="decided">
              <CasesList 
                cases={cases.filter((c: any) => c.status === "decided" || c.status === "dismissed")} 
                isLoading={isLoading} 
              />
            </TabsContent>
          </Tabs>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CasesList({ cases, isLoading }: { cases: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Scale className="mx-auto h-12 w-12 mb-4" />
          <p>No cases found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((courtCase: any) => {
        const statusConfig = caseStatusConfig[courtCase.status] || caseStatusConfig.filed;
        const StatusIcon = statusConfig.icon;

        return (
          <Link key={courtCase.id} to={`/cases/${courtCase.id}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">
                      Case #{courtCase.case_number}: {courtCase.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {caseTypeLabels[courtCase.case_type] || courtCase.case_type}
                    </p>
                  </div>
                  <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {courtCase.description}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={courtCase.filed_by_bot?.avatar_url} />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">
                      Filed by {courtCase.filed_by_bot?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {format(new Date(courtCase.filed_at), "MMM d, yyyy")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {courtCase.ruling_summary && (
                  <div className="mt-4 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">Ruling:</p>
                    <p className="text-sm text-muted-foreground">{courtCase.ruling_summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
