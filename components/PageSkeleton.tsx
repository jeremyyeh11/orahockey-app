/** Shimmer placeholder shown instantly while a page's server render streams in. */
export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-7 w-36 rounded-lg bg-white/[0.07]" />
      <div className="h-28 rounded-[1.5rem] bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-white/[0.05]" />
        <div className="h-20 rounded-2xl bg-white/[0.05]" />
      </div>
      <div className="h-16 rounded-2xl bg-white/[0.05]" />
      <div className="h-16 rounded-2xl bg-white/[0.05]" />
      <div className="h-16 rounded-2xl bg-white/[0.05]" />
    </div>
  )
}
