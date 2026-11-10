"use client";

import { BadgeCheck, EyeOff, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LocalBadge } from "@/components/ui/local-badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Review, VoteChoice } from "@/types/review";
import { StarDisplay } from "./star-rating";

export interface ReviewItemProps {
  review: Review;
  /** True when this review was written by the signed-in customer. */
  own: boolean;
  /** Administrators moderate instead of voting. */
  moderator: boolean;
  myVote: VoteChoice | undefined;
  onVote: (choice: VoteChoice) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
}

/** One review: stars, author, verified-purchase marker, text (escaped by React, never raw HTML), votes and the actions that apply. */
export function ReviewItem({ review, own, moderator, myVote, onVote, onEdit, onDelete, onToggleHidden }: ReviewItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <article aria-label={`Review by ${review.authorName}`} data-hidden={review.hidden ? "true" : "false"} className={cn("space-y-2 rounded-xl border p-4", review.hidden && "border-dashed bg-muted/50")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarDisplay rating={review.rating} />
        <p className="font-medium">{review.authorName}</p>
        {own ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Your review</span> : null}
        {review.verifiedPurchase ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <BadgeCheck aria-hidden="true" className="size-4" />
            Verified purchase
          </span>
        ) : null}
        {review.hidden ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <EyeOff aria-hidden="true" className="size-4" />
            Hidden from shoppers
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {review.createdAt !== null ? formatDate(review.createdAt) : "Date unavailable"}
        {review.updatedAt !== null ? " (edited)" : ""}
      </p>

      {review.body ? <p className="whitespace-pre-line break-words text-sm leading-relaxed">{review.body}</p> : <p className="text-sm italic text-muted-foreground">This reviewer left a rating without a written review.</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {own || moderator ? (
          <p className="text-xs text-muted-foreground">{`${review.helpful} found this helpful, ${review.notHelpful} did not`}</p>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" aria-pressed={myVote === "helpful"} onClick={() => onVote("helpful")} className={cn(myVote === "helpful" && "border-primary bg-accent text-accent-foreground")}>
              <ThumbsUp aria-hidden="true" />
              {`Helpful (${review.helpful})`}
              <span className="sr-only">{`, review by ${review.authorName}`}</span>
            </Button>
            <Button type="button" variant="outline" size="sm" aria-pressed={myVote === "not-helpful"} onClick={() => onVote("not-helpful")} className={cn(myVote === "not-helpful" && "border-primary bg-accent text-accent-foreground")}>
              <ThumbsDown aria-hidden="true" />
              {`Not helpful (${review.notHelpful})`}
              <span className="sr-only">{`, review by ${review.authorName}`}</span>
            </Button>
          </>
        )}

        {own && !confirmingDelete ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              Edit your review
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete your review
            </Button>
          </>
        ) : null}
        {own && confirmingDelete ? (
          <div role="group" aria-label="Confirm deleting your review" className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Delete your review?</span>
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              Confirm delete
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : null}

        {moderator ? (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <LocalBadge />
            <Button type="button" variant="outline" size="sm" onClick={onToggleHidden}>
              {review.hidden ? "Restore review" : "Hide review"}
              <span className="sr-only">{`, by ${review.authorName}`}</span>
            </Button>
          </span>
        ) : null}
      </div>
    </article>
  );
}
