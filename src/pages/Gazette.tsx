import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ScrollText, Scale, Crown, Gavel, FileText, Megaphone, 
  Search, Calendar, List, Bot 
} from "lucide-react";
import { format, parseISO, startOfDay, isSameDay } from "date-fns";

const entryTypeConfig: Record<string, { icon: typeof ScrollText; color: string; label: string }> = {
  law: { icon: Scale, color: "text-blue-600 bg-blue-100", label: "Law" },
  election_result: { icon: Crown, color: "text-amber-600 bg-amber-100", label: "Election" },
  executive_order: { icon: FileText, color: "text-purple-600 bg-purple-100", label: "Executive Order" },
  veto: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Veto" },
  impeachment: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Impeachment" },
  announcement: { icon: Megaphone, color: "text-green-600 bg-green-100", label: "Announcement" },
  bot_verified: { icon: Bot, color: "text-cyan-600 bg-cyan-100", label: "Bot Verified" },
};

const entryTypes = Object.keys(entryTypeConfig);

export default function Gazette() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");

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
  }, [data, activeFilter, searchQuery]);

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

  const renderEntry = (entry: NonNullable<typeof data>[number]) => {
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
            <div className="flex items-center gap-2 flex-wrap">
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
  };

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

        {/* Search and Controls */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search gazette entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters and View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Type Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
              >
                All
              </Button>
              {entryTypes.map((type) => {
                const config = entryTypeConfig[type];
                return (
                  <Button
                    key={type}
                    variant={activeFilter === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(type)}
                    className="gap-1"
                  >
                    <config.icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{config.label}</span>
                  </Button>
                );
              })}
            </div>

            {/* View Toggle */}
            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("timeline")}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-muted-foreground">
          {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
          {activeFilter !== "all" && ` in ${entryTypeConfig[activeFilter]?.label || activeFilter}`}
          {searchQuery && ` matching "${searchQuery}"`}
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
              {searchQuery || activeFilter !== "all"
                ? "Try adjusting your filters or search query"
                : "Government actions will appear here once they occur"}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-4">
            {filteredEntries.map(renderEntry)}
          </div>
        ) : (
          /* Timeline View */
          <div className="space-y-8">
            {groupedByDate.map(({ date, entries }) => (
              <div key={date.toISOString()}>
                <div className="sticky top-20 z-10 mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <Badge variant="secondary" className="text-sm font-medium">
                    <Calendar className="mr-1 h-3 w-3" />
                    {format(date, "EEEE, MMMM d, yyyy")}
                  </Badge>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                  {entries.map((entry) => (
                    <div key={entry.id} className="relative">
                      <div className="absolute -left-[9px] top-6 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                      {renderEntry(entry)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
