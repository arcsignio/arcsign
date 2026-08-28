/**
 * @deprecated Use `useSignReview` from "@/hooks/useSignReview".
 *
 * Kept as an alias for one release so no call site is silently missed during
 * the rename. The tests assert both names resolve to the same implementation.
 */
export {
  useSignReview as useSignGate,
  useSignReview,
  type SignReviewParams as SignGateParams,
  type SignReview as SignGate,
  type SignReviewParams,
  type SignReview,
} from "@/hooks/useSignReview";
