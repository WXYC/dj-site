"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { NotOnDiscogsBadge } from "@/src/components/experiences/modern/catalog/AlbumArtwork";
import { entryFieldTextColor } from "@/src/utilities/modern/entryFieldColors";
import { PlayArrow } from "@mui/icons-material";
import { AspectRatio, Box, IconButton, Stack, Tooltip } from "@mui/joy";
import { useDragControls } from "motion/react";
import { memo, useState } from "react";
import DragButton from "../Components/DragButton";
import EntryTimeCell from "../Components/EntryTimeCell";
import DraggableEntryWrapper from "../DraggableEntryWrapper";
import { flowsheetChipsReservePx, FLOWSHEET_XL_QUERY } from "../tableStyles";
import FlowsheetEntryField from "./FlowsheetEntryField";
import SongEntryControls from "./SongEntryControls";
import SongEntryStatusChips from "./SongEntryStatusChips";
import { usePlayNow } from "./usePlayNow";

// Memoized: entry updates flow through Immer (RTK Query cache patches +
// slice reducers), so a changed entry always arrives as a new object
// reference and unchanged rows can safely skip re-rendering.
const SongEntry = memo(function SongEntry({
  playing,
  queue,
  entry,
  draggable = true,
  readOnly = false,
  timeLabel,
}: {
  playing: boolean;
  queue: boolean;
  entry: FlowsheetSongEntry;
  draggable?: boolean;
  /** Suppresses every editing affordance, whatever the live-show state says. */
  readOnly?: boolean;
  /** The leading Time cell's label; see EntryTimeCell for the column contract. */
  timeLabel?: string;
}) {
  const { live, autoplay, currentShow } = useShowControl();
  const playNow = usePlayNow(entry);

  const controls = useDragControls();

  const [canClose, setCanClose] = useState(false);

  // Above xl the artist and label get their own columns; below they stack
  // into the title/album cells as quieter second lines. Each field mounts
  // exactly once (never two CSS-toggled copies) so its editing state can't
  // desync between layouts. Safe to gate with JS: the flowsheet pages only
  // render after mount (see @entries/page.tsx), so there's no SSR pass to
  // mismatch.
  const isXl = useMediaQuery(FLOWSHEET_XL_QUERY);

  // An archive surface says read-only outright rather than relying on this
  // resolving false, which would tie a view of a past set to live-show state.
  const editable = !readOnly && (queue || (live && entry.show_id == currentShow));

  const image = entry.artwork_url ?? "/img/cassette.png";

  const handleMouseEnter = () => {
    if (queue && live) {
      setCanClose(true);
    }
  };

  const handleMouseLeave = () => {
    setCanClose(false);
  };

  return (
    <DraggableEntryWrapper
      controls={controls}
      entry={entry}
      variant={queue ? "soft" : playing ? "solid" : "plain"}
      color={queue ? "success" : playing ? "primary" : "neutral"}
      draggable={draggable}
      style={{
        height: "60px",
        borderRadius: "md",
        marginBottom: playing && autoplay ? "0.25rem" : "initial",
        opacity: queue ? 0.85 : 1,
      }}
    >
      {timeLabel !== undefined && <EntryTimeCell label={timeLabel} />}
      <td
        style={{ position: "relative" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {editable && draggable && <DragButton controls={controls} />}
        <Stack direction="row" sx={{ position: "relative" }}>
          <AspectRatio
            ratio={1}
            sx={{
              flexBasis: "calc(60px - 12px)",
              borderRadius: "9px",
              minWidth: "48px",
              minHeight: "48px",
            }}
          >
            {entry.discogsUnavailable === true ? (
              <NotOnDiscogsBadge size={48} note={entry.discogsUnavailableNote} />
            ) : (
              <img
                src={image}
                alt="album art"
                style={{ minWidth: "48px", minHeight: "48px" }}
              />
            )}
          </AspectRatio>
          {canClose && queue && (
            <Tooltip
              title="Play this song now (add to flowsheet)"
              placement="right"
              variant="outlined"
              size="sm"
            >
              <IconButton
                size="sm"
                variant="solid"
                color="primary"
                sx={{
                  position: "absolute",
                  left: editable ? "10px" : "0px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 10,
                }}
                onClick={playNow}
              >
                <PlayArrow />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </td>
      {/* Tubafrenzy reading order (Artist – Song – Album – Label, see #820):
          above xl the artist leads as its own column. */}
      {isXl && (
        <td
          className="col-artist"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <FlowsheetEntryField
            label="artist"
            name={"artist_name"}
            entry={entry}
            playing={playing}
            queue={queue}
            editable={editable}
            level="body-sm"
            textColor={entryFieldTextColor("artist", playing)}
          />
        </td>
      )}
      <td onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <FlowsheetEntryField
          label="song"
          name={"track_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="title-sm"
          textColor={entryFieldTextColor("song", playing)}
        />
        {/* Below xl the artist's own column is hidden; it stacks here under
            the title as a quieter second line (a two-line playlist cell). */}
        {!isXl && (
          <Box>
            <FlowsheetEntryField
              label="artist"
              name={"artist_name"}
              entry={entry}
              playing={playing}
              queue={queue}
              editable={editable}
              level="body-xs"
              textColor={entryFieldTextColor("artist", playing)}
            />
          </Box>
        )}
      </td>
      <td onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <FlowsheetEntryField
          label="album"
          name={"album_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("album", playing)}
        />
        {/* Below xl the label's own column is hidden; it stacks here under
            the album as a quieter second line. */}
        {!isXl && (
          <Box>
            <FlowsheetEntryField
              label="label"
              name={"record_label"}
              entry={entry}
              playing={playing}
              queue={queue}
              editable={editable}
              level="body-xs"
              textColor={entryFieldTextColor("label", playing)}
            />
          </Box>
        )}
      </td>
      {isXl && (
        <td
          className="col-label"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <FlowsheetEntryField
            label="label"
            name={"record_label"}
            entry={entry}
            playing={playing}
            queue={queue}
            editable={editable}
            level="body-sm"
            textColor={entryFieldTextColor("label", playing)}
          />
        </td>
      )}
      <td
        style={{ position: "relative" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Stack
          direction="row"
          gap={0.75}
          alignItems="center"
          flexWrap="wrap"
          // Reserve the hover action cluster's footprint (it overlays this cell
          // from the right edge — the absolutely-positioned Stack below) so no
          // chip renders underneath it, where it would be covered and
          // unclickable on hover. The reserve tracks how many controls the row
          // shows; the column is sized to leave a chip's width beside it.
          sx={{ pr: `${flowsheetChipsReservePx(editable)}px` }}
        >
          <SongEntryStatusChips entry={entry} editable={editable} />
        </Stack>
        <Stack
          direction="row"
          justifyContent={"flex-end"}
          alignItems={"center"}
          spacing={0.5}
          className="row-actions"
          sx={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            borderRadius: "sm",
            pl: 3,
            pr: 0.5,
            // At narrower breakpoints this bar's content can overflow its
            // status column and sit visually on top of the label field's
            // edit button. The bar itself shouldn't intercept clicks meant
            // for whatever is underneath — only its actual controls should.
            pointerEvents: "none",
            "& > *": { pointerEvents: "auto" },
          }}
        >
          <SongEntryControls entry={entry} queue={queue} editable={editable} />
        </Stack>
      </td>
    </DraggableEntryWrapper>
  );
});

export default SongEntry;
