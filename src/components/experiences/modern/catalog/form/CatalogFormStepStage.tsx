"use client";

import { Box } from "@mui/joy";
import type { ReactNode } from "react";
import { catalogFormStepLayerSx, catalogFormStepStageSx } from "./catalogFormLayout";

type CatalogFormStepStageProps<Step extends string> = {
  activeStep: Step;
  steps: Record<Step, ReactNode>;
  "data-testid"?: string;
};

/**
 * Renders every step in the same grid cell so modal height stays at the
 * tallest step (inactive steps use visibility:hidden but still affect layout).
 */
export default function CatalogFormStepStage<Step extends string>({
  activeStep,
  steps,
  "data-testid": dataTestId,
}: CatalogFormStepStageProps<Step>) {
  return (
    <Box data-testid={dataTestId} sx={catalogFormStepStageSx}>
      {(Object.keys(steps) as Step[]).map((stepId) => (
        <Box
          key={stepId}
          sx={catalogFormStepLayerSx(activeStep === stepId)}
          aria-hidden={activeStep !== stepId}
          data-testid={`catalog-form-step-layer-${stepId}`}
        >
          {steps[stepId]}
        </Box>
      ))}
    </Box>
  );
}
