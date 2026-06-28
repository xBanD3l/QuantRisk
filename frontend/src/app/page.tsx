import { Suspense } from "react";
import { HomeDashboard } from "@/components/home-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 p-5 lg:p-8">
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      }
    >
      <HomeDashboard />
    </Suspense>
  );
}
