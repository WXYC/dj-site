import { ExperienceId } from "@/lib/features/experiences/types";
import { ReactNode } from "react";

interface ExperienceSwitchProps {
  experience: ExperienceId;
  classic: ReactNode;
  modern: ReactNode;
  fallback?: ReactNode;
}

export default function ExperienceSwitch({
  experience,
  classic,
  modern,
  fallback,
}: ExperienceSwitchProps) {
  switch (experience) {
    case "classic":
      return <div id="classic-container">{classic}</div>;
    case "modern":
      return <div id="modern-container">{modern}</div>;
    default:
      return <div id="modern-container">{fallback || modern}</div>;
  }
}

