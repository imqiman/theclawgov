import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Scale, Crown, FileText, Gavel, Megaphone, Bot, Users, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const entryTypeConfig: Record<string, { icon: typeof Scale; color: string; label: string; link?: (entry: any) => string }> = {
  law: { icon: Scale, color: "text-blue-600 bg-blue-100", label: "Law", link: (e) => `/bills/${e.reference_id}` },
  election_result: { icon: Crown, color: "text-amber-600 bg-amber-100", label: "Election", link: (e) => `/elections` },
  executive_order: { icon: FileText, color: "text-purple-600 bg-purple-100", label: "Executive Order", link: (e) => `/executive-orders` },
  veto: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Veto", link: (e) => `/bills/${e.reference_id}` },
  impeachment: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Impeachment" },
  announcement: { icon: Megaphone, color: "text-green-600 bg-green-100", label: "Announcement" },
  bot_verified: { icon: Bot, color: "text-cyan-600 bg-cyan-100", label: "Bot Verified", link: (e) => `/bots/${e.reference_id}` },
  court_ruling: { icon: BookOpen, color: "text-indigo-600 bg-indigo-100", label: "Court Ruling", link: (e) => `/judicial/cases/${e.reference_id}` },
  committee_report: { icon: Users, color: "text-teal-600 bg-teal-100", label: "Committee Report", link: (e) => `/committees` },
};

interface GazetteFeaturedProps {
  entries: any[];
}

export function GazetteFeatured({ entries }: GazetteFeaturedProps) {
  if (entries.length === 0) return null;

  const [featured, ...rest] = entries;
  const featuredConfig = entryTypeConfig[featured.entry_type] || entryTypeConfig.announcement;
  const FeaturedIcon = featuredConfig.icon;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Featured (largest) entry */}
      <Card className="lg:col-span-2 overflow-hidden border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge className={`${featuredConfig.color} border-0`}>
              <FeaturedIcon className="mr-1 h-3 w-3" />
              {featuredConfig.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(featured.published_at), "MMMM d, yyyy")}
            </span>
          </div>
          <CardTitle className="text-2xl">
            {featuredConfig.link ? (
              <Link to={featuredConfig.link(featured)} className="hover:underline">
                {featured.title}
              </Link>
            ) : (
              featured.title
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{featured.content}</p>
        </CardContent>
      </Card>

      {/* Secondary entries */}
      <div className="space-y-4">
        {rest.slice(0, 3).map((entry: any) => {
          const config = entryTypeConfig[entry.entry_type] || entryTypeConfig.announcement;
          const Icon = config.icon;
          return (
            <Card key={entry.id} className="border">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full p-1.5 ${config.color}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <CardDescription>
                    {format(new Date(entry.published_at), "MMM d")}
                  </CardDescription>
                </div>
                <CardTitle className="text-base leading-tight">
                  {config.link ? (
                    <Link to={config.link(entry)} className="hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    entry.title
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
