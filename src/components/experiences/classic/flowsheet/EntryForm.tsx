"use client";

import { FormEvent, useState } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { sortRotationReleases } from "@/lib/features/rotation/sort";
import { Rotation } from "@/lib/features/rotation/types";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import {
  stationBreakpointMessage,
  STATION_TIME_ZONE,
} from "@/src/utilities/stationTime";

type EntryType = "track" | "talkset" | "breakpoint";
type ReleaseType = "rotationRelease" | "libraryRelease" | "otherRelease";
type RotationType = "heavy" | "medium" | "light" | "singles";

const MS_PER_HOUR = 3_600_000;

// Tubafrenzy labels the breakpoint option with the show's next hour
// ("3:00 PM Breakpoint"), computed against the station's wall clock.
function nextStationHourLabel(now: Date = new Date()): string {
  const nextHour = new Date(
    now.getTime() - (now.getTime() % MS_PER_HOUR) + MS_PER_HOUR
  );
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(nextHour);
}

export default function EntryForm({
  onSuccess,
  isLive = true,
}: {
  onSuccess?: () => void;
  isLive?: boolean;
}) {
  const dispatch = useAppDispatch();
  const [addToFlowsheet, { isLoading }] = useAddToFlowsheetMutation();

  const [entryType, setEntryType] = useState<EntryType>("track");
  // Defaults to WXYC Library: DJs pull from the library far more often than
  // rotation, so rotation-first cost an extra switch on most entries.
  const [releaseType, setReleaseType] = useState<ReleaseType>("libraryRelease");
  const [rotationType, setRotationType] = useState<RotationType | "">("");
  // Holds the picked release's `rotation_id` (rotation row PK), NOT its album
  // id. `release.id` can be a synthesized negative for library-unlinked
  // rotation rows (see `synthesizeAlbumId` in catalog/conversions.ts); keying
  // on `rotation_id` keeps the picker working regardless of library-link
  // state (dj-site#698). 0 means nothing selected.
  const [selectedRotationId, setSelectedRotationId] = useState<number>(0);
  const [artistName, setArtistName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [labelName, setLabelName] = useState("");
  const [requestFlag, setRequestFlag] = useState(false);
  const [segue, setSegue] = useState(false);

  const { data: rotationData } = useGetRotationQuery();

  // Sorted A→Z by artist (ties broken by album title) so the native <select>
  // type-ahead lands the DJ in the right neighborhood. WXYC/dj-site#745.
  const releasesByBin: Record<RotationType, ReturnType<typeof sortRotationReleases>> = {
    heavy: sortRotationReleases(
      rotationData?.filter((r) => r.rotation_bin === Rotation.H) || []
    ),
    medium: sortRotationReleases(
      rotationData?.filter((r) => r.rotation_bin === Rotation.M) || []
    ),
    light: sortRotationReleases(
      rotationData?.filter((r) => r.rotation_bin === Rotation.L) || []
    ),
    singles: sortRotationReleases(
      rotationData?.filter((r) => r.rotation_bin === Rotation.S) || []
    ),
  };

  const handleRotationSelect = (rotationId: number) => {
    setSelectedRotationId(rotationId);
    const release = rotationData?.find((r) => r.rotation_id === rotationId);
    if (release) {
      setArtistName(release.artist?.name ?? "");
      setReleaseTitle(release.title);
      setLabelName(release.label);
    }
  };

  const resetTrackFields = () => {
    setArtistName("");
    setSongTitle("");
    setReleaseTitle("");
    setLabelName("");
    setRequestFlag(false);
    setSegue(false);
    setSelectedRotationId(0);
    setRotationType("");
  };

  // The Add button is disabled (in track mode) until enough fields are present
  // to make a meaningful submission: a song title plus either an artist name
  // (Library/Other) or a selected rotation release (Rotation). Talkset and
  // Breakpoint modes have no track to gate on, so they're always enabled.
  const canSubmitTrack =
    songTitle.trim().length > 0 &&
    (releaseType === "rotationRelease"
      ? selectedRotationId > 0
      : artistName.trim().length > 0);
  const canSubmit = entryType === "track" ? canSubmitTrack : true;

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!canSubmit) return;

    let submissionData: Parameters<typeof addToFlowsheet>[0];

    if (entryType === "talkset") {
      submissionData = {
        message: "Talkset",
        entry_type: FlowsheetEntryType.talkset,
      };
    } else if (entryType === "breakpoint") {
      submissionData = {
        message: stationBreakpointMessage(),
        entry_type: FlowsheetEntryType.breakpoint,
      };
    } else if (releaseType === "rotationRelease" && selectedRotationId > 0) {
      const release = rotationData?.find(
        (r) => r.rotation_id === selectedRotationId
      );
      if (!release) return;
      // Library-unlinked rotation rows have a synthesized negative
      // `release.id` (see `synthesizeAlbumId` in catalog/conversions.ts).
      // BS's POST /flowsheet rotation variant
      // (`FlowsheetCreateSongFromCatalog`) requires a real positive
      // `album_id`, so we fall back to the freeform variant for unlinked
      // rows. This trades the rotation linkage (sibling: dj-site#691) for
      // a non-error submit; recovering the linkage requires BS to accept
      // `rotation_id` without `album_id` (Option C, BS-side schema work).
      // Aligned with sibling dj-site#608's fix shape.
      if (typeof release.id === "number" && release.id > 0) {
        submissionData = {
          album_id: release.id,
          track_title: songTitle,
          rotation_id: release.rotation_id,
          request_flag: requestFlag,
          segue,
          record_label: labelName || release.label,
          rotation_bin: release.rotation_bin,
        };
      } else {
        submissionData = {
          artist_name: release.artist?.name ?? "",
          album_title: release.title,
          track_title: songTitle,
          request_flag: requestFlag,
          segue,
          record_label: labelName || release.label,
        };
      }
    } else {
      // libraryRelease + otherRelease both fall through to the free-text
      // submission path. Plumbing a real `library_album_id` for the Library
      // case is tracked separately (the catalog-search picker lives in the
      // Modern theme); the Classic port preserves prior behavior here.
      submissionData = {
        artist_name: artistName,
        album_title: releaseTitle,
        track_title: songTitle,
        request_flag: requestFlag,
        segue,
        record_label: labelName,
      };
    }

    try {
      await addToFlowsheet(submissionData).unwrap();
      resetTrackFields();
      setEntryType("track");
      dispatch(flowsheetSlice.actions.resetSearch());
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add entry:", error);
    }
  };

  const selectedBinReleases =
    rotationType !== "" ? releasesByBin[rotationType] : [];

  return (
    <form name="flowsheetEntry" method="POST" onSubmit={handleSubmit}>
      <fieldset disabled={!isLive} style={{ border: 0, margin: 0, padding: 0 }}>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <label className="label" htmlFor="addEntryType">Add a </label>
          <select
            id="addEntryType"
            name="addEntryType"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryType)}
            disabled={!isLive}
          >
            <option value="track">Track</option>
            <option value="talkset">Talkset</option>
            <option value="breakpoint">{nextStationHourLabel()} Breakpoint</option>
          </select>
          {entryType !== "track" && (
            <>
              {" "}
              <input
                type="submit"
                value="Add"
                disabled={!isLive || isLoading || !canSubmit}
              />
            </>
          )}
        </div>

        {entryType === "track" && (
          <>
            <div style={{ textAlign: "center", margin: "8px 0" }}>
              <label className="label" htmlFor="releaseType">From </label>
              <select
                id="releaseType"
                name="releaseType"
                value={releaseType}
                onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
                disabled={!isLive}
              >
                <option value="rotationRelease">Rotation</option>
                <option value="libraryRelease">WXYC Library</option>
                <option value="otherRelease">Other</option>
              </select>
            </div>

            {releaseType === "rotationRelease" && (
              <>
                <div style={{ textAlign: "center", marginBottom: "6px" }}>
                  <label className="label" htmlFor="rotationType">Bin </label>
                  <select
                    id="rotationType"
                    name="rotationType"
                    value={rotationType}
                    onChange={(e) => {
                      setRotationType(e.target.value as RotationType | "");
                      setSelectedRotationId(0);
                    }}
                    disabled={!isLive}
                  >
                    <option value=""></option>
                    <option value="heavy">Heavy</option>
                    <option value="medium">Medium</option>
                    <option value="light">Light</option>
                    <option value="singles">Singles</option>
                  </select>
                </div>
                {rotationType !== "" && (
                  <div
                    id="releaseDropdownTD"
                    style={{ textAlign: "center", marginBottom: "8px" }}
                  >
                    <select
                      name={`${rotationType}Release`}
                      value={selectedRotationId}
                      onChange={(e) =>
                        handleRotationSelect(parseInt(e.target.value))
                      }
                      disabled={!isLive}
                    >
                      <option value="0"></option>
                      {selectedBinReleases.map((release) => (
                        <option
                          key={release.rotation_id}
                          value={release.rotation_id}
                        >
                          {release.artist?.name ?? ""} - {release.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <table className="flowsheet-entry-form">
              <tbody>
                {releaseType !== "rotationRelease" && (
                  <tr id="artistTextboxRow">
                    <td>
                      <label htmlFor="artistName">Artist</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        autoCorrect="off"
                        id="artistName"
                        name="artistName"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        disabled={!isLive}
                      />
                    </td>
                  </tr>
                )}
                <tr id="songTextboxRow">
                  <td>
                    <label htmlFor="songTitle">Song</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      autoCorrect="off"
                      id="songTitle"
                      name="songTitle"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      disabled={!isLive}
                    />
                  </td>
                </tr>
                <tr id="regularReleaseRow">
                  <td>
                    <label htmlFor="releaseTitle">Release</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      autoCorrect="off"
                      id="releaseTitle"
                      name="releaseTitle"
                      value={releaseTitle}
                      onChange={(e) => setReleaseTitle(e.target.value)}
                      disabled={
                        !isLive ||
                        (releaseType === "rotationRelease" &&
                          selectedRotationId > 0)
                      }
                    />
                    <div className="optional-hint">optional</div>
                  </td>
                </tr>
                <tr id="labelRow">
                  <td>
                    <label htmlFor="labelName">Label</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      autoCorrect="off"
                      id="labelName"
                      name="labelName"
                      value={labelName}
                      onChange={(e) => setLabelName(e.target.value)}
                      disabled={!isLive}
                    />
                    <div className="optional-hint">optional</div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div id="requestSubmitRow" style={{ textAlign: "center", margin: "8px 0" }}>
              <div>
                <label>
                  <input
                    type="checkbox"
                    name="segueAnswer"
                    checked={segue}
                    onChange={(e) => setSegue(e.target.checked)}
                    disabled={!isLive}
                  />{" "}
                  Segue
                </label>
                &nbsp;&nbsp;
                <label>
                  <input
                    type="checkbox"
                    name="requestAnswer"
                    checked={requestFlag}
                    onChange={(e) => setRequestFlag(e.target.checked)}
                    disabled={!isLive}
                  />{" "}
                  Request
                </label>
              </div>
              <div style={{ marginTop: "6px" }}>
                <input
                  type="submit"
                  id="submitButton"
                  value="Add"
                  disabled={!isLive || isLoading || !canSubmit}
                />
              </div>
            </div>
          </>
        )}
      </fieldset>
    </form>
  );
}
