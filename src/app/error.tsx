"use client";

import { StatusScreen } from "@/components/StatusScreen";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatusScreen
      code="500"
      title="Something went wrong"
      message="An unexpected error interrupted this page. Your data is safe — try again, or return to your dashboard."
      reset={reset}
      secondaryHref={null}
    />
  );
}
