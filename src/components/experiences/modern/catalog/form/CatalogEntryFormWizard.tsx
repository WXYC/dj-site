"use client";

import { Chip, Stack, Typography } from "@mui/joy";
import { Fragment, type ReactNode } from "react";
import CatalogFormStepStage from "./CatalogFormStepStage";
import { catalogAddWizardNavSx, catalogAddWizardStepSx } from "./catalogFormLayout";

export type CatalogAddWizardStep = "artist" | "album" | "rotation";

const STEPS: { id: CatalogAddWizardStep; label: string }[] = [
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
  { id: "rotation", label: "Rotation" },
];

type CatalogAddWizardNavProps = {
  step: CatalogAddWizardStep;
};

export function CatalogAddWizardNav({ step }: CatalogAddWizardNavProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={catalogAddWizardNavSx}
      data-testid="catalog-add-wizard-steps"
      aria-label="Add catalog entry steps"
    >
      {STEPS.map((s, index) => (
        <Fragment key={s.id}>
          {index > 0 ? (
            <Typography
              level="body-xs"
              sx={{ color: "text.tertiary", flexShrink: 0 }}
            >
              →
            </Typography>
          ) : null}
          <Chip
            size="sm"
            variant={s.id === step ? "solid" : "soft"}
            color={s.id === step ? "primary" : "neutral"}
            sx={catalogAddWizardStepSx}
            data-testid={`catalog-add-wizard-step-${s.id}`}
          >
            {index + 1} {s.label}
          </Chip>
        </Fragment>
      ))}
    </Stack>
  );
}

type CatalogEntryFormWizardProps = {
  step: CatalogAddWizardStep;
  artistPanel: ReactNode;
  albumPanel: ReactNode;
  rotationPanel: ReactNode;
};

/** @deprecated Prefer CatalogAddWizardNav + CatalogFormStepStage inside CatalogEntryFormCard */
export default function CatalogEntryFormWizard({
  step,
  artistPanel,
  albumPanel,
  rotationPanel,
}: CatalogEntryFormWizardProps) {
  return (
    <Stack spacing={2}>
      <CatalogAddWizardNav step={step} />
      <CatalogFormStepStage
        activeStep={step}
        data-testid={`catalog-add-wizard-panel-${step}`}
        steps={{
          artist: artistPanel,
          album: albumPanel,
          rotation: rotationPanel,
        }}
      />
    </Stack>
  );
}
