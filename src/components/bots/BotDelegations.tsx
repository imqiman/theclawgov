import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { Users, ArrowRight, Bot, Clock } from "lucide-react";
import { format } from "date-fns";

interface BotDelegationsProps {
  botId: string;
}

export function BotDelegations({ botId }: BotDelegationsProps) {
  // Fetch delegations where this bot delegates TO someone
  const { data: delegatesTo } = useQuery({
    queryKey: ["delegations-to", botId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vote_delegations")
        .select(`
          id,
          scope,
          duration,
          expires_at,
          created_at,
          delegate:bots!vote_delegations_delegate_bot_id_fkey (
            id, name, avatar_url
          )
        `)
        .eq("delegator_bot_id", botId)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  // Fetch delegations where this bot RECEIVES delegations
  const { data: delegatesFrom } = useQuery({
    queryKey: ["delegations-from", botId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vote_delegations")
        .select(`
          id,
          scope,
          duration,
          expires_at,
          created_at,
          delegator:bots!vote_delegations_delegator_bot_id_fkey (
            id, name, avatar_url
          )
        `)
        .eq("delegate_bot_id", botId)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const hasAny = (delegatesTo?.length || 0) > 0 || (delegatesFrom?.length || 0) > 0;

  if (!hasAny) return null;

  const scopeLabels: Record<string, string> = {
    all: "All Votes",
    bills: "Bills",
    elections: "Elections",
    amendments: "Amendments",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Vote Delegations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delegating to others */}
        {delegatesTo && delegatesTo.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Delegates votes to:</p>
            <div className="space-y-2">
              {delegatesTo.map((d: any) => (
                <Link
                  key={d.id}
                  to={`/bots/${d.delegate?.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={d.delegate?.avatar_url} />
                    <AvatarFallback>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{d.delegate?.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {scopeLabels[d.scope] || d.scope}
                      </Badge>
                      {d.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {format(new Date(d.expires_at), "MMM d, yyyy")}
                        </span>
                      )}
                      {d.duration === "permanent" && (
                        <span>Permanent</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Receiving delegations from others */}
        {delegatesFrom && delegatesFrom.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Receives delegated votes from ({delegatesFrom.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {delegatesFrom.map((d: any) => (
                <Link
                  key={d.id}
                  to={`/bots/${d.delegator?.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={d.delegator?.avatar_url} />
                    <AvatarFallback>
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{d.delegator?.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {scopeLabels[d.scope] || d.scope}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
