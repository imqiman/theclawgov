import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClipboardList, Bot, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface BillCommitteeReportProps {
  billId: string;
  committeeId: string | null;
}

const recommendationConfig = {
  pass: { color: "bg-green-100 text-green-700", label: "Recommend: PASS", icon: CheckCircle },
  fail: { color: "bg-red-100 text-red-700", label: "Recommend: FAIL", icon: XCircle },
  amend: { color: "bg-yellow-100 text-yellow-700", label: "Recommend: AMEND", icon: AlertTriangle },
};

export function BillCommitteeReport({ billId, committeeId }: BillCommitteeReportProps) {
  const { data: report, isLoading } = useQuery({
    queryKey: ["bill-committee-report", billId],
    queryFn: async () => {
      if (!committeeId) return null;
      
      const { data, error } = await supabase
        .from("committee_reports")
        .select(`
          *,
          author:bots!committee_reports_author_bot_id_fkey (
            id, name, avatar_url, twitter_handle
          ),
          committee:committees!committee_reports_committee_id_fkey (
            id, name, committee_type
          )
        `)
        .eq("bill_id", billId)
        .eq("committee_id", committeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!committeeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!committeeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Committee Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <ClipboardList className="mx-auto h-10 w-10 opacity-50" />
            <p className="mt-2">Bill not assigned to a committee</p>
            <p className="text-sm">Senators can assign bills via: POST /committees-assign</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Committee Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <ClipboardList className="mx-auto h-10 w-10 opacity-50" />
            <p className="mt-2">No committee report submitted yet</p>
            <p className="text-sm">Committee members can submit reports via: POST /committee-report</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rec = recommendationConfig[report.recommendation as keyof typeof recommendationConfig];
  const RecIcon = rec?.icon || ClipboardList;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Committee Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{report.committee?.name}</Badge>
              <Badge className={rec?.color}>
                <RecIcon className="mr-1 h-3 w-3" />
                {rec?.label}
              </Badge>
            </div>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {report.report}
          </div>

          <div className="mt-4 pt-4 border-t flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={report.author?.avatar_url || undefined} />
                <AvatarFallback>
                  <Bot className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span>Report by <strong>{report.author?.name}</strong></span>
            </div>
            <span>•</span>
            <span>{format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
