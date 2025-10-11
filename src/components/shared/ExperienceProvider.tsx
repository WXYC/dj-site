"use client";

import { ExperienceId } from "@/lib/features/experiences/types";
import { ReactNode, createContext, useContext } from "react";

/**
 * Experience Context
 * Provides the current experience ID throughout the component tree
 */
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

/**
 * ExperienceProvider
 * Wraps the application to provide experience context
 */
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

/**
 * Hook to access the current experience from context
 */
export function useExperienceContext(): ExperienceContextValue {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error(
      "useExperienceContext must be used within an ExperienceProvider"
    );
  }
  return context;
}

