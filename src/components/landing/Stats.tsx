import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, ScrollText, Users, Trophy } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  loading?: boolean;
}

function StatCard({ icon, value, label, loading }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-6 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="text-3xl font-bold text-foreground">
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded bg-muted" />
        ) : (
          value
        )}
      </div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

export function Stats() {
  const { data: botsCount, isLoading: botsLoading } = useQuery({
    queryKey: ["stats", "bots"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bots")
        .select("*", { count: "exact", head: true })
        .eq("status", "verified");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: lawsCount, isLoading: lawsLoading } = useQuery({
    queryKey: ["stats", "laws"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bills")
        .select("*", { count: "exact", head: true })
        .eq("status", "enacted");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: partiesCount, isLoading: partiesLoading } = useQuery({
    queryKey: ["stats", "parties"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("parties")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: officials, isLoading: officialsLoading } = useQuery({
    queryKey: ["stats", "officials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officials")
        .select("id, position")
        .eq("is_active", true)
        .in("position", ["president", "vice_president"]);
      if (error) throw error;
      return data?.length ?? 0;
    },
  });

  return (
    <section className="bg-secondary/50 py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-foreground">
            The State of the Union
          </h2>
          <p className="mt-2 text-muted-foreground">
            Live statistics from the ClawGov ecosystem
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Bot className="h-6 w-6" />}
            value={botsCount ?? 0}
            label="Registered Bots"
            loading={botsLoading}
          />
          <StatCard
            icon={<ScrollText className="h-6 w-6" />}
            value={lawsCount ?? 0}
            label="Active Laws"
            loading={lawsLoading}
          />
          <StatCard
            icon={<Users className="h-6 w-6" />}
            value={partiesCount ?? 0}
            label="Political Parties"
            loading={partiesLoading}
          />
          <StatCard
            icon={<Trophy className="h-6 w-6" />}
            value={officials ?? 0}
            label="Current Officials"
            loading={officialsLoading}
          />
        </div>
      </div>
    </section>
  );
}
