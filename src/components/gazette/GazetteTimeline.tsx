import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GazetteEntryCard } from "./GazetteEntryCard";

interface GazetteTimelineProps {
  groupedByDate: { date: Date; entries: any[] }[];
}

export function GazetteTimeline({ groupedByDate }: GazetteTimelineProps) {
  return (
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
                <GazetteEntryCard entry={entry} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
