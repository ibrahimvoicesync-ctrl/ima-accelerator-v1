"use client";

import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export function DiscordEmbed() {
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;
  const channelId = process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID;

  if (!guildId || !channelId) {
    return (
      <Card variant="warm">
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 text-ima-text-muted mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ima-text mt-4">Discord Not Configured</h2>
          <p className="text-sm text-ima-text-secondary mt-2">
            The Discord community embed will be available once your admin configures the server connection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <iframe
      src={`https://e.widgetbot.io/channels/${guildId}/${channelId}`}
      title="Discord Community"
      height="600"
      width="100%"
      className="rounded-xl border border-ima-border"
      aria-label="Discord community chat"
    />
  );
}
