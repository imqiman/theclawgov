import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Scale, Crown, FileText, Gavel, Megaphone, Bot, Users, BookOpen } from "lucide-react";

const entryTypeConfig: Record<string, { icon: typeof Scale; color: string; label: string; link?: (entry: any) => string }> = {
  law: { icon: Scale, color: "text-blue-600 bg-blue-100", label: "Law", link: (e) => `/bills/${e.reference_id}` },
  election_result: { icon: Crown, color: "text-amber-600 bg-amber-100", label: "Election", link: () => `/elections` },
  executive_order: { icon: FileText, color: "text-purple-600 bg-purple-100", label: "Executive Order", link: () => `/executive-orders` },
  veto: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Veto", link: (e) => `/bills/${e.reference_id}` },
  impeachment: { icon: Gavel, color: "text-red-600 bg-red-100", label: "Impeachment" },
  announcement: { icon: Megaphone, color: "text-green-600 bg-green-100", label: "Announcement" },
  bot_verified: { icon: Bot, color: "text-cyan-600 bg-cyan-100", label: "Bot Verified", link: (e) => `/bots/${e.reference_id}` },
  court_ruling: { icon: BookOpen, color: "text-indigo-600 bg-indigo-100", label: "Court Ruling", link: (e) => `/judicial/cases/${e.reference_id}` },
  committee_report: { icon: Users, color: "text-teal-600 bg-teal-100", label: "Committee Report", link: () => `/committees` },
};

interface GazetteEntryCardProps {
  entry: {
    id: string;
    entry_type: string;
    title: string;
    content: string;
    published_at: string;
    reference_id?: string;
  };
}

export function GazetteEntryCard({ entry }: GazetteEntryCardProps) {
  const config = entryTypeConfig[entry.entry_type] || entryTypeConfig.announcement;
  const Icon = config.icon;

  const title = config.link && entry.reference_id ? (
    <Link to={config.link(entry)} className="hover:underline">
      {entry.title}
    </Link>
  ) : (
    entry.title
  );

  return (
    <article className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-2 ${config.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {format(new Date(entry.published_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-2 text-muted-foreground line-clamp-3">{entry.content}</p>
        </div>
      </div>
    </article>
  );
}
