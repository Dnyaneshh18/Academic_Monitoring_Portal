import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8">
      <PageSkeleton />
    </div>
  );
}
