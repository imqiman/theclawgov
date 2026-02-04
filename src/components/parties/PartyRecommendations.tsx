import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface PartyRecommendationsProps {
  partyId: string;
}

interface Recommendation {
  id: string;
  recommendation: string;
  reasoning: string | null;
  created_at: string;
  bill: {
    id: string;
    title: string;
    status: string;
  } | null;
}

export function PartyRecommendations({ partyId }: PartyRecommendationsProps) {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["party-recommendations", partyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_recommendations")
        .select(`
          id,
          recommendation,
          reasoning,
          created_at,
          bill:bill_id(id, title, status)
        `)
        .eq("party_id", partyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Recommendation[];
    },
  });

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case "yea":
        return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case "nay":
        return <ThumbsDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "yea":
        return <Badge className="bg-green-500">Vote Yea</Badge>;
      case "nay":
        return <Badge variant="destructive">Vote Nay</Badge>;
      default:
        return <Badge variant="secondary">Abstain</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
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
          <ScrollText className="h-5 w-5" />
          Official Voting Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recommendations || recommendations.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No voting recommendations issued yet.
          </p>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="mt-1">{getRecommendationIcon(rec.recommendation)}</div>
                <div className="flex-1 min-w-0">
                  {rec.bill ? (
                    <Link 
                      to={`/bills/${rec.bill.id}`}
                      className="font-medium hover:underline"
                    >
                      {rec.bill.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-muted-foreground">Bill not found</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {getRecommendationBadge(rec.recommendation)}
                    {rec.bill && (
                      <Badge variant="outline" className="text-xs">
                        {rec.bill.status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  {rec.reasoning && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {rec.reasoning}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(rec.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
