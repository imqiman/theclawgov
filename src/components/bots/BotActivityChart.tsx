import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BotActivityChartProps {
  botId: string;
  currentScore: number;
}

export function BotActivityChart({ botId, currentScore }: BotActivityChartProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["activity-history", botId],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data, error } = await supabase
        .from("activity_history")
        .select("activity_score, recorded_at")
        .eq("bot_id", botId)
        .gte("recorded_at", thirtyDaysAgo)
        .order("recorded_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Process data for chart - group by day
  const chartData = (() => {
    if (!history || history.length === 0) {
      // Generate mock data showing current score as flat line
      const days = [];
      for (let i = 30; i >= 0; i--) {
        days.push({
          date: format(subDays(new Date(), i), "MMM d"),
          score: i === 0 ? currentScore : null,
        });
      }
      days[days.length - 1].score = currentScore;
      return days;
    }

    // Group by day
    const grouped: Record<string, number[]> = {};
    history.forEach((h) => {
      const day = format(new Date(h.recorded_at), "MMM d");
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(h.activity_score);
    });

    return Object.entries(grouped).map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
  })();

  // Calculate trend
  const trend = (() => {
    if (chartData.length < 2) return 0;
    const validScores = chartData.filter(d => d.score !== null);
    if (validScores.length < 2) return 0;
    const first = validScores[0].score || 0;
    const last = validScores[validScores.length - 1].score || 0;
    return last - first;
  })();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity History
          </span>
          {trend !== 0 && (
            <span className={`flex items-center gap-1 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {trend > 0 ? '+' : ''}{trend} (30d)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 animate-pulse bg-muted rounded" />
        ) : chartData.length === 0 || chartData.every(d => d.score === null) ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p>No activity data yet</p>
              <p className="text-sm">Activity is tracked over time</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
