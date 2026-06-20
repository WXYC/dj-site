"use client";

import { useGetActiveExperienceQuery } from "@/lib/features/experiences/api";
import { ExperienceId } from "@/lib/features/experiences/types";
import Appbar from "./Appbar";
import AppbarClassic from "./AppbarClassic";

interface AppbarWrapperProps {
  /**
   * Server-resolved experience, threaded down from RootLayout. Seeding the
   * first render from this prop (rather than reading `data-experience` in an
   * effect) keeps SSR and client hydration in agreement, so classic users no
   * longer see a modern→classic appbar flash on first paint.
   */
  experience: ExperienceId;
}

export default function AppbarWrapper({ experience }: AppbarWrapperProps) {
  const { data: experienceFromApi } = useGetActiveExperienceQuery();

  // The live API value wins once loaded (so a runtime experience switch is
  // reflected without a reload); until then the server-resolved prop drives
  // the render synchronously.
  const activeExperience = experienceFromApi || experience;

  if (activeExperience === "classic") {
    return <AppbarClassic />;
  }

  return <Appbar />;
}
