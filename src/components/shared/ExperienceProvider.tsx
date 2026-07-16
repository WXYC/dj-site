"use client";

import { ExperienceId } from "@/lib/features/experiences/types";
import { ReactNode, createContext, useContext } from "react";

interface ExperienceContextValue {
  experience: ExperienceId;
}

const ExperienceContext = createContext<ExperienceContextValue | undefined>(
  undefined
);

interface ExperienceProviderProps {
  experience: ExperienceId;
  children: ReactNode;
}

export function ExperienceProvider({
  experience,
  children,
}: ExperienceProviderProps) {
  return (
    <ExperienceContext.Provider value={{ experience }}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperienceContext(): ExperienceContextValue {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error(
      "useExperienceContext must be used within an ExperienceProvider"
    );
  }
  return context;
}

