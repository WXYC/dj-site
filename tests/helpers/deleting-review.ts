import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "./constants";

/** Serves `DELETE /reviews/:id` with a 204, handing the deleted id to `onDelete`. */
export const deletingReview = (onDelete?: (id: string) => void) =>
  http.delete(`${TEST_BACKEND_URL}/reviews/:id`, ({ params }) => {
    onDelete?.(String(params.id));
    return new HttpResponse(null, { status: 204 });
  });
