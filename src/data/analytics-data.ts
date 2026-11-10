import analytics from "./analytics.json";
import type { StrategyCounts } from "@/types/analytics";
import type { StrategyId } from "@/services/recommendations";

/** Simulated seed counts per strategy (PRD 8.4, 10.3), so the analytics panel is demonstrable on a fresh browser. */
export const BASELINE_COUNTS = analytics.strategies as Partial<Record<StrategyId, StrategyCounts>>;

/** The visit count behind the simulated conversion rate on the admin overview. */
export const SIMULATED_VISITS: number = analytics.simulatedVisits;
