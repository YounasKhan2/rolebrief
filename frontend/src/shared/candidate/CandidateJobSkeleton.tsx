export default function CandidateJobSkeleton({
  count = 3,
}: {
  count?: number;
}) {
  return (
    <div
      className="radar-skeletons"
      role="status"
      aria-label="Loading opportunities"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="radar-job radar-job-skeleton"
          aria-hidden="true"
        >
          <div className="radar-skeleton-heading">
            <span />
            <div>
              <i />
              <i />
            </div>
          </div>
          <div className="radar-skeleton-facts" />
          <div className="radar-skeleton-evidence" />
          <div className="radar-skeleton-footer" />
        </div>
      ))}
    </div>
  );
}
