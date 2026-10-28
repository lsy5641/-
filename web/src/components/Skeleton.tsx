export function SkeletonLine({ w = '100%' }: { w?: string }) {
  return <div className="sk-line" style={{ width: w }} />;
}

export function SkeletonCard() {
  return (
    <div className="card sk-card" aria-hidden="true">
      <SkeletonLine w="38%" />
      <SkeletonLine />
      <SkeletonLine w="82%" />
    </div>
  );
}

export function SkeletonCards({ count = 2 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}</>;
}