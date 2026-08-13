"use client";

import { usePathname } from "next/navigation";

import type { ColorMode } from "@/lib/features/experiences/types";
import { useExperienceSwitch } from "@/src/hooks/experienceSwitchHooks";
import "@/src/styles/classic/wxyc.css";

import Navigation from "./Navigation";

type ExperienceGapProps = {
  colorMode: ColorMode;
  themeId?: string;
};

/**
 * Rendered by the classic slot at URLs only the modern experience implements.
 *
 * The classic slot has no `layout.tsx`, so an unmatched URL would otherwise
 * paint an empty container with no navigation and no way back. This screen
 * carries its own `Navigation` for that reason — every real classic screen
 * renders one from its own `Layout/Main`, so hoisting it into a slot layout
 * would double it.
 */
export default function ExperienceGap({
  colorMode,
  themeId,
}: ExperienceGapProps) {
  const pathname = usePathname();
  const { switchExperience, pending } = useExperienceSwitch({
    target: "modern",
    colorMode,
    themeId,
  });

  return (
    <div style={{ textAlign: "center" }}>
      <Navigation />
      <div className="centerWidth">
        <p className="redlabel">This page is only in the modern interface.</p>
        <p className="text">
          {pathname ? <code>{pathname}</code> : "This page"} has no classic
          version. Switching will reload the site in the modern interface; you
          can switch back from the wand button at the bottom of any page.
        </p>
        <p>
          <button
            type="button"
            className="label"
            onClick={switchExperience}
            disabled={pending}
          >
            {pending ? "Switching…" : "Switch to the modern interface"}
          </button>
        </p>
      </div>
    </div>
  );
}
