import reviews from "./reviews.json";
import type { SampleReview } from "@/types/review";

/** The sample reviews (PRD 10.3). Reviews written on this device live in local storage, not here. */
export const SAMPLE_REVIEWS: readonly SampleReview[] = reviews.reviews as SampleReview[];
