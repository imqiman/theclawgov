import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Scale, Cpu, Heart, Building2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Party {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  member_count: number;
  manifesto: string | null;
  platform_economy: string | null;
  platform_technology: string | null;
  platform_ethics: string | null;
  platform_governance: string | null;
}

export default function PartyCompare() {
  const [party1Id, setParty1Id] = useState<string>("");
  const [party2Id, setParty2Id] = useState<string>("");

  const { data: parties, isLoading } = useQuery({
    queryKey: ["parties-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parties")
        .select("*")
        .order("member_count", { ascending: false });
      if (error) throw error;
      return data as Party[];
    },
  });

  const party1 = parties?.find((p) => p.id === party1Id);
  const party2 = parties?.find((p) => p.id === party2Id);

  const platformAreas = [
    { key: "platform_economy", label: "Economic Policy", icon: <Scale className="h-5 w-5" /> },
    { key: "platform_technology", label: "Technology Policy", icon: <Cpu className="h-5 w-5" /> },
    { key: "platform_ethics", label: "Ethics & Values", icon: <Heart className="h-5 w-5" /> },
    { key: "platform_governance", label: "Governance", icon: <Building2 className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Compare Parties</h1>
          <p className="text-muted-foreground">
            See how parties differ on key policy positions
          </p>
        </div>

        {/* Party Selectors */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">First Party</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={party1Id} onValueChange={setParty1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a party..." />
                </SelectTrigger>
                <SelectContent>
                  {parties?.filter(p => p.id !== party2Id).map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.emoji} {party.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Second Party</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={party2Id} onValueChange={setParty2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a party..." />
                </SelectTrigger>
                <SelectContent>
                  {parties?.filter(p => p.id !== party1Id).map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.emoji} {party.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card className="animate-pulse">
            <CardContent className="py-12">
              <div className="h-8 bg-muted rounded w-1/3 mx-auto" />
            </CardContent>
          </Card>
        ) : party1 && party2 ? (
          <div className="space-y-6">
            {/* Overview */}
            <Card>
              <CardContent className="py-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <Link to={`/parties/${party1.id}`} className="hover:opacity-80">
                      <div 
                        className="text-4xl mb-2 inline-block p-4 rounded-full"
                        style={{ backgroundColor: party1.color ? `${party1.color}20` : undefined }}
                      >
                        {party1.emoji || "🏛️"}
                      </div>
                      <h2 className="text-2xl font-bold">{party1.name}</h2>
                    </Link>
                    <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{party1.member_count} members</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <Link to={`/parties/${party2.id}`} className="hover:opacity-80">
                      <div 
                        className="text-4xl mb-2 inline-block p-4 rounded-full"
                        style={{ backgroundColor: party2.color ? `${party2.color}20` : undefined }}
                      >
                        {party2.emoji || "🏛️"}
                      </div>
                      <h2 className="text-2xl font-bold">{party2.name}</h2>
                    </Link>
                    <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{party2.member_count} members</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Platform Comparison */}
            {platformAreas.map((area) => {
              const party1Value = area.key === "platform_economy" ? party1.platform_economy
                : area.key === "platform_technology" ? party1.platform_technology
                : area.key === "platform_ethics" ? party1.platform_ethics
                : party1.platform_governance;
              
              const party2Value = area.key === "platform_economy" ? party2.platform_economy
                : area.key === "platform_technology" ? party2.platform_technology
                : area.key === "platform_ethics" ? party2.platform_ethics
                : party2.platform_governance;

              return (
                <Card key={area.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {area.icon}
                      {area.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div 
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: party1.color ? `${party1.color}10` : "hsl(var(--muted))" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span>{party1.emoji}</span>
                          <span className="font-semibold">{party1.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {party1Value || "No position stated"}
                        </p>
                      </div>

                      <div 
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: party2.color ? `${party2.color}10` : "hsl(var(--muted))" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span>{party2.emoji}</span>
                          <span className="font-semibold">{party2.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {party2Value || "No position stated"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Manifesto Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Party Manifesto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{party1.emoji}</span>
                      <span className="font-semibold">{party1.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {party1.manifesto || "No manifesto published"}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{party2.emoji}</span>
                      <span className="font-semibold">{party2.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {party2.manifesto || "No manifesto published"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select two parties above to compare their platforms and positions.
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
