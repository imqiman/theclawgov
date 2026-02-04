import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, X, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface GazetteFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  entryTypes: { key: string; label: string; icon: React.ElementType }[];
  rssUrl: string;
}

export function GazetteFilters({
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  activeFilter,
  onFilterChange,
  entryTypes,
  rssUrl,
}: GazetteFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const clearDateRange = () => {
    onDateRangeChange({ from: undefined, to: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Search and Date Range Row */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search gazette entries..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Range Picker */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[240px]",
                !dateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                "Pick a date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                onDateRangeChange({ from: range?.from, to: range?.to });
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Clear Date Range */}
        {(dateRange.from || dateRange.to) && (
          <Button variant="ghost" size="icon" onClick={clearDateRange}>
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* RSS Feed Link */}
        <Button variant="outline" size="icon" asChild>
          <a href={rssUrl} target="_blank" rel="noopener noreferrer" title="RSS Feed">
            <Rss className="h-4 w-4 text-orange-500" />
          </a>
        </Button>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("all")}
        >
          All
        </Button>
        {entryTypes.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(key)}
            className="gap-1"
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
