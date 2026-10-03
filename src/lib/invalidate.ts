import type { QueryClient } from "@tanstack/react-query"

/**
 * Call after ANY write. The app is small, so refetch every query instead of tracking per-key lists
 * (per-key lists went stale: Home totals, bill pages, "chick_purchases" vs "chick-purchases").
 */
export const invalidateAll = (qc: QueryClient) => qc.invalidateQueries()
