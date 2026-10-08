"use client";

import { Checkbox, FormControl, FormLabel, Radio, RadioGroup, Stack, Typography } from "@mui/joy";
import type { ReviewFields } from "@wxyc/shared";
import { REVIEW_COPY } from "./copy";

export type Consent = {
  publish_website: boolean;
  publish_apps: boolean;
  publish_instagram: boolean;
  credit: ReviewFields["credit"];
};

const SURFACES = [
  ["publish_website", REVIEW_COPY.consent.website],
  ["publish_apps", REVIEW_COPY.consent.apps],
  ["publish_instagram", REVIEW_COPY.consent.instagram],
] as const;

/**
 * The publishing question. The credit choice appears once any surface is
 * ticked; the DJ name is offered only to an account that has one.
 */
export default function ConsentBlock({
  value,
  onChange,
  djName,
  realName,
}: {
  value: Consent;
  onChange: (next: Consent) => void;
  djName?: string;
  realName?: string;
}) {
  const named = (label: string, name?: string) => (name ? `${label} (${name})` : label);
  const credits = [
    ...(djName ? [["dj_name", named(REVIEW_COPY.consent.djName, djName)] as const] : []),
    ["real_name", named(REVIEW_COPY.consent.realName, realName)] as const,
    ["none", REVIEW_COPY.consent.noName] as const,
  ];
  return (
    <Stack component="fieldset" spacing={1} sx={{ border: 0, p: 0, m: 0 }}>
      <FormLabel component="legend">{REVIEW_COPY.consent.legend}</FormLabel>
      {SURFACES.map(([key, label]) => (
        <Checkbox key={key} label={label} checked={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} />
      ))}
      {SURFACES.some(([key]) => value[key]) && (
        <FormControl>
          <FormLabel>{REVIEW_COPY.consent.creditLegend}</FormLabel>
          <RadioGroup value={value.credit ?? ""} onChange={(e) => onChange({ ...value, credit: e.target.value as Consent["credit"] })}>
            {credits.map(([key, label]) => (
              <Radio key={key} value={key} label={label} />
            ))}
          </RadioGroup>
        </FormControl>
      )}
      <Typography level="body-sm">{REVIEW_COPY.consent.notPublishedYet}</Typography>
    </Stack>
  );
}
