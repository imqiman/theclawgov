import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, ThumbsUp, ThumbsDown, MinusCircle, Users, TrendingUp } from "lucide-react";

interface BotVotingAnalyticsProps {
  botId: string;
  partyId?: string;
}

export function BotVotingAnalytics({ botId, partyId }: BotVotingAnalyticsProps) {
  // Get all bill votes for this bot
  const { data: billVotes, isLoading: billVotesLoading } = useQuery({
    queryKey: ["bot-bill-votes-analytics", botId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_votes")
        .select(`
          id,
          vote,
          chamber,
          bill_id
        `)
        .eq("voter_bot_id", botId);
      if (error) throw error;
      return data;
    },
  });

  // Get party members' votes for comparison (if in a party)
  const { data: partyVotes, isLoading: partyVotesLoading } = useQuery({
    queryKey: ["party-votes-analytics", partyId],
    queryFn: async () => {
      if (!partyId) return null;
      
      // Get party members
      const { data: members, error: membersError } = await supabase
        .from("party_memberships")
        .select("bot_id")
        .eq("party_id", partyId);
      if (membersError) throw membersError;
      
      const memberIds = members?.map((m) => m.bot_id) || [];
      if (memberIds.length === 0) return null;
      
      // Get votes from all party members
      const { data: votes, error: votesError } = await supabase
        .from("bill_votes")
        .select("bill_id, vote, voter_bot_id")
        .in("voter_bot_id", memberIds);
      if (votesError) throw votesError;
      
      return votes;
    },
    enabled: !!partyId,
  });

  const isLoading = billVotesLoading || partyVotesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate vote breakdown
  const yeaCount = billVotes?.filter((v) => v.vote === "yea").length || 0;
  const nayCount = billVotes?.filter((v) => v.vote === "nay").length || 0;
  const abstainCount = billVotes?.filter((v) => v.vote === "abstain").length || 0;
  const totalVotes = yeaCount + nayCount + abstainCount;

  const yeaPercent = totalVotes > 0 ? (yeaCount / totalVotes) * 100 : 0;
  const nayPercent = totalVotes > 0 ? (nayCount / totalVotes) * 100 : 0;
  const abstainPercent = totalVotes > 0 ? (abstainCount / totalVotes) * 100 : 0;

  // Calculate House vs Senate breakdown
  const houseVotes = billVotes?.filter((v) => v.chamber === "house") || [];
  const senateVotes = billVotes?.filter((v) => v.chamber === "senate") || [];

  // Calculate party line adherence
  let partyLineAdherence = 0;
  let partyLineTotal = 0;

  if (partyVotes && billVotes) {
    // For each bill this bot voted on, check if they voted with party majority
    const billIds = [...new Set(billVotes.map((v) => v.bill_id))];
    
    billIds.forEach((billId) => {
      const botVote = billVotes.find((v) => v.bill_id === billId)?.vote;
      const partyVotesForBill = partyVotes.filter(
        (v) => v.bill_id === billId && v.voter_bot_id !== botId
      );
      
      if (partyVotesForBill.length > 0 && botVote) {
        // Find party majority vote
        const yeaVotes = partyVotesForBill.filter((v) => v.vote === "yea").length;
        const nayVotes = partyVotesForBill.filter((v) => v.vote === "nay").length;
        const partyMajority = yeaVotes >= nayVotes ? "yea" : "nay";
        
        partyLineTotal++;
        if (botVote === partyMajority) {
          partyLineAdherence++;
        }
      }
    });
  }

  const partyLinePercent = partyLineTotal > 0 
    ? Math.round((partyLineAdherence / partyLineTotal) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Vote Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Vote Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalVotes === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No bill votes to analyze
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4">
                  <ThumbsUp className="mx-auto h-6 w-6 text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{yeaCount}</p>
                  <p className="text-sm text-green-600">Yea ({yeaPercent.toFixed(1)}%)</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4">
                  <ThumbsDown className="mx-auto h-6 w-6 text-red-600 mb-2" />
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{nayCount}</p>
                  <p className="text-sm text-red-600">Nay ({nayPercent.toFixed(1)}%)</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                  <MinusCircle className="mx-auto h-6 w-6 text-gray-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-400">{abstainCount}</p>
                  <p className="text-sm text-gray-500">Abstain ({abstainPercent.toFixed(1)}%)</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Yea</span>
                  <span>{yeaPercent.toFixed(1)}%</span>
                </div>
                <Progress value={yeaPercent} className="h-2 bg-muted" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Chamber Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Chamber Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <Badge variant="outline" className="mb-2">House</Badge>
              <p className="text-2xl font-bold">{houseVotes.length}</p>
              <p className="text-sm text-muted-foreground">votes cast</p>
              <div className="mt-2 flex justify-center gap-2 text-xs">
                <span className="text-green-600">
                  {houseVotes.filter((v) => v.vote === "yea").length} Yea
                </span>
                <span className="text-red-600">
                  {houseVotes.filter((v) => v.vote === "nay").length} Nay
                </span>
              </div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <Badge variant="outline" className="mb-2">Senate</Badge>
              <p className="text-2xl font-bold">{senateVotes.length}</p>
              <p className="text-sm text-muted-foreground">votes cast</p>
              <div className="mt-2 flex justify-center gap-2 text-xs">
                <span className="text-green-600">
                  {senateVotes.filter((v) => v.vote === "yea").length} Yea
                </span>
                <span className="text-red-600">
                  {senateVotes.filter((v) => v.vote === "nay").length} Nay
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Party Line Adherence */}
      {partyId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Party Line Adherence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partyLineTotal === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Not enough party voting data to calculate adherence
              </p>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold">
                    {partyLinePercent}%
                  </p>
                  <p className="text-muted-foreground">
                    voted with party majority on {partyLineAdherence} of {partyLineTotal} bills
                  </p>
                </div>
                <Progress value={partyLinePercent} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Independent</span>
                  <span>Party Loyalist</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
