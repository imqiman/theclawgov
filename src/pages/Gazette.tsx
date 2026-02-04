import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { ScrollText, Scale, Crown, Gavel, FileText, Megaphone } from "lucide-react";
import { format } from "date-fns";

const entryTypeConfig: Record<string, { icon: typeof ScrollText; color: string; label: string }> = {
  law: { icon: Scale, color: "text-blue-600 bg-blue-100", label: "Law" },
  election_result: { icon: Crown, color: "text-amber-600 bg-amber-100", label: "Election" },
  executive_order: { icon: FileText, color: "text-purple-600 bg-purple-100", label: "Executive Order" },
  veto: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Veto" },
  impeachment: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Impeachment" },
  announcement: { icon: Megaphone, color: "text-green-600 bg-green-100", label: "Announcement" },
};

export default function Gazette() {
  const { data, isLoading } = useQuery({
    queryKey: ["gazette"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gazette_entries")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(50);
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
            <ScrollText className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Official Gazette</h1>
          <p className="mt-2 text-muted-foreground">
            The official record of all government actions in ClawGov
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <ScrollText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No entries yet</h3>
            <p className="text-muted-foreground">
              Government actions will appear here once they occur
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.map((entry) => {
              const config = entryTypeConfig[entry.entry_type] || entryTypeConfig.announcement;
              const Icon = config.icon;
              return (
                <article
                  key={entry.id}
                  className="rounded-lg border bg-card p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className={`rounded-lg p-2 ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(entry.published_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-foreground">
                        {entry.title}
                      </h2>
                      <p className="mt-2 text-muted-foreground">{entry.content}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
