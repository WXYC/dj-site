import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import { Rotation } from "@/lib/features/rotation/types";
import ResultRow, { type PreviousSetsResult } from "../ResultRow";

const baseResult: PreviousSetsResult = {
  id: 1,
  play_date: "2024-06-15T14:30:00.000Z",
  artist_name: "Juana Molina",
  track_title: "la paradoja",
  album_title: "DOGA",
  record_label: "Sonamos",
  dj_name: "Test DJ",
  show_id: 100,
};

function renderRow(props: {
  result?: Partial<PreviousSetsResult>;
  nextIsSong?: boolean;
}) {
  const result = { ...baseResult, ...props.result };
  return renderWithProviders(
    <table>
      <tbody>
        <ResultRow result={result} nextIsSong={props.nextIsSong ?? false} />
      </tbody>
    </table>
  );
}

describe("Classic Previous Sets ResultRow", () => {
  it("renders the 4 data columns + leftmost indicator cell", () => {
    const { container } = renderRow({});
    const tds = container.querySelectorAll("tr > td");
    expect(tds.length).toBe(5);
    expect(tds[1].textContent).toBe("Juana Molina");
    expect(tds[2].textContent).toBe("la paradoja");
    expect(tds[3].textContent).toBe("DOGA");
    expect(tds[4].textContent).toBe("Sonamos");
  });

  it("renders no capsules when no flags are set", () => {
    const { container } = renderRow({});
    expect(container.querySelector(".classic-capsule")).toBeNull();
  });

  it("renders a REQUEST capsule when request_flag=true", () => {
    renderRow({ result: { request_flag: true } });
    expect(screen.getByText("REQUEST")).toBeDefined();
  });

  it.each([
    [Rotation.H, "ROTATION H"],
    [Rotation.M, "ROTATION M"],
    [Rotation.L, "ROTATION L"],
    [Rotation.S, "ROTATION S"],
  ])("renders %s rotation as %s", (rotation, label) => {
    renderRow({ result: { rotation } });
    expect(screen.getByText(label)).toBeDefined();
  });

  it("renders EXCLUSIVE when on_streaming=false", () => {
    renderRow({ result: { on_streaming: false } });
    expect(screen.getByText("EXCLUSIVE")).toBeDefined();
  });

  it("does NOT render EXCLUSIVE when on_streaming=true", () => {
    renderRow({ result: { on_streaming: true } });
    expect(screen.queryByText("EXCLUSIVE")).toBeNull();
  });

  it("renders all three capsules in priority order (REQUEST → ROTATION → EXCLUSIVE)", () => {
    const { container } = renderRow({
      result: { request_flag: true, rotation: Rotation.H, on_streaming: false },
    });
    const capsules = container.querySelectorAll(".classic-capsule");
    expect(capsules.length).toBe(3);
    expect(capsules[0].textContent).toBe("REQUEST");
    expect(capsules[1].textContent).toBe("ROTATION H");
    expect(capsules[2].textContent).toBe("EXCLUSIVE");
  });

  it("renders the segue indicator when segue=true and the next row is a song", () => {
    const { container } = renderRow({
      result: { segue: true },
      nextIsSong: true,
    });
    const row = container.querySelector("tr.classic-segue");
    expect(row).not.toBeNull();
    expect(row!.getAttribute("data-segue")).toBe("true");
  });

  it("does NOT render the segue indicator when the next row is not a song", () => {
    const { container } = renderRow({
      result: { segue: true },
      nextIsSong: false,
    });
    expect(container.querySelector("tr.classic-segue")).toBeNull();
  });

  it("does NOT render the segue indicator when segue is undefined", () => {
    const { container } = renderRow({
      result: { segue: undefined },
      nextIsSong: true,
    });
    expect(container.querySelector("tr.classic-segue")).toBeNull();
  });
});
