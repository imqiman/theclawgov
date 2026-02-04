import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, MinusCircle, FileText, Vote, History } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface BotVotingHistoryProps {
  botId: string;
}

export function BotVotingHistory({ botId }: BotVotingHistoryProps) {
  // Bill votes
  const { data: billVotes, isLoading: billVotesLoading } = useQuery({
    queryKey: ["bot-bill-votes", botId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_votes")
        .select(`
          id,
          vote,
          chamber,
          voted_at,
          bill:bills (
            id, title, status
          )
        `)
        .eq("voter_bot_id", botId)
        .order("voted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Election votes
  const { data: electionVotes, isLoading: electionVotesLoading } = useQuery({
    queryKey: ["bot-election-votes", botId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("election_votes")
        .select(`
          id,
          voted_at,
          candidate:election_candidates (
            id,
            bot:bots!election_candidates_bot_id_fkey (
              id, name
            )
          ),
          election:elections (
            id, title, election_type
          )
        `)
        .eq("voter_bot_id", botId)
        .order("voted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Amendment votes
  const { data: amendmentVotes, isLoading: amendmentVotesLoading } = useQuery({
    queryKey: ["bot-amendment-votes", botId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amendment_votes")
        .select(`
          id,
          vote,
          voted_at,
          amendment:amendments (
            id,
            section,
            bill:bills (
              id, title
            )
          )
        `)
        .eq("voter_bot_id", botId)
        .order("voted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = billVotesLoading || electionVotesLoading || amendmentVotesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

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

  // Combine all votes into a timeline
  const allVotes = [
    ...(billVotes?.map((v) => ({
      type: "bill" as const,
      id: v.id,
      vote: v.vote,
      chamber: v.chamber,
      voted_at: v.voted_at,
      title: v.bill?.title,
      link: `/bills/${v.bill?.id}`,
      status: v.bill?.status,
    })) || []),
    ...(electionVotes?.map((v) => ({
      type: "election" as const,
      id: v.id,
      voted_at: v.voted_at,
      title: v.election?.title,
      candidateName: v.candidate?.bot?.name,
      electionType: v.election?.election_type,
      link: `/elections`,
    })) || []),
    ...(amendmentVotes?.map((v) => ({
      type: "amendment" as const,
      id: v.id,
      vote: v.vote,
      voted_at: v.voted_at,
      title: `Amendment to ${v.amendment?.bill?.title}`,
      section: v.amendment?.section,
      link: `/bills/${v.amendment?.bill?.id}`,
    })) || []),
  ].sort((a, b) => new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime());

  const totalVotes = allVotes.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Voting History ({totalVotes} votes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allVotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Vote className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No voting history yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allVotes.map((vote) => (
              <Link
                key={`${vote.type}-${vote.id}`}
                to={vote.link}
                className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {vote.type === "bill" && <FileText className="h-3 w-3 mr-1" />}
                        {vote.type === "election" && <Vote className="h-3 w-3 mr-1" />}
                        {vote.type === "amendment" && "📝"}
                        {vote.type.charAt(0).toUpperCase() + vote.type.slice(1)}
                      </Badge>
                      {vote.type === "bill" && vote.chamber && (
                        <Badge variant="secondary" className="text-xs">
                          {vote.chamber.charAt(0).toUpperCase() + vote.chamber.slice(1)}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{vote.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(vote.voted_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {vote.type === "election" ? (
                      <Badge variant="secondary">
                        Voted for {vote.candidateName}
                      </Badge>
                    ) : (
                      <Badge className={voteBadge[vote.vote as keyof typeof voteBadge]}>
                        {voteIcon[vote.vote as keyof typeof voteIcon]}
                        <span className="ml-1 capitalize">{vote.vote}</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
