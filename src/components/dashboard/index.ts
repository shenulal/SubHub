/**
 * New Dashboard Components - Barrel Export
 * All dashboard components are consolidated in this directory (Phase 3 refactor)
 */

// Main client
export { NewDashboardClient } from "./new-dashboard-client";

// In-house components
export { AnomalyCard } from "./anomaly-card";
export { AppsWithoutSubCard } from "./apps-without-sub-card";
export {
  BentoAnomalyCard,
  BentoAppsWithoutSubCard,
  BentoKpiCards,
  BentoTerminatedCard,
  BentoTotalCostCard,
} from "./bento-kpi-cards";
export { BentoOptimizationHero } from "./bento-optimization-hero";
export { TerminatedCard } from "./terminated-card";
export { TotalCostCard } from "./total-cost-card";

// Consolidated components (previously dashboard/, dashboard2/, v2-cost/, v2-seat/, v3/)
export { AppsByCategory } from "./apps-by-category";
export { CostAppsTable } from "./cost-apps-table";
export { CostBarChart } from "./cost-bar-chart";
export {
  DashboardAlertBanner,
  type DashboardAlertItem,
} from "./dashboard-alert-banner";
export { DepartmentSpendChart } from "./department-spend-chart";
export { PerUserLicenseAppsChart } from "./per-user-license-apps-chart";
export { RecentActivity } from "./recent-activity";
export { SeatUtilizationChart } from "./seat-utilization-chart";
export { UpcomingRenewals } from "./upcoming-renewals";
