"use client";

import { useGetActiveExperienceQuery } from "@/lib/features/experiences/api";
import { useEffect, useState } from "react";
import Appbar from "./Appbar";
import AppbarClassic from "./AppbarClassic";

export default function AppbarWrapper() {
  const { data: experienceFromApi } = useGetActiveExperienceQuery();
  const [experienceFromDOM, setExperienceFromDOM] = useState<string | null>(null);

  // Read from data-experience attribute on HTML element (set by server)
  useEffect(() => {
    if (typeof document !== "undefined") {
      const htmlElement = document.documentElement;
      const dataExperience = htmlElement.getAttribute("data-experience");
      if (dataExperience) {
        setExperienceFromDOM(dataExperience);
      }
    }
  }, []);

  // Use API data if available, otherwise fall back to DOM attribute
  const activeExperience = experienceFromApi || experienceFromDOM || "modern";
  
  if (activeExperience === "classic") {
    return <AppbarClassic />;
  }
  
  return <Appbar />;
}
