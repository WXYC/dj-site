"use client";

import "@/src/styles/classic/wxyc.css";
import { describeSlot, specialtyCopy } from "@/lib/features/specialty/copy";
import { useSpecialtyQuestion } from "@/src/hooks/specialtyQuestionHooks";
import { useSpecialtyTagging } from "@/src/hooks/specialtyTaggingHooks";

/**
 * The classic form of the set-tagging question: a bold line and plain buttons,
 * no images. The slot only suggests; nothing is tagged until a DJ says yes.
 */
export default function SpecialtyQuestion() {
  const { showId, showName, newestEntryId, matches, decline } = useSpecialtyQuestion();
  const { confirmed, title, setTitle, refusal, isLoading, tag, finish } = useSpecialtyTagging(
    showId,
    newestEntryId
  );

  const refusalLine = refusal && (
    <div className="redlabel" role="alert">
      {refusal}
    </div>
  );

  if (confirmed) {
    return (
      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <b>{specialtyCopy.tagged(confirmed.name)}</b>
        <br />
        {!showName && (
          <label className="label">
            {specialtyCopy.titleLabel}:{" "}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={128}
            />
          </label>
        )}{" "}
        <input type="button" value={specialtyCopy.done} disabled={isLoading} onClick={finish} />
        {refusalLine}
      </div>
    );
  }

  if (showId === null || matches.length === 0) {
    return null;
  }

  const slot = describeSlot(matches[0].slot);
  const names = matches.map(({ program }) => program.name);
  return (
    <div style={{ textAlign: "center", margin: "8px 0" }}>
      <b>
        {matches.length === 1
          ? specialtyCopy.askOne(slot, names[0])
          : specialtyCopy.askShared(slot, names)}
      </b>
      <br />
      {matches.map(({ program }) => (
        <input
          key={program.id}
          type="button"
          value={specialtyCopy.yes(program.name)}
          disabled={isLoading}
          onClick={() => tag(program)}
        />
      ))}{" "}
      <input
        type="button"
        value={specialtyCopy.notThisTime}
        onClick={() => decline(showId)}
      />
      {refusalLine}
    </div>
  );
}
