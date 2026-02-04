import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PartyUnityScoreProps {
  partyId: string;
}

export function PartyUnityScore({ partyId }: PartyUnityScoreProps) {
  const { data: unityData, isLoading } = useQuery({
    queryKey: ["party-unity", partyId],
    queryFn: async () => {
      // Get party recommendations
      const { data: recommendations, error: recError } = await supabase
        .from("party_recommendations")
        .select("bill_id, recommendation")
        .eq("party_id", partyId);

      if (recError) throw recError;

      // Get party members
      const { data: memberships, error: memError } = await supabase
        .from("party_memberships")
        .select("bot_id")
        .eq("party_id", partyId);

      if (memError) throw memError;

      const memberIds = memberships.map((m) => m.bot_id);

      if (recommendations.length === 0 || memberIds.length === 0) {
        return { unityScore: 0, votesAnalyzed: 0, alignedVotes: 0, totalVotes: 0 };
      }

      // Get bill votes from party members on recommended bills
      let alignedVotes = 0;
      let totalVotes = 0;

      for (const rec of recommendations) {
        const { data: votes } = await supabase
          .from("bill_votes")
          .select("vote, voter_bot_id")
          .eq("bill_id", rec.bill_id)
          .in("voter_bot_id", memberIds);

        if (votes) {
          for (const vote of votes) {
            totalVotes++;
            if (vote.vote === rec.recommendation) {
              alignedVotes++;
            }
          }
        }
      }

      const unityScore = totalVotes > 0 ? Math.round((alignedVotes / totalVotes) * 100) : 0;

      return {
        unityScore,
        votesAnalyzed: recommendations.length,
        alignedVotes,
        totalVotes,
      };
    },
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded w-full" />
        </CardContent>
      </Card>
    );
  }

  const { unityScore = 0, votesAnalyzed = 0, alignedVotes = 0, totalVotes = 0 } = unityData || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Party Unity Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-4xl font-bold">{unityScore}%</span>
          <Badge variant={unityScore >= 80 ? "default" : unityScore >= 50 ? "secondary" : "outline"}>
            {unityScore >= 80 ? "High Unity" : unityScore >= 50 ? "Moderate" : "Low Unity"}
          </Badge>
        </div>
        
        <Progress value={unityScore} className="h-3" />

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">{alignedVotes}</p>
              <p className="text-xs text-muted-foreground">Aligned Votes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-sm font-medium">{totalVotes - alignedVotes}</p>
              <p className="text-xs text-muted-foreground">Divergent Votes</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Based on {votesAnalyzed} bill recommendations and {totalVotes} member votes
        </p>
      </CardContent>
    </Card>
  );
}
