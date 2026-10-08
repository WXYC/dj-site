"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isReviewSubjectNotHeld, useCreateReviewMutation } from "@/lib/features/reviews/api";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { REVIEW_COPY } from "./copy";

/** Starts a draft for a library release and opens it; renders nothing itself. */
export default function NewReview({ albumId }: { albumId: number }) {
  const { data: auth } = useAuthentication();
  const visible = canSeeReviews(("user" in auth ? auth.user?.authority : undefined) ?? Authorization.NO);
  const [createReview] = useCreateReviewMutation();
  const router = useRouter();
  // Strict Mode runs the effect twice; a second POST would start a second draft.
  const started = useRef(false);

  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;
    createReview({ album_id: albumId })
      .unwrap()
      .then((review) => router.replace(`/dashboard/reviews/${review.id}`))
      .catch((err) => {
        if (isReviewSubjectNotHeld(err)) toast(REVIEW_COPY.subjectNotHeld);
        else toast.error(REVIEW_COPY.couldNotStart);
        router.replace("/dashboard/reviews");
      });
  }, [visible, albumId, createReview, router]);

  return null;
}
