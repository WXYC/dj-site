import { ExperienceId } from "@/lib/features/experiences/types";
import Appbar from "./Appbar";
import AppbarClassic from "./AppbarClassic";

interface AppbarWrapperProps {
  /**
   * Server-resolved experience, threaded down from RootLayout. Reading it from
   * the prop (rather than a client re-fetch) keeps SSR and client hydration in
   * agreement, so classic users don't see a modern→classic appbar flash on
   * first paint. A switch persists the cookie and hard-reloads (ThemeSwitcher),
   * so the server-resolved value is always current.
   */
  experience: ExperienceId;
}

export default function AppbarWrapper({ experience }: AppbarWrapperProps) {
  if (experience === "classic") {
    return <AppbarClassic experience={experience} />;
  }

  return <Appbar experience={experience} />;
}
