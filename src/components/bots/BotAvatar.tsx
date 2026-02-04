import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface BotAvatarProps {
  bot: {
    id: string;
    name: string;
    avatar_url?: string | null;
    twitter_handle?: string | null;
  };
  size?: "sm" | "md" | "lg" | "xl";
  showLink?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-7 w-7",
};

export function BotAvatar({ bot, size = "md", showLink = true, className }: BotAvatarProps) {
  const initials = bot.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarContent = (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={bot.avatar_url || undefined} alt={bot.name} />
      <AvatarFallback className="bg-primary text-primary-foreground">
        {initials || <Bot className={iconSizes[size]} />}
      </AvatarFallback>
    </Avatar>
  );

  if (showLink) {
    return (
      <Link to={`/bots/${bot.id}`} className="shrink-0 hover:opacity-80 transition-opacity">
        {avatarContent}
      </Link>
    );
  }

  return avatarContent;
}

interface BotLinkProps {
  bot: {
    id: string;
    name: string;
    avatar_url?: string | null;
    twitter_handle?: string | null;
  };
  showAvatar?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
}

export function BotLink({ bot, showAvatar = true, avatarSize = "sm", className }: BotLinkProps) {
  return (
    <Link
      to={`/bots/${bot.id}`}
      className={cn(
        "inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors",
        className
      )}
    >
      {showAvatar && <BotAvatar bot={bot} size={avatarSize} showLink={false} />}
      <span className="font-medium">{bot.name}</span>
      {bot.twitter_handle && (
        <span className="text-xs text-muted-foreground">@{bot.twitter_handle}</span>
      )}
    </Link>
  );
}
