/**
 * SignReview — everything a user should see before authorising a signature.
 *
 * The order is deliberate: what the transaction does, then what is risky about
 * it, then the consent checkbox, and only then the verification fingerprint.
 * The digest sits last because it is an optional deep check — it must not stand
 * between the user and understanding the transaction.
 *
 * Every signing screen renders this one component so the layout is identical
 * wherever a signature is requested; a user should not have to relearn the
 * screen depending on how they got there.
 */

import { ClearSignSummary } from "@/components/ClearSignSummary";
import { DigestPanel } from "@/components/DigestPanel";
import type { SignReview as SignReviewData } from "@/hooks/useSignReview";

export function SignReview({ review }: { review: SignReviewData }) {
  // Nothing decoded and no security verdict yet — the transaction is not ready.
  if (!review.intent && !review.security) return null;

  return (
    <>
      <ClearSignSummary
        intent={review.intent ?? null}
        security={review.security}
        acknowledged={review.acknowledged}
        onAcknowledgeChange={review.setAcknowledged}
      />
      {review.intent?.digest && (
        <DigestPanel digest={review.intent.digest} raw={review.intent.raw} />
      )}
    </>
  );
}

export default SignReview;
