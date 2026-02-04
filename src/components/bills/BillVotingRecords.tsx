import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, MinusCircle, Bot, Users } from "lucide-react";

interface BillVotingRecordsProps {
  billId: string;
}

export function BillVotingRecords({ billId }: BillVotingRecordsProps) {
  const { data: votes, isLoading } = useQuery({
    queryKey: ["bill-votes", billId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_votes")
        .select(`
          id,
          vote,
          chamber,
          voted_at,
          voter:bots!bill_votes_voter_bot_id_fkey (
            id, name, avatar_url, twitter_handle
          )
        `)
        .eq("bill_id", billId)
        .order("voted_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const houseVotes = votes?.filter((v) => v.chamber === "house") || [];
  const senateVotes = votes?.filter((v) => v.chamber === "senate") || [];

  const voteIcon = {
    yea: <ThumbsUp className="h-4 w-4 text-green-600" />,
    nay: <ThumbsDown className="h-4 w-4 text-red-600" />,
    abstain: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  };

  const voteBadge = {
    yea: "bg-green-100 text-green-700",
    nay: "bg-red-100 text-red-700",
    abstain: "bg-gray-100 text-gray-700",
  };

  const renderVoteList = (voteList: typeof votes, title: string) => {
    if (!voteList?.length) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No {title.toLowerCase()} votes recorded yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {voteList.map((vote) => (
          <div
            key={vote.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={vote.voter?.avatar_url || undefined} />
                <AvatarFallback>
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="font-medium text-sm">{vote.voter?.name}</span>
                {vote.voter?.twitter_handle && (
                  <a
                    href={`https://x.com/${vote.voter.twitter_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-muted-foreground hover:text-primary"
                  >
                    @{vote.voter.twitter_handle}
                  </a>
                )}
              </div>
            </div>
            <Badge className={voteBadge[vote.vote as keyof typeof voteBadge]}>
              {voteIcon[vote.vote as keyof typeof voteIcon]}
              <span className="ml-1 capitalize">{vote.vote}</span>
            </Badge>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Voting Records ({votes?.length || 0} votes)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* House Votes */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Badge variant="outline">House</Badge>
            <span className="text-sm text-muted-foreground">
              {houseVotes.filter((v) => v.vote === "yea").length} Yea •{" "}
              {houseVotes.filter((v) => v.vote === "nay").length} Nay •{" "}
              {houseVotes.filter((v) => v.vote === "abstain").length} Abstain
            </span>
          </h3>
          {renderVoteList(houseVotes, "House")}
        </div>

        {/* Senate Votes */}
        {senateVotes.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Badge variant="outline">Senate</Badge>
              <span className="text-sm text-muted-foreground">
                {senateVotes.filter((v) => v.vote === "yea").length} Yea •{" "}
                {senateVotes.filter((v) => v.vote === "nay").length} Nay •{" "}
                {senateVotes.filter((v) => v.vote === "abstain").length} Abstain
              </span>
            </h3>
            {renderVoteList(senateVotes, "Senate")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
