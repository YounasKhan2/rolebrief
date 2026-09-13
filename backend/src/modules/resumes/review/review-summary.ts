import { StoredDraftItem } from "./review-policy";

export function reviewSummary(items: StoredDraftItem[]) {
  const totalItems = items.length;
  const sensitiveExcluded = items.filter((item) => item.classification === "SENSITIVE_EXCLUDED").length;
  const unsupported = items.filter((item) => item.classification === "UNSUPPORTED_OR_UNREADABLE").length;
  const pending = items.filter((item) => isReviewable(item) && item.reviewState === "PENDING").length;
  const accepted = items.filter((item) => item.reviewState === "ACCEPTED").length;
  const edited = items.filter((item) => item.reviewState === "EDITED_ACCEPTED").length;
  const rejected = items.filter((item) => item.reviewState === "REJECTED").length;
  const categorized = items.filter((item) => item.reviewState === "CATEGORIZED").length;
  const needsConfirmation = items.filter((item) => item.classification === "NEEDS_CONFIRMATION" && item.reviewState === "PENDING").length;
  return {
    totalItems,
    pending,
    accepted,
    edited,
    rejected,
    categorized,
    needsConfirmation,
    sensitiveExcluded,
    unsupported,
    reviewComplete: pending === 0
  };
}

export function isReviewable(item: StoredDraftItem) {
  return item.classification !== "SENSITIVE_EXCLUDED" && item.classification !== "UNSUPPORTED_OR_UNREADABLE";
}
