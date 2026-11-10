import { percentOf } from "@/utils/reviews";
import type { ReviewSummary } from "@/types/review";

const ROWS = [5, 4, 3, 2, 1] as const;

/**
 * The 5-star to 1-star breakdown (PRD 5.10). Each row says the numbers in text; the bar is a visual aid,
 * so the information never depends on seeing it.
 */
export function RatingDistribution({ summary }: { summary: ReviewSummary }) {
  return (
    <ul aria-label="Rating breakdown" className="space-y-2">
      {ROWS.map((stars) => {
        const count = summary.distribution[stars];
        const percent = percentOf(count, summary.count);
        return (
          <li key={stars} className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-sm">
            <span>{`${stars} ${stars === 1 ? "star" : "stars"}`}</span>
            <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span data-testid={`bar-${stars}`} className="block h-full rounded-full bg-star" style={{ width: `${percent}%` }} />
            </span>
            <span className="text-right text-muted-foreground">{`${count} (${percent}%)`}</span>
          </li>
        );
      })}
    </ul>
  );
}
