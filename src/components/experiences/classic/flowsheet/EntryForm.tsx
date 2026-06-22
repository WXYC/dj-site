"use client";

import { FormEvent, useState, useEffect } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { sortRotationReleases } from "@/lib/features/rotation/sort";
import { Rotation } from "@/lib/features/rotation/types";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";

type EntryType = "track" | "talkset" | "breakpoint";
type ReleaseType = "rotationRelease" | "libraryRelease" | "otherRelease";
type RotationType = "heavy" | "medium" | "light" | "singles";

function formatBreakpointTime(): string {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm}`;
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
  const [releaseType, setReleaseType] = useState<ReleaseType>("rotationRelease");
  const [rotationType, setRotationType] = useState<RotationType | "">("");
  // Holds the picked release's `rotation_id` (rotation row PK), NOT its album
  // id. `release.id` can be a synthesized negative for library-unlinked
  // rotation rows (see `synthesizeAlbumId` in catalog/conversions.ts); keying
  // on `rotation_id` keeps the picker working regardless of library-link
  // state (dj-site#698). 0 means nothing selected.
  const [selectedRotationId, setSelectedRotationId] = useState<number>(0);
  const [artistName, setArtistName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [useArtistForComposer, setUseArtistForComposer] = useState(false);
  const [releaseTitle, setReleaseTitle] = useState("");
  const [labelName, setLabelName] = useState("");
  const [requestFlag, setRequestFlag] = useState(false);
  const [segue, setSegue] = useState(false);

  const { data: rotationData } = useGetRotationQuery();

  // Sorted A→Z by artist (ties broken by album title) so the native <select>
  // type-ahead lands the DJ in the right neighborhood. WXYC/dj-site#745.
  const heavyReleases = sortRotationReleases(
    rotationData?.filter((r) => r.rotation_bin === Rotation.H) || []
  );
  const mediumReleases = sortRotationReleases(
    rotationData?.filter((r) => r.rotation_bin === Rotation.M) || []
  );
  const lightReleases = sortRotationReleases(
    rotationData?.filter((r) => r.rotation_bin === Rotation.L) || []
  );
  const singlesReleases = sortRotationReleases(
    rotationData?.filter((r) => r.rotation_bin === Rotation.S) || []
  );

  useEffect(() => {
    if (useArtistForComposer) {
      setComposer(artistName);
    }
  }, [useArtistForComposer, artistName]);

  const handleRotationSelect = (type: RotationType, rotationId: number) => {
    setRotationType(type);
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
    setComposer("");
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
  const canSubmit =
    entryType === "track" ? canSubmitTrack : true;

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
        message: `${formatBreakpointTime()} Breakpoint`,
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

  return (
    <form name="flowsheetEntry" method="POST" onSubmit={handleSubmit}>
      <fieldset disabled={!isLive}>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <span className="label">Add a </span>
          <select
            name="addEntryType"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryType)}
            disabled={!isLive}
          >
            <option value="track">Track</option>
            <option value="talkset">Talkset</option>
            <option value="breakpoint">Breakpoint</option>
          </select>
          {entryType !== "track" && (
            <>
              &nbsp;
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
              <span className="label">From </span>
              <select
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
                  <span className="label">Bin </span>
                  <select
                    name="rotationType"
                    value={rotationType}
                    onChange={(e) => {
                      setRotationType(e.target.value as RotationType | "");
                      setSelectedRotationId(0);
                    }}
                    disabled={!isLive}
                  >
                    <option value="">-- choose bin --</option>
                    <option value="heavy">Heavy</option>
                    <option value="medium">Medium</option>
                    <option value="light">Light</option>
                    <option value="singles">Singles</option>
                  </select>
                </div>
                <div
                  id="releaseDropdownTD"
                  style={{ textAlign: "center", marginBottom: "8px" }}
                >
                  {rotationType === "heavy" && (
                    <select
                      name="heavyRelease"
                      value={selectedRotationId}
                      onChange={(e) =>
                        handleRotationSelect("heavy", parseInt(e.target.value))
                      }
                      disabled={!isLive}
                    >
                      <option value="0">
                        ---------------- Choose one of the releases in Heavy
                        Rotation ------------------
                      </option>
                      {heavyReleases.map((release) => (
                        <option
                          key={release.rotation_id}
                          value={release.rotation_id}
                        >
                          {release.artist?.name ?? ""} - {release.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {rotationType === "medium" && (
                    <select
                      name="mediumRelease"
                      value={selectedRotationId}
                      onChange={(e) =>
                        handleRotationSelect("medium", parseInt(e.target.value))
                      }
                      disabled={!isLive}
                    >
                      <option value="0">
                        ---------------- Choose one of the releases in Medium
                        Rotation -----------------
                      </option>
                      {mediumReleases.map((release) => (
                        <option
                          key={release.rotation_id}
                          value={release.rotation_id}
                        >
                          {release.artist?.name ?? ""} - {release.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {rotationType === "light" && (
                    <select
                      name="lightRelease"
                      value={selectedRotationId}
                      onChange={(e) =>
                        handleRotationSelect("light", parseInt(e.target.value))
                      }
                      disabled={!isLive}
                    >
                      <option value="0">
                        ---------------- Choose one of the releases in Light
                        Rotation ------------------
                      </option>
                      {lightReleases.map((release) => (
                        <option
                          key={release.rotation_id}
                          value={release.rotation_id}
                        >
                          {release.artist?.name ?? ""} - {release.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {rotationType === "singles" && (
                    <select
                      name="singlesRelease"
                      value={selectedRotationId}
                      onChange={(e) =>
                        handleRotationSelect(
                          "singles",
                          parseInt(e.target.value)
                        )
                      }
                      disabled={!isLive}
                    >
                      <option value="0">
                        ---------------- Choose one of the releases in Singles
                        Rotation ----------------
                      </option>
                      {singlesReleases.map((release) => (
                        <option
                          key={release.rotation_id}
                          value={release.rotation_id}
                        >
                          {release.artist?.name ?? ""} - {release.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </>
            )}

            <table cellPadding={2} align="center">
              <tbody>
                {releaseType !== "rotationRelease" && (
                  <tr id="artistTextboxRow">
                    <td className="redtitle" align="right">
                      ARTIST:
                    </td>
                    <td colSpan={3} className="redtitle" valign="top" align="left">
                      <input
                        type="text"
                        size={40}
                        name="artistName"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        disabled={!isLive}
                      />
                    </td>
                  </tr>
                )}
                <tr id="songTextboxRow">
                  <td className="redtitle" align="right">
                    SONG:
                  </td>
                  <td colSpan={3} className="redtitle" align="left" valign="top">
                    <input
                      type="text"
                      size={50}
                      name="songTitle"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      disabled={!isLive}
                    />
                  </td>
                </tr>
                {releaseType !== "rotationRelease" && (
                  <tr id="composerTextboxRow">
                    <td className="redtitle" align="right">
                      COMPOSER:
                    </td>
                    <td colSpan={2} className="redtitle" valign="top" align="left">
                      <input
                        type="text"
                        size={50}
                        name="bmiComposer"
                        value={composer}
                        onChange={(e) => setComposer(e.target.value)}
                        disabled={!isLive}
                      />
                      &nbsp;&nbsp;
                    </td>
                    <td className="label" valign="top">
                      <div id="autofillText" className="label">
                        Auto-fill 'COMPOSER' field with 'ARTIST' field?
                        <input
                          type="checkbox"
                          name="useArtistName"
                          checked={useArtistForComposer}
                          onChange={(e) => setUseArtistForComposer(e.target.checked)}
                          disabled={!isLive}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <table cellPadding={2} align="center">
              <tbody>
                <tr id="regularReleaseRow">
                  <td colSpan={4} className="label">
                    <div id="rotationDisclaimer2" style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "0.7em" }}>
                        'Release' and 'Label' are optional fields but listeners
                        may be interested in this information.
                      </span>
                    </div>
                    Release:&nbsp;
                    <input
                      type="text"
                      size={60}
                      name="releaseTitle"
                      value={releaseTitle}
                      onChange={(e) => setReleaseTitle(e.target.value)}
                      disabled={
                        !isLive ||
                        (releaseType === "rotationRelease" &&
                          selectedRotationId > 0)
                      }
                    />
                    &nbsp;&nbsp;&nbsp; Label:&nbsp;
                    <input
                      type="text"
                      size={25}
                      name="labelName"
                      value={labelName}
                      onChange={(e) => setLabelName(e.target.value)}
                      disabled={!isLive}
                    />
                    &nbsp;&nbsp;&nbsp;
                  </td>
                </tr>
                <tr id="requestSubmitRow">
                  <td colSpan={4} className="redlabel" style={{ textAlign: "center" }}>
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
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
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
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <input
                      type="submit"
                      id="submitButton"
                      value="Add"
                      disabled={!isLive || isLoading || !canSubmit}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </fieldset>
    </form>
  );
}
