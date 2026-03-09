"use client";

import { FormEvent, useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { convertQueryToSubmission } from "@/lib/features/flowsheet/conversions";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { Rotation } from "@/lib/features/rotation/types";
import { AlbumEntry } from "@/lib/features/catalog/types";

type ReleaseType = "rotationRelease" | "libraryRelease" | "otherRelease";
type RotationType = "heavy" | "medium" | "light" | "singles";

export default function EntryForm({
  onSuccess,
  isLive = true,
}: {
  onSuccess?: () => void;
  isLive?: boolean;
}) {
  const dispatch = useAppDispatch();
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const [addToFlowsheet, { isLoading }] = useAddToFlowsheetMutation();

  const [releaseType, setReleaseType] = useState<ReleaseType>("rotationRelease");
  const [rotationType, setRotationType] = useState<RotationType | "">("");
  const [selectedRotationId, setSelectedRotationId] = useState<number>(0);
  const [artistName, setArtistName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [useArtistForComposer, setUseArtistForComposer] = useState(false);
  const [releaseTitle, setReleaseTitle] = useState("");
  const [labelName, setLabelName] = useState("");
  const [requestAnswer, setRequestAnswer] = useState<"yes" | "no">("no");

  const { data: rotationData } = useGetRotationQuery();

  const heavyReleases = rotationData?.filter((r) => r.rotation_bin === Rotation.H) || [];
  const mediumReleases = rotationData?.filter((r) => r.rotation_bin === Rotation.M) || [];
  const lightReleases = rotationData?.filter((r) => r.rotation_bin === Rotation.L) || [];
  const singlesReleases = rotationData?.filter((r) => r.rotation_bin === Rotation.S) || [];

  useEffect(() => {
    if (useArtistForComposer) {
      setComposer(artistName);
    }
  }, [useArtistForComposer, artistName]);

  const handleRotationSelect = (type: RotationType, releaseId: number) => {
    setRotationType(type);
    setSelectedRotationId(releaseId);
    const release = rotationData?.find((r) => r.id === releaseId);
    if (release) {
      setArtistName(release.artist.name);
      setReleaseTitle(release.title);
      setLabelName(release.label);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let submissionData: any;

    if (releaseType === "rotationRelease" && selectedRotationId > 0) {
      const release = rotationData?.find((r) => r.id === selectedRotationId);
      if (!release) return;

      submissionData = {
        album_id: release.id,
        track_title: songTitle,
        rotation_id: release.rotation_id,
        request_flag: requestAnswer === "yes",
        record_label: labelName || release.label,
        play_freq: release.rotation_bin,
      };
    } else if (releaseType === "libraryRelease") {
      // For library releases, we'd need album_id from search
      // For now, treat as other release
      submissionData = {
        artist_name: artistName,
        album_title: releaseTitle,
        track_title: songTitle,
        request_flag: requestAnswer === "yes",
        record_label: labelName,
      };
    } else {
      submissionData = {
        artist_name: artistName,
        album_title: releaseTitle,
        track_title: songTitle,
        request_flag: requestAnswer === "yes",
        record_label: labelName,
      };
    }

    try {
      await addToFlowsheet(submissionData).unwrap();
      // Reset form
      setArtistName("");
      setSongTitle("");
      setComposer("");
      setReleaseTitle("");
      setLabelName("");
      setRequestAnswer("no");
      setSelectedRotationId(0);
      setRotationType("");
      dispatch(flowsheetSlice.actions.resetSearch());
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add entry:", error);
    }
  };

  return (
    <form name="flowsheetEntry" method="POST" onSubmit={handleSubmit}>
      <fieldset disabled={!isLive}>
        <table cellPadding={2} align="center">
          <tbody>
            <tr>
              <td colSpan={4} className="label" align="center">
                Add a track from:&nbsp;&nbsp;&nbsp;
                <input
                  type="radio"
                  name="releaseType"
                  value="rotationRelease"
                  checked={releaseType === "rotationRelease"}
                  onChange={() => setReleaseType("rotationRelease")}
                  disabled={!isLive}
                />
                &nbsp;Rotation&nbsp;
                <input
                  type="radio"
                  name="releaseType"
                  value="libraryRelease"
                  checked={releaseType === "libraryRelease"}
                  onChange={() => setReleaseType("libraryRelease")}
                  disabled={!isLive}
                />
                &nbsp;WXYC Library&nbsp;
                <input
                  type="radio"
                  name="releaseType"
                  value="otherRelease"
                  checked={releaseType === "otherRelease"}
                  onChange={() => setReleaseType("otherRelease")}
                  disabled={!isLive}
                />
                &nbsp;Other&nbsp;
              </td>
            </tr>
          </tbody>
        </table>

      {releaseType === "rotationRelease" && (
        <table cellPadding={5} align="center">
          <tbody>
            <tr>
              <td id="rotationSelectionTD" className="redlabel" style={{ fontWeight: "bold" }}>
              <input
                type="radio"
                name="rotationType"
                value="heavy"
                checked={rotationType === "heavy"}
                onChange={() => setRotationType("heavy")}
                disabled={!isLive}
              />
              H&nbsp;
              <input
                type="radio"
                name="rotationType"
                value="medium"
                checked={rotationType === "medium"}
                onChange={() => setRotationType("medium")}
                disabled={!isLive}
              />
              M&nbsp;
              <input
                type="radio"
                name="rotationType"
                value="light"
                checked={rotationType === "light"}
                onChange={() => setRotationType("light")}
                disabled={!isLive}
              />
              L&nbsp;
              <input
                type="radio"
                name="rotationType"
                value="singles"
                checked={rotationType === "singles"}
                onChange={() => setRotationType("singles")}
                disabled={!isLive}
              />
              S&nbsp;
            </td>
            <td id="releaseDropdownTD">
              <div id="rotationInstructionsLabel" className="label">
                (Choose 'H' for Heavy, 'M' for Medium, 'L' for Light, or 'S' for Singles)
              </div>
              {rotationType === "heavy" && (
                <select
                  name="heavyRelease"
                  onChange={(e) =>
                    handleRotationSelect("heavy", parseInt(e.target.value))
                  }
                  disabled={!isLive}
                >
                  <option value="0">
                    ---------------- Choose one of the releases in Heavy Rotation
                    ------------------
                  </option>
                  {heavyReleases.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.artist.name} - {release.title}
                    </option>
                  ))}
                </select>
              )}
              {rotationType === "medium" && (
                <select
                  name="mediumRelease"
                  onChange={(e) =>
                    handleRotationSelect("medium", parseInt(e.target.value))
                  }
                  disabled={!isLive}
                >
                  <option value="0">
                    ---------------- Choose one of the releases in Medium Rotation
                    -----------------
                  </option>
                  {mediumReleases.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.artist.name} - {release.title}
                    </option>
                  ))}
                </select>
              )}
              {rotationType === "light" && (
                <select
                  name="lightRelease"
                  onChange={(e) =>
                    handleRotationSelect("light", parseInt(e.target.value))
                  }
                  disabled={!isLive}
                >
                  <option value="0">
                    ---------------- Choose one of the releases in Light Rotation
                    ------------------
                  </option>
                  {lightReleases.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.artist.name} - {release.title}
                    </option>
                  ))}
                </select>
              )}
              {rotationType === "singles" && (
                <select
                  name="singlesRelease"
                  onChange={(e) =>
                    handleRotationSelect("singles", parseInt(e.target.value))
                  }
                  disabled={!isLive}
                >
                  <option value="0">
                    ---------------- Choose one of the releases in Singles Rotation
                    ----------------
                  </option>
                  {singlesReleases.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.artist.name} - {release.title}
                    </option>
                  ))}
                </select>
              )}
            </td>
          </tr>
          </tbody>
        </table>
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
                required
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
                  'Release' and 'Label' are optional fields but listeners may be
                  interested in this information.
                </span>
              </div>
              Release:&nbsp;
              <input
                type="text"
                size={60}
                name="releaseTitle"
                value={releaseTitle}
                onChange={(e) => setReleaseTitle(e.target.value)}
                disabled={!isLive || (releaseType === "rotationRelease" && selectedRotationId > 0)}
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
              Was this song a request?{" "}
              <input
                type="radio"
                name="requestAnswer"
                value="yes"
                checked={requestAnswer === "yes"}
                onChange={() => setRequestAnswer("yes")}
                disabled={!isLive}
              />
              Yes &nbsp;
              <input
                type="radio"
                name="requestAnswer"
                value="no"
                checked={requestAnswer === "no"}
                onChange={() => setRequestAnswer("no")}
                disabled={!isLive}
              />
              No &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <input
                type="submit"
                id="submitButton"
                value="  Add This Song To The Flowsheet  "
                disabled={!isLive || isLoading || !songTitle.trim()}
              />
            </td>
          </tr>
        </tbody>
      </table>
      </fieldset>
    </form>
  );
}
