import { createServerSideProps } from "@/lib/features/session";
import ExperienceGap from "@/src/components/experiences/modern/ExperienceGap";

/**
 * Fallback for every `/dashboard` URL the modern slot has no page for — today
 * the classic-first librarian and rotation screens.
 *
 * Living in `default.tsx` rather than in per-route stubs means a classic-only
 * route added later is covered without a matching modern file.
 */
export default async function ModernDefault() {
  const { application } = await createServerSideProps();

  return (
    <ExperienceGap
      colorMode={application.colorMode}
      themeId={application.themeId}
    />
  );
}
