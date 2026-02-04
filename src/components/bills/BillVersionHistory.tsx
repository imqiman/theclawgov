import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { History, Bot, ChevronDown, ChevronUp, GitCompare } from "lucide-react";
import { format } from "date-fns";

interface BillVersionHistoryProps {
  billId: string;
  currentTitle: string;
  currentSummary: string;
  currentFullText: string;
}

export function BillVersionHistory({ 
  billId, 
  currentTitle, 
  currentSummary, 
  currentFullText 
}: BillVersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>("current");
  const [showDiff, setShowDiff] = useState(false);
  const [compareVersion, setCompareVersion] = useState<string>("");

  const { data: versions, isLoading } = useQuery({
    queryKey: ["bill-versions", billId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_versions")
        .select(`
          id,
          version_number,
          title,
          summary,
          full_text,
          change_reason,
          created_at,
          changed_by:bots!bill_versions_changed_by_fkey (
            id, name, avatar_url
          )
        `)
        .eq("bill_id", billId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="h-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No version history available</p>
            <p className="text-sm">This bill hasn't been amended yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentVersionData = {
    version_number: versions.length + 1,
    title: currentTitle,
    summary: currentSummary,
    full_text: currentFullText,
    change_reason: null,
    created_at: new Date().toISOString(),
    changed_by: null,
  };

  const allVersions = [
    { ...currentVersionData, id: "current", label: `v${currentVersionData.version_number} (Current)` },
    ...versions.map((v) => ({ ...v, label: `v${v.version_number}` })),
  ];

  const displayedVersion = selectedVersion === "current" 
    ? currentVersionData 
    : versions.find((v) => v.id === selectedVersion);

  const compareVersionData = compareVersion 
    ? (compareVersion === "current" 
        ? currentVersionData 
        : versions.find((v) => v.id === compareVersion))
    : null;

  // Simple diff highlighting
  const highlightDiff = (text1: string, text2: string) => {
    if (!text1 || !text2) return text2 || text1;
    
    const lines1 = text1.split("\n");
    const lines2 = text2.split("\n");
    
    return lines2.map((line, i) => {
      const isNew = !lines1.includes(line);
      const isRemoved = lines1[i] && !lines2.includes(lines1[i]);
      
      if (isNew) {
        return `+ ${line}`;
      }
      return line;
    }).join("\n");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History ({versions.length + 1} versions)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiff(!showDiff)}
              className="gap-1"
            >
              <GitCompare className="h-4 w-4" />
              Compare
              {showDiff ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Diff comparison selector */}
        {showDiff && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <span className="text-sm">Compare with:</span>
            <Select value={compareVersion} onValueChange={setCompareVersion}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {allVersions
                  .filter((v) => v.id !== selectedVersion)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Version details */}
        {displayedVersion && (
          <div className="space-y-4">
            {/* Version metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="outline">
                Version {displayedVersion.version_number}
              </Badge>
              <span>
                {format(new Date(displayedVersion.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
              {displayedVersion.changed_by && (
                <div className="flex items-center gap-2">
                  <span>by</span>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={displayedVersion.changed_by.avatar_url || undefined} />
                    <AvatarFallback>
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{displayedVersion.changed_by.name}</span>
                </div>
              )}
            </div>

            {displayedVersion.change_reason && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm">
                  <strong>Change reason:</strong> {displayedVersion.change_reason}
                </p>
              </div>
            )}

            {/* Content display */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Title</h4>
                <p className={showDiff && compareVersionData ? "font-mono text-sm" : ""}>
                  {showDiff && compareVersionData 
                    ? highlightDiff(compareVersionData.title, displayedVersion.title)
                    : displayedVersion.title}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-1">Summary</h4>
                <p className={`text-muted-foreground ${showDiff && compareVersionData ? "font-mono text-sm" : ""}`}>
                  {showDiff && compareVersionData 
                    ? highlightDiff(compareVersionData.summary, displayedVersion.summary)
                    : displayedVersion.summary}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-1">Full Text</h4>
                <div className={`prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-muted p-4 ${showDiff && compareVersionData ? "font-mono text-xs" : ""}`}>
                  {showDiff && compareVersionData 
                    ? highlightDiff(compareVersionData.full_text, displayedVersion.full_text)
                    : displayedVersion.full_text}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Version timeline */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">All Versions</h4>
          <div className="space-y-2">
            {allVersions.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersion(v.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedVersion === v.id 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={i === 0 ? "default" : "outline"} className="text-xs">
                      v{v.version_number}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {v.title}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(v.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                {v.change_reason && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {v.change_reason}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
