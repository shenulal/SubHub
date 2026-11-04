// Subscription CRUD
export {
  createSubscription,
  deleteSubscription,
  getLinkedPayments,
  getSubscription,
  getSubscriptionCached,
  getSubscriptions,
  updateSubscription,
  type LinkedPayment,
} from "./subscription-crud";

// Lifecycle (pause / resume / archive / restore / cancel / bulk / duplicates)
export {
  archiveSubscription,
  bulkUpdateSubscriptions,
  cancelSubscription,
  checkDuplicate,
  pauseSubscription,
  restoreSubscription,
  resumeSubscription,
  type LifecycleResult,
} from "./subscription-lifecycle";

// Notes & activity
export {
  addSubscriptionComment,
  getSubscriptionActivity,
  listSubscriptionComments,
  type SubscriptionActivityItem,
  type SubscriptionCommentItem,
} from "./subscription-comments";

// Attachments
export {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
  type AttachmentItem,
} from "./attachments";

// Price changes
export {
  acknowledgePriceChange,
  listPriceChanges,
  type PriceChangeItem,
} from "./price-changes";

// Export
export { exportSubscriptions, type ExportResult } from "./subscription-export";

// Calendar
export {
  getRenewalCalendar,
  getRenewalsByDate,
  type CalendarData,
  type RenewalItem,
  type RenewalsByDateResponse,
} from "./subscription-calendar";

// Suggestions
export {
  // Phase 3: CardTransaction 기반 추천
  createSubscriptionFromCardSuggestion,
  // SMP-78: PaymentRecord 기반 추천
  createSubscriptionFromPaymentSuggestion,
  createSubscriptionFromSuggestion,
  suggestFromCardTransactions,
  suggestSubscriptionsFromPayments,
  type CardTransactionSuggestion,
  type CreateSubscriptionFromCardSuggestionInput,
  type CreateSubscriptionFromPaymentSuggestionInput,
  type PaymentRecordSuggestion,
  type SubscriptionSuggestion,
} from "./subscription-suggestions";
