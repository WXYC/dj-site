"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Chip, FormControl, FormHelperText, Input, Stack, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useAddFormatMutation, useGetFormatsQuery } from "@/lib/features/catalog/api";
import { STATUS_CHIP_SX, formatLabel, formatTone } from "@/lib/features/experiences/modern/tokens/roles";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { tabularNumsSx } from "@/src/utilities/modern/recordTableSx";
import TermSection, { byName, sameTerm } from "./TermSection";

/**
 * A format exactly as the catalog draws it: the approved label for the six
 * names the shelf restyles, the server's text for every other, in the hue its
 * medium resolves to (vinyl gold, CD slate, neutral otherwise).
 */
export function FormatChip({ name }: { name: string }) {
  const tone = formatTone(name);
  return (
    <Chip size="sm" color={tone.color} variant={tone.variant} sx={STATUS_CHIP_SX}>
      {formatLabel(name)}
    </Chip>
  );
}

function FormatAdmin() {
  const { data: formats, isLoading, isError, refetch } = useGetFormatsQuery();
  const [addFormat, { isLoading: adding }] = useAddFormatMutation();
  const [name, setName] = useState("");

  const sorted = useMemo(
    () => [...(formats ?? [])].sort(byName((format) => format.format_name)),
    [formats],
  );
  const trimmed = name.trim();
  const duplicate = trimmed ? sorted.find((format) => sameTerm(format.format_name, trimmed)) : undefined;
  const canAdd = trimmed !== "" && duplicate == null && !adding;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canAdd) return;
    try {
      await addFormat({ name: trimmed }).unwrap();
      toast.success(`Added ${trimmed}.`);
      setName("");
    } catch (err) {
      // A no-status rejection is toasted here on purpose: the alternative is
      // a failed add nobody is ever told about.
      if (isUnmessagedHttpError(err)) {
        toast.error("Couldn't add the format. Please try again.");
      }
    }
  };

  const tone = trimmed ? formatTone(trimmed) : null;
  const helper = duplicate
    ? `${duplicate.format_name} already exists.`
    : tone && tone.color === "neutral"
      ? "Not a vinyl or CD name — it shows neutral in the catalog."
      : null;

  return (
    <RequireMD>
      <TermSection
        title="Formats"
        noun="format"
        count={formats ? formats.length : null}
        loading={isLoading}
        failed={isError && formats == null}
        onRetry={() => void refetch()}
        empty="No formats yet."
        columns={[
          { label: "Shows as", width: 120 },
          { label: "Stored as" },
          { label: "Added", width: 84, align: "right" },
        ]}
        composer={
          <form onSubmit={handleSubmit}>
            <FormControl error={duplicate != null}>
              <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ flexWrap: "wrap" }}>
                <Input
                  size="sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New format"
                  slotProps={{ input: { "aria-label": "New format name" } }}
                  sx={{ flex: "1 1 160px" }}
                />
                {trimmed && <FormatChip name={trimmed} />}
                <Button size="sm" color="success" type="submit" loading={adding} disabled={!canAdd}>
                  Add format
                </Button>
              </Stack>
              {helper && <FormHelperText>{helper}</FormHelperText>}
            </FormControl>
          </form>
        }
      >
        {sorted.map((format) => (
          <tr key={format.id} className="record-row">
            <td>
              <FormatChip name={format.format_name} />
            </td>
            <td>
              <Typography level="body-sm" textColor="text.secondary">
                {format.format_name}
              </Typography>
            </td>
            <td style={{ textAlign: "right" }}>
              <Typography level="body-xs" textColor="text.tertiary" sx={tabularNumsSx}>
                {formatRotationDate(format.add_date?.slice(0, 10)) || "—"}
              </Typography>
            </td>
          </tr>
        ))}
      </TermSection>
    </RequireMD>
  );
}

export default FormatAdmin;
