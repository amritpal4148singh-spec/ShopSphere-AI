/** Longest message the assistant accepts; longer input is cut (PRD edge case 22 spirit: never break layout or the request). */
export const MAX_MESSAGE_LENGTH = 300;

/** How many product cards one answer shows. */
export const RESULT_LIMIT = 6;

/** Rating filters: "good ratings" means this many stars (PRD 7.3 example), "excellent / top rated" this many. */
export const GOOD_RATING = 4;
export const EXCELLENT_RATING = 4.5;
/** "Better ratings" moves the minimum up in steps of this size, from GOOD_RATING, and never above MAX_RATING_FILTER. */
export const RATING_STEP = 0.5;
export const MAX_RATING_FILTER = 4.8;

/** "Cheaper" lowers the price limit to the median of what was shown, but by at least this fraction of the highest price shown. */
export const MIN_PRICE_DROP = 0.15;
