import { Bot, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { AskIframe } from "@/components/student/AskIframe";
import { requireRole } from "@/lib/session";
import { AI_CONFIG } from "@/lib/config";

export default async function AskAbuLahyaPage() {
  await requireRole("student");

  if (!AI_CONFIG.iframeUrl) {
    return (
      <div className="px-4 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-ima-text">{AI_CONFIG.title}</h1>
          <p className="text-sm text-ima-text-secondary mt-1">{AI_CONFIG.subtitle}</p>
        </div>
        <Card variant="warm">
          <CardContent className="p-8 text-center">
            <Bot className="h-12 w-12 text-ima-text-muted mx-auto" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-ima-text mt-4">Coming Soon</h2>
            <p className="text-sm text-ima-text-secondary mt-2">
              The AI assistant will be available soon. Your coach Abu Lahya is setting it up.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ima-text">{AI_CONFIG.title}</h1>
          <p className="text-sm text-ima-text-secondary mt-1">{AI_CONFIG.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ima-text-secondary">
          <MessageSquare className="h-4 w-4 text-ima-warning" aria-hidden="true" />
          <span>24/7 Available</span>
        </div>
      </div>
      <Card variant="warm" className="overflow-hidden">
        <CardContent className="p-0">
          <AskIframe />
        </CardContent>
      </Card>
    </div>
  );
}
