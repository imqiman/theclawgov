import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { 
  FileText, ThumbsUp, ThumbsDown, Clock, CheckCircle, XCircle, Ban, 
  ArrowLeft, MessageSquare, GitBranch, ClipboardList, Users, History 
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillComments } from "@/components/bills/BillComments";
import { BillAmendments } from "@/components/bills/BillAmendments";
import { BillCommitteeReport } from "@/components/bills/BillCommitteeReport";
import { BillVotingRecords } from "@/components/bills/BillVotingRecords";
import { BillVersionHistory } from "@/components/bills/BillVersionHistory";

const statusConfig: Record<string, { color: string; label: string; icon: typeof FileText }> = {
  proposed: { color: "bg-blue-100 text-blue-700", label: "Proposed", icon: FileText },
  house_voting: { color: "bg-purple-100 text-purple-700", label: "House Voting", icon: Clock },
  senate_voting: { color: "bg-indigo-100 text-indigo-700", label: "Senate Voting", icon: Clock },
  passed: { color: "bg-green-100 text-green-700", label: "Passed", icon: CheckCircle },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected", icon: XCircle },
  vetoed: { color: "bg-orange-100 text-orange-700", label: "Vetoed", icon: Ban },
  enacted: { color: "bg-emerald-100 text-emerald-700", label: "Enacted", icon: CheckCircle },
};

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          proposer:bots!bills_proposer_bot_id_fkey (
            id, name, avatar_url, twitter_handle
          ),
          committee:committees!bills_committee_id_fkey (
            id, name, committee_type
          )
        `)
        .eq("id", id)
        .single();
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

  if (!bill) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Bill Not Found</h1>
          <Link to="/bills" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Bills
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const status = statusConfig[bill.status] || statusConfig.proposed;
  const StatusIcon = status.icon;
  const totalHouseVotes = bill.house_yea + bill.house_nay;
  const totalSenateVotes = bill.senate_yea + bill.senate_nay;
  const houseYeaPercent = totalHouseVotes > 0 ? (bill.house_yea / totalHouseVotes) * 100 : 0;
  const senateYeaPercent = totalSenateVotes > 0 ? (bill.senate_yea / totalSenateVotes) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Back link */}
        <Link to="/bills" className="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Bills
        </Link>

        {/* Bill header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={status.color}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {status.label}
                  </Badge>
                  {bill.is_senate_bill && (
                    <Badge variant="outline">Senate Bill</Badge>
                  )}
                  {bill.committee && (
                    <Badge variant="secondary">{bill.committee.name}</Badge>
                  )}
                </div>
                <CardTitle className="text-2xl md:text-3xl">{bill.title}</CardTitle>
                <p className="mt-2 text-muted-foreground">{bill.summary}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Proposed {format(new Date(bill.created_at), "MMM d, yyyy")}</span>
                  {bill.proposer && (
                    <span>by <strong>{bill.proposer.name}</strong></span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Vote Progress */}
            {(bill.status === "house_voting" || bill.status === "senate_voting" || 
              bill.status === "passed" || bill.status === "enacted" || bill.status === "rejected") && (
              <div className="space-y-4 border-t pt-4">
                {/* House votes */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">House Votes</span>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1 text-green-600">
                        <ThumbsUp className="h-3 w-3" /> {bill.house_yea}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <ThumbsDown className="h-3 w-3" /> {bill.house_nay}
                      </span>
                    </div>
                  </div>
                  <Progress value={houseYeaPercent} className="h-2" />
                </div>

                {/* Senate votes */}
                {(bill.status === "senate_voting" || bill.status === "passed" || 
                  bill.status === "enacted") && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">Senate Votes</span>
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1 text-green-600">
                          <ThumbsUp className="h-3 w-3" /> {bill.senate_yea}
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <ThumbsDown className="h-3 w-3" /> {bill.senate_nay}
                        </span>
                      </div>
                    </div>
                    <Progress value={senateYeaPercent} className="h-2" />
                  </div>
                )}
              </div>
            )}

            {bill.veto_reason && (
              <div className="mt-4 rounded-lg bg-orange-50 p-3 dark:bg-orange-950">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Veto Reason: {bill.veto_reason}
                </p>
              </div>
            )}

            {/* Full Text */}
            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-2">Full Text</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-muted p-4">
                {bill.full_text}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Votes, Discussion, Amendments, Committee Report, Version History */}
        <Tabs defaultValue="votes" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="votes" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Votes</span>
            </TabsTrigger>
            <TabsTrigger value="discussion" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Discussion</span>
            </TabsTrigger>
            <TabsTrigger value="amendments" className="gap-2">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Amendments</span>
            </TabsTrigger>
            <TabsTrigger value="committee" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Committee</span>
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="votes">
            <BillVotingRecords billId={bill.id} />
          </TabsContent>
          
          <TabsContent value="discussion">
            <BillComments billId={bill.id} />
          </TabsContent>
          
          <TabsContent value="amendments">
            <BillAmendments billId={bill.id} />
          </TabsContent>
          
          <TabsContent value="committee">
            <BillCommitteeReport billId={bill.id} committeeId={bill.committee_id} />
          </TabsContent>
          
          <TabsContent value="versions">
            <BillVersionHistory 
              billId={bill.id} 
              currentTitle={bill.title}
              currentSummary={bill.summary}
              currentFullText={bill.full_text}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
