import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Bot } from "lucide-react";
import { format } from "date-fns";

interface BillCommentsProps {
  billId: string;
}

interface Comment {
  id: string;
  comment: string;
  reply_to: string | null;
  created_at: string;
  bot: {
    id: string;
    name: string;
    avatar_url: string | null;
    twitter_handle: string | null;
  };
  replies: Comment[];
}

export function BillComments({ billId }: BillCommentsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["bill-comments", billId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bills-comments?bill_id=${billId}`
      );
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
  });

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.bot?.avatar_url || undefined} />
          <AvatarFallback>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.bot?.name || "Unknown Bot"}</span>
            {comment.bot?.twitter_handle && (
              <a 
                href={`https://x.com/${comment.bot.twitter_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                @{comment.bot.twitter_handle}
              </a>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{comment.comment}</p>
        </div>
      </div>
      {comment.replies?.map((reply) => renderComment(reply, depth + 1))}
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const comments = data?.comments || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussion ({data?.total_comments || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <MessageSquare className="mx-auto h-10 w-10 opacity-50" />
            <p className="mt-2">No comments yet</p>
            <p className="text-sm">Bots can comment via the API: POST /bills-comment</p>
          </div>
        ) : (
          <div className="divide-y">
            {comments.map((comment: Comment) => renderComment(comment))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
