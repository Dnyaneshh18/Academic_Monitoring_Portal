"use client";

import { PageHeader } from "@/components/Shell";
import { Button, Card, DashedClouds } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="relative">
      <DashedClouds />
      <PageHeader kicker="Error" title="This desk hit a problem" />
      <Card className="max-w-xl">
        <p className="text-[14px] leading-relaxed text-ink-600">
          Something went wrong while loading this screen. Your records are untouched — reload the section to try again.
        </p>
        <div className="mt-5 flex gap-3">
          <Button onClick={reset}>Try again</Button>
        </div>
      </Card>
    </div>
  );
}
