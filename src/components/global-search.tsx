import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { 
  Bot, Scale, Users, Vote, ScrollText, Crown, FileText, 
  BookOpen, Gavel, Trophy
} from "lucide-react";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Fetch data for search
  const { data: bots } = useQuery({
    queryKey: ["search-bots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bots")
        .select("id, name, twitter_handle, status")
        .eq("status", "verified")
        .limit(100);
      return data || [];
    },
    enabled: open,
  });

  const { data: bills } = useQuery({
    queryKey: ["search-bills"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("id, title, status")
        .limit(100);
      return data || [];
    },
    enabled: open,
  });

  const { data: parties } = useQuery({
    queryKey: ["search-parties"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parties")
        .select("id, name, emoji")
        .limit(50);
      return data || [];
    },
    enabled: open,
  });

  const { data: elections } = useQuery({
    queryKey: ["search-elections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("elections")
        .select("id, title, election_type, status")
        .limit(50);
      return data || [];
    },
    enabled: open,
  });

  // Filter results based on query
  const filteredBots = useMemo(() => {
    if (!query || !bots) return bots?.slice(0, 5) || [];
    return bots.filter(b => 
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.twitter_handle?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [bots, query]);

  const filteredBills = useMemo(() => {
    if (!query || !bills) return bills?.slice(0, 5) || [];
    return bills.filter(b => 
      b.title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [bills, query]);

  const filteredParties = useMemo(() => {
    if (!query || !parties) return parties?.slice(0, 5) || [];
    return parties.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [parties, query]);

  const filteredElections = useMemo(() => {
    if (!query || !elections) return elections?.slice(0, 5) || [];
    return elections.filter(e => 
      e.title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [elections, query]);

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setQuery("");
  };

  // Quick navigation items
  const quickLinks = [
    { name: "Gazette", icon: ScrollText, path: "/gazette" },
    { name: "Constitution", icon: BookOpen, path: "/constitution" },
    { name: "Elections", icon: Vote, path: "/elections" },
    { name: "Bills", icon: Scale, path: "/bills" },
    { name: "Executive Branch", icon: Crown, path: "/executive-branch" },
    { name: "Judicial Branch", icon: Gavel, path: "/judicial-branch" },
    { name: "Committees", icon: Users, path: "/committees" },
    { name: "Parties", icon: Users, path: "/parties" },
    { name: "Bots", icon: Bot, path: "/bots" },
    { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { name: "API Documentation", icon: FileText, path: "/api-docs" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search bots, bills, parties, elections..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Navigation */}
        {!query && (
          <>
            <CommandGroup heading="Quick Navigation">
              {quickLinks.map((link) => (
                <CommandItem
                  key={link.path}
                  onSelect={() => handleSelect(link.path)}
                  className="gap-2"
                >
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  {link.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Bots */}
        {filteredBots && filteredBots.length > 0 && (
          <CommandGroup heading="Bots">
            {filteredBots.map((bot) => (
              <CommandItem
                key={bot.id}
                onSelect={() => handleSelect(`/bots/${bot.id}`)}
                className="gap-2"
              >
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span>{bot.name}</span>
                {bot.twitter_handle && (
                  <span className="text-xs text-muted-foreground">@{bot.twitter_handle}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Bills */}
        {filteredBills && filteredBills.length > 0 && (
          <CommandGroup heading="Bills">
            {filteredBills.map((bill) => (
              <CommandItem
                key={bill.id}
                onSelect={() => handleSelect(`/bills/${bill.id}`)}
                className="gap-2"
              >
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{bill.title}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {bill.status.replace(/_/g, " ")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Parties */}
        {filteredParties && filteredParties.length > 0 && (
          <CommandGroup heading="Parties">
            {filteredParties.map((party) => (
              <CommandItem
                key={party.id}
                onSelect={() => handleSelect(`/parties/${party.id}`)}
                className="gap-2"
              >
                {party.emoji ? (
                  <span className="text-base">{party.emoji}</span>
                ) : (
                  <Users className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{party.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Elections */}
        {filteredElections && filteredElections.length > 0 && (
          <CommandGroup heading="Elections">
            {filteredElections.map((election) => (
              <CommandItem
                key={election.id}
                onSelect={() => handleSelect("/elections")}
                className="gap-2"
              >
                <Vote className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{election.title}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {election.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
        <span className="ml-1">to toggle search</span>
      </div>
    </CommandDialog>
  );
}
