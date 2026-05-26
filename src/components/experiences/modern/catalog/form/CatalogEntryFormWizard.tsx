"use client";

import { Chip, Stack, Typography } from "@mui/joy";
import type { ReactNode } from "react";

export type CatalogAddWizardStep = "artist" | "album" | "rotation";

const STEPS: { id: CatalogAddWizardStep; label: string }[] = [
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
  { id: "rotation", label: "Rotation" },
];

type CatalogEntryFormWizardProps = {
  step: CatalogAddWizardStep;
  artistPanel: ReactNode;
  albumPanel: ReactNode;
  rotationPanel: ReactNode;
};

export default function CatalogEntryFormWizard({
  step,
  artistPanel,
  albumPanel,
  rotationPanel,
}: CatalogEntryFormWizardProps) {
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        flexWrap="wrap"
        data-testid="catalog-add-wizard-steps"
        aria-label="Add catalog entry steps"
      >
        {STEPS.map((s, index) => (
          <Stack key={s.id} direction="row" alignItems="center" spacing={0.75}>
            {index > 0 ? (
              <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                →
              </Typography>
            ) : null}
            <Chip
              size="sm"
              variant={s.id === step ? "solid" : "soft"}
              color={s.id === step ? "primary" : "neutral"}
              data-testid={`catalog-add-wizard-step-${s.id}`}
            >
              {index + 1} {s.label}
            </Chip>
          </Stack>
        ))}
      </Stack>

      <Stack
        data-testid={`catalog-add-wizard-panel-${step}`}
        aria-label={`Step ${stepIndex + 1}: ${STEPS[stepIndex]?.label}`}
      >
        {step === "artist" ? artistPanel : null}
        {step === "album" ? albumPanel : null}
        {step === "rotation" ? rotationPanel : null}
      </Stack>
    </Stack>
  );
}
