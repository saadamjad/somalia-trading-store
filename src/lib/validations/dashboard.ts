import { z } from "zod";

/**
 * Phase 13 — Admin Dashboard period filter. Deliberately a small preset set (not a
 * custom date-range picker — no such component exists in the design system yet, and
 * the plan explicitly says a preset dropdown is enough for this phase).
 */
export const DASHBOARD_PERIODS = ["today", "7d", "30d", "all"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

/** Query params for GET /api/admin/dashboard. */
export const dashboardQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default("30d"),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
