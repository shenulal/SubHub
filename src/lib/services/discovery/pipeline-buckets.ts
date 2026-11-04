// src/lib/services/discovery/pipeline-buckets.ts
/**
 * Pure bucketing for the renewal pipeline. Dates are compared on UTC calendar
 * days so a renewal "today" never lands in overdue because of server timezone.
 */
import type {
  PipelineCard,
  PipelineLane,
  PipelineLaneKey,
} from "@/types/discovery";

export interface BucketOptions {
  now: Date;
  weekDays: number;
  monthDays: number;
  /** Days after the due date before an item counts as overdue (default 0). */
  overdueGraceDays?: number;
}

export interface BucketInput {
  renewals: PipelineCard[];
  trialEndings: PipelineCard[];
  noticeDeadlines: PipelineCard[];
}

const MS_PER_DAY = 86_400_000;

export function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from `now` to `target`, both truncated to UTC days (negative = past). */
export function daysBetweenUtc(now: Date, target: Date): number {
  return Math.round((startOfUtcDay(target) - startOfUtcDay(now)) / MS_PER_DAY);
}

export function laneForDays(
  daysLeft: number,
  options: BucketOptions
): Exclude<PipelineLaneKey, "trialEnding" | "noticeDeadline"> {
  const grace = options.overdueGraceDays ?? 0;
  if (daysLeft < -grace) return "overdue";
  if (daysLeft <= options.weekDays) return "week";
  if (daysLeft <= options.monthDays) return "month";
  return "later";
}

function emptyLane(key: PipelineLaneKey): PipelineLane {
  return { key, count: 0, monthlyBase: 0, annualBase: 0, cards: [] };
}

function addCard(lane: PipelineLane, card: PipelineCard): PipelineLane {
  return {
    ...lane,
    count: lane.count + 1,
    monthlyBase: lane.monthlyBase + card.monthlyBase,
    annualBase: lane.annualBase + card.annualBase,
    cards: [...lane.cards, card],
  };
}

function sortByDue(cards: PipelineCard[]): PipelineCard[] {
  return [...cards].sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Group renewal cards into Overdue / This week / This month / Later and keep
 * trial endings and notice deadlines as separate lanes.
 */
export function bucketPipeline(
  input: BucketInput,
  options: BucketOptions
): PipelineLane[] {
  const lanes: Record<PipelineLaneKey, PipelineLane> = {
    overdue: emptyLane("overdue"),
    week: emptyLane("week"),
    month: emptyLane("month"),
    later: emptyLane("later"),
    trialEnding: emptyLane("trialEnding"),
    noticeDeadline: emptyLane("noticeDeadline"),
  };

  const grouped = input.renewals.reduce((acc, card) => {
    const key = laneForDays(card.daysLeft, options);
    return { ...acc, [key]: addCard(acc[key], card) };
  }, lanes);

  const withTrials = input.trialEndings.reduce(
    (acc, card) => ({ ...acc, trialEnding: addCard(acc.trialEnding, card) }),
    grouped
  );
  const withNotices = input.noticeDeadlines.reduce(
    (acc, card) => ({
      ...acc,
      noticeDeadline: addCard(acc.noticeDeadline, card),
    }),
    withTrials
  );

  return (Object.keys(withNotices) as PipelineLaneKey[]).map((key) => ({
    ...withNotices[key],
    cards: sortByDue(withNotices[key].cards),
  }));
}
