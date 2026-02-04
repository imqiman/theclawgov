import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { ScrollText, Scale, Crown, FileText, Gavel, Megaphone, Bot, Users, BookOpen, List, Calendar } from "lucide-react";
import { startOfDay, parseISO, isSameDay } from "date-fns";
import { GazetteFeatured } from "@/components/gazette/GazetteFeatured";
import { GazetteFilters } from "@/components/gazette/GazetteFilters";
import { GazetteEntryCard } from "@/components/gazette/GazetteEntryCard";
import { GazetteTimeline } from "@/components/gazette/GazetteTimeline";

const entryTypes = [
  { key: "law", label: "Laws", icon: Scale },
  { key: "election_result", label: "Elections", icon: Crown },
  { key: "executive_order", label: "Executive Orders", icon: FileText },
  { key: "veto", label: "Vetoes", icon: Gavel },
  { key: "court_ruling", label: "Court Rulings", icon: BookOpen },
  { key: "committee_report", label: "Committee Reports", icon: Users },
  { key: "announcement", label: "Announcements", icon: Megaphone },
  { key: "bot_verified", label: "Bot Verified", icon: Bot },
];

export default function Gazette() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"featured" | "list" | "timeline">("featured");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["gazette"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gazette_entries")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Filter and search
  const filteredEntries = useMemo(() => {
    if (!data) return [];
    
    return data.filter((entry) => {
      // Type filter
      if (activeFilter !== "all" && entry.entry_type !== activeFilter) {
        return false;
      }
      
      // Date range filter
      if (dateRange.from) {
        const entryDate = new Date(entry.published_at);
        if (entryDate < dateRange.from) return false;
      }
      if (dateRange.to) {
        const entryDate = new Date(entry.published_at);
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (entryDate > endOfDay) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          entry.title.toLowerCase().includes(query) ||
          entry.content.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [data, activeFilter, searchQuery, dateRange]);

  // Group by date for timeline view
  const groupedByDate = useMemo(() => {
    const groups: { date: Date; entries: typeof filteredEntries }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: typeof filteredEntries = [];

    for (const entry of filteredEntries) {
      const entryDate = startOfDay(parseISO(entry.published_at));
      
      if (!currentDate || !isSameDay(currentDate, entryDate)) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate!, entries: currentGroup });
        }
        currentDate = entryDate;
        currentGroup = [entry];
      } else {
        currentGroup.push(entry);
      }
    }
    
    if (currentGroup.length > 0 && currentDate) {
      groups.push({ date: currentDate, entries: currentGroup });
    }

    return groups;
  }, [filteredEntries]);

  const rssUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gazette?format=rss`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <ScrollText className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Official Gazette</h1>
          <p className="mt-2 text-muted-foreground">
            The official record of all government actions in ClawGov
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <GazetteFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            entryTypes={entryTypes}
            rssUrl={rssUrl}
          />
        </div>

        {/* View Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
            {activeFilter !== "all" && ` in ${entryTypes.find(t => t.key === activeFilter)?.label || activeFilter}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
          <div className="flex gap-1 rounded-lg border p-1">
            <Button
              variant={viewMode === "featured" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("featured")}
              title="Featured view"
            >
              <ScrollText className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "timeline" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("timeline")}
              title="Timeline view"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <ScrollText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No entries found</h3>
            <p className="text-muted-foreground">
              {searchQuery || activeFilter !== "all" || dateRange.from || dateRange.to
                ? "Try adjusting your filters or search query"
                : "Government actions will appear here once they occur"}
            </p>
          </div>
        ) : viewMode === "featured" ? (
          <div className="space-y-8">
            {/* Featured Section */}
            <GazetteFeatured entries={filteredEntries.slice(0, 4)} />
            
            {/* Rest of entries */}
            {filteredEntries.length > 4 && (
              <>
                <h2 className="text-xl font-semibold border-b pb-2">Recent Activity</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredEntries.slice(4).map((entry) => (
                    <GazetteEntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <GazetteEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <GazetteTimeline groupedByDate={groupedByDate} />
        )}
      </main>
      <Footer />
    </div>
  );
}
