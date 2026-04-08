import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

// Predefined skeleton variants
export function SkeletonCard() {
  return (
    <div className="bg-card p-6 rounded-lg shadow-soft border">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTableRow() {
  return (
    <tr>
      <td className="p-4"><Skeleton className="h-4 w-[150px]" /></td>
      <td className="p-4"><Skeleton className="h-4 w-[200px]" /></td>
      <td className="p-4"><Skeleton className="h-4 w-[100px]" /></td>
      <td className="p-4"><Skeleton className="h-4 w-[80px]" /></td>
      <td className="p-4"><Skeleton className="h-8 w-[60px]" /></td>
    </tr>
  )
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  }
  
  return <Skeleton className={cn("rounded-full", sizeClasses[size])} />
}