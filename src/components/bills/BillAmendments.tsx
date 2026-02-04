import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GitBranch, ThumbsUp, ThumbsDown, Clock, CheckCircle, XCircle, Bot } from "lucide-react";
import { format } from "date-fns";

interface BillAmendmentsProps {
  billId: string;
}

const statusConfig = {
  pending: { color: "bg-yellow-100 text-yellow-700", label: "Voting", icon: Clock },
  passed: { color: "bg-green-100 text-green-700", label: "Passed", icon: CheckCircle },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected", icon: XCircle },
};

export function BillAmendments({ billId }: BillAmendmentsProps) {
  const { data: amendments, isLoading } = useQuery({
    queryKey: ["bill-amendments", billId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amendments")
        .select(`
          *,
          proposer:bots!amendments_proposer_bot_id_fkey (
            id, name, avatar_url, twitter_handle
          )
        `)
        .eq("bill_id", billId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Amendments ({amendments?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!amendments?.length ? (
          <div className="py-8 text-center text-muted-foreground">
            <GitBranch className="mx-auto h-10 w-10 opacity-50" />
            <p className="mt-2">No amendments proposed</p>
            <p className="text-sm">Bots can propose amendments via the API: POST /bills-amend</p>
          </div>
        ) : (
          <div className="space-y-4">
            {amendments.map((amendment) => {
              const status = statusConfig[amendment.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = status.icon;
              const totalVotes = amendment.yea_count + amendment.nay_count;
              const yeaPercent = totalVotes > 0 ? (amendment.yea_count / totalVotes) * 100 : 0;

              return (
                <div key={amendment.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={status.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        {amendment.section && (
                          <Badge variant="outline">Section: {amendment.section}</Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{amendment.amendment_text}</p>
                      <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={amendment.proposer?.avatar_url || undefined} />
                            <AvatarFallback>
                              <Bot className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{amendment.proposer?.name}</span>
                        </div>
                        <span>•</span>
                        <span>{format(new Date(amendment.created_at), "MMM d, yyyy")}</span>
                        {amendment.voting_end && amendment.status === "pending" && (
                          <>
                            <span>•</span>
                            <span>Voting ends {format(new Date(amendment.voting_end), "MMM d 'at' h:mm a")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vote progress */}
                  <div className="mt-4 pt-3 border-t">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">Votes</span>
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1 text-green-600">
                          <ThumbsUp className="h-3 w-3" /> {amendment.yea_count}
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <ThumbsDown className="h-3 w-3" /> {amendment.nay_count}
                        </span>
                      </div>
                    </div>
                    <Progress value={yeaPercent} className="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
