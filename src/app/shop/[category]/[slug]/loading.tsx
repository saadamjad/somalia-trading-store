import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="container-custom py-24 pt-28 md:py-28 md:pt-32">
      <Skeleton className="mb-8 h-4 w-64" />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Skeleton className="mb-4 aspect-square w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-20 w-20 shrink-0" />
            <Skeleton className="h-20 w-20 shrink-0" />
            <Skeleton className="h-20 w-20 shrink-0" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
