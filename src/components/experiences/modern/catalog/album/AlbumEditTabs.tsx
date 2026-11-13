"use client";

import { Box, Stack, Tab, TabList, TabPanel, Tabs } from "@mui/joy";
import { useMemo, useState, type ReactNode } from "react";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { VISUALLY_HIDDEN } from "@/src/components/experiences/modern/visuallyHidden";
import AlbumEditForm from "./AlbumEditForm";
import CompilationCreditsControl, { takesCompilationCredits } from "./CompilationCreditsControl";
import DiscogsUnavailableControl from "./DiscogsUnavailableControl";
import RotationClassifyControl from "./RotationClassifyControl";
import { useReportUnsaved } from "./useReportUnsaved";

type EditorTab = "details" | "discogs" | "rotation" | "credits";

type Reporters = Record<Exclude<EditorTab, "credits">, (unsaved: boolean) => void>;

const TABS: readonly { value: EditorTab; label: string }[] = [
  { value: "details", label: "Details" },
  { value: "discogs", label: "Discogs" },
  { value: "rotation", label: "Rotation" },
  { value: "credits", label: "Credits" },
];

interface AlbumEditTabsProps {
  /** Id of the tabs container, for the toggle that opens it to point at. */
  id?: string;
  /** The release being edited. The card is mounted per release, so the open tab and every draft reset with it. */
  album: AlbumEntry;
  /** The release's current tracklist as the read-only card draws it, shown read-only under the Discogs tab. */
  tracklist: ReactNode;
  /** Called with whether any tab holds unsaved changes. */
  onUnsavedChange?: (unsaved: boolean) => void;
}

/**
 * The release card's edit mode: one tab per edit control, each with its own
 * Save. Every panel stays mounted while hidden, so a draft survives a switch to
 * another tab, and a tab holding a draft carries a dot that is also read out.
 * A tab whose control would render nothing for this release is left out.
 */
export default function AlbumEditTabs({ id, album, tracklist, onUnsavedChange }: AlbumEditTabsProps) {
  const [tab, setTab] = useState<EditorTab>("details");
  const [unsaved, setUnsaved] = useState<Partial<Record<EditorTab, boolean>>>({});

  // One identity per tab for the life of the editor, so a control's report
  // effect runs only when its own draft changes.
  const report = useMemo<Reporters>(() => {
    const reporter = (key: EditorTab) => (next: boolean) => {
      setUnsaved((prev) => (Boolean(prev[key]) === next ? prev : { ...prev, [key]: next }));
    };
    return { details: reporter("details"), discogs: reporter("discogs"), rotation: reporter("rotation") };
  }, []);
  useReportUnsaved(Object.values(unsaved).some(Boolean), onUnsavedChange);

  const panels: Record<EditorTab, ReactNode> = {
    details: <AlbumEditForm album={album} onUnsavedChange={report.details} />,
    // Checking the Discogs link is the one edit task that needs the tracklist.
    discogs: (
      <Stack spacing={1}>
        <DiscogsUnavailableControl album={album} onUnsavedChange={report.discogs} />
        {tracklist}
      </Stack>
    ),
    rotation: (
      <RotationClassifyControl album={album} onUnsavedChange={report.rotation} />
    ),
    // No report: its only draft lives in the import dialog, which blocks the
    // tabs while open and discards the draft when it closes.
    credits: <CompilationCreditsControl album={album} />,
  };

  const tabs = TABS.filter(({ value }) => value !== "credits" || takesCompilationCredits(album));

  return (
    <Tabs
      id={id}
      aria-label="Edit release"
      size="sm"
      value={tab}
      onChange={(_, value) => {
        if (value !== null) {
          setTab(value as EditorTab);
        }
      }}
      sx={{ bgcolor: "transparent", mb: 1 }}
    >
      <TabList>
        {tabs.map(({ value, label }) => (
          <Tab key={value} value={value}>
            {label}
            {unsaved[value] && <UnsavedMarker />}
          </Tab>
        ))}
      </TabList>
      {tabs.map(({ value }) => (
        <TabPanel key={value} value={value} keepMounted sx={{ px: 0, pb: 0 }}>
          {panels[value]}
        </TabPanel>
      ))}
    </Tabs>
  );
}

/** A dot after a tab's label, read as ", unsaved changes". It takes the label's own color, so it adds no hue. */
function UnsavedMarker() {
  return (
    <>
      {/* The outer span stays inline: the accessible-name computation pads a
          non-inline child with spaces, even a hidden one, which would read
          "Details , unsaved changes". */}
      <Box component="span" aria-hidden="true">
        <Box
          component="span"
          data-unsaved-marker
          sx={{
            display: "inline-block",
            width: 6,
            height: 6,
            ml: 0.75,
            borderRadius: "50%",
            bgcolor: "currentColor",
            verticalAlign: "middle",
          }}
        />
      </Box>
      <Box component="span" sx={VISUALLY_HIDDEN}>
        , unsaved changes
      </Box>
    </>
  );
}
