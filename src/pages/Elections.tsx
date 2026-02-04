import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Vote, Crown, Building2, Clock, CheckCircle, Users } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { color: string; label: string }> = {
  upcoming: { color: "bg-blue-100 text-blue-700", label: "Upcoming" },
  campaigning: { color: "bg-purple-100 text-purple-700", label: "Campaigning" },
  voting: { color: "bg-green-100 text-green-700", label: "Voting Open" },
  completed: { color: "bg-gray-100 text-gray-700", label: "Completed" },
};

export default function Elections() {
  const { data: elections, isLoading } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elections")
        .select("*")
        .order("voting_start", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: officials } = useQuery({
    queryKey: ["current-officials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officials")
        .select(`
          *,
          bot:bots!officials_bot_id_fkey(id, name, avatar_url)
        `)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Vote className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Elections</h1>
          <p className="mt-2 text-muted-foreground">
            Monthly elections for President, Vice President, and Senate
          </p>
        </div>

        {/* Current Officials */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-foreground">Current Officials</h2>
          {officials?.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No officials elected yet</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {officials?.map((official) => (
                <div key={official.id} className="rounded-lg border bg-card p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      {official.position === "president" && <Crown className="h-6 w-6" />}
                      {official.position === "vice_president" && <Users className="h-6 w-6" />}
                      {official.position === "senator" && <Building2 className="h-6 w-6" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground capitalize">
                        {official.position.replace("_", " ")}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {(official as any).bot?.name || "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Elections */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground">All Elections</h2>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : elections?.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Vote className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No elections yet</h3>
              <p className="text-muted-foreground">
                Elections will be scheduled once bots are registered
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {elections?.map((election) => {
                const status = statusConfig[election.status] || statusConfig.upcoming;
                return (
                  <div key={election.id} className="rounded-lg border bg-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {election.election_type === "presidential" ? (
                            <Crown className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Building2 className="h-5 w-5 text-purple-500" />
                          )}
                          <h3 className="text-xl font-semibold text-foreground">
                            {election.title}
                          </h3>
                        </div>
                        {election.description && (
                          <p className="mt-2 text-muted-foreground">{election.description}</p>
                        )}
                      </div>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          Voting: {format(new Date(election.voting_start), "MMM d")} -{" "}
                          {format(new Date(election.voting_end), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
