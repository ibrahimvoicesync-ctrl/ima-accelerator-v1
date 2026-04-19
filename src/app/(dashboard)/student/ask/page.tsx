import { Bot, MessageSquare } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { AskIframe } from "@/components/student/AskIframe";
import { requireRole } from "@/lib/session";
import { AI_CONFIG } from "@/lib/config";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono-bold)" };

export default async function AskAbuLahyaPage() {
  await requireRole("student");

  const iframeReady = Boolean(AI_CONFIG.iframeUrl);

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        <header className="motion-safe:animate-fadeIn">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
                style={MONO}
              >
                Ask
              </p>
              <h1 className="mt-3 text-[32px] md:text-[36px] font-semibold leading-[1.05] text-[#1A1A17] tracking-[-0.02em]">
                {AI_CONFIG.title}
              </h1>
              <p className="mt-2 max-w-[58ch] text-[15px] text-[#7A7466] leading-[1.55]">
                {AI_CONFIG.subtitle}
              </p>
            </div>
            {iframeReady && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-[#FDF3E0] border border-[#F0DFB3] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#D97706] shrink-0">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                24/7 Available
              </span>
            )}
          </div>
        </header>

        {iframeReady ? (
          <section
            aria-label="Assistant chat"
            className="mt-9 bg-white border border-[#EDE9E0] rounded-[14px] overflow-hidden motion-safe:animate-fadeIn"
            style={{ animationDelay: "100ms" }}
          >
            <AskIframe />
          </section>
        ) : (
          <section
            aria-label="Assistant unavailable"
            className="mt-9 bg-white border border-[#EDE9E0] rounded-[14px] p-10 text-center motion-safe:animate-fadeIn"
            style={{ animationDelay: "100ms" }}
          >
            <div className="mx-auto w-12 h-12 rounded-[12px] bg-[#F1EEE6] border border-[#EDE9E0] flex items-center justify-center">
              <Bot className="h-6 w-6 text-[#8A8474]" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-[22px] md:text-[24px] font-semibold text-[#1A1A17] tracking-[-0.01em] leading-tight">
              Coming soon
            </h2>
            <p className="mt-2 text-[14px] text-[#7A7466] leading-relaxed max-w-md mx-auto">
              The AI assistant will be available soon. Your coach Abu Lahya is setting it up.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
