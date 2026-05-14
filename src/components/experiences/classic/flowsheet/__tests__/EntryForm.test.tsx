import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import {
  createTestArtist,
  createTestRotationAlbum,
} from "@/lib/test-utils/fixtures";
import { Rotation } from "@/lib/features/rotation/types";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import EntryForm from "../EntryForm";

// The form calls useAddToFlowsheetMutation() directly; mock that hook so we can
// assert what payload the form would submit, without standing up a real server.
const addToFlowsheetMock = vi.fn();
vi.mock("@/lib/features/flowsheet/api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/features/flowsheet/api")
  >();
  return {
    ...actual,
    useAddToFlowsheetMutation: () => [
      addToFlowsheetMock,
      { isLoading: false },
    ],
  };
});

// Rotation data is fixture-controlled per test. Default is empty; tests that
// exercise the rotation-release submission branch set `rotationDataMock` to a
// list before rendering the form.
let rotationDataMock: ReturnType<typeof createTestRotationAlbum>[] = [];
vi.mock("@/lib/features/rotation/api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/features/rotation/api")
  >();
  return {
    ...actual,
    useGetRotationQuery: () => ({ data: rotationDataMock }),
  };
});

beforeEach(() => {
  addToFlowsheetMock.mockReset();
  // Default: addToFlowsheet returns a mock RTK Query result with .unwrap()
  // that resolves so the form's reset path doesn't throw.
  addToFlowsheetMock.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  rotationDataMock = [];
});

/**
 * The Classic form is a port of the tubafrenzy JSP layout: every form control
 * has a `name=` but several inputs sit next to plain-text labels in adjacent
 * `<td>` cells rather than associated `<label htmlFor>` elements, so RTL's
 * accessible-name lookups (`getByRole("textbox", { name })`) cannot find them.
 * We use the named-control helper below for those inputs.
 */
function getNamedInput(name: string): HTMLInputElement {
  const el = document.querySelector(
    `input[name="${name}"]`
  ) as HTMLInputElement | null;
  if (!el) throw new Error(`Input name="${name}" not found`);
  return el;
}

function getNamedSelect(name: string): HTMLSelectElement {
  const el = document.querySelector(
    `select[name="${name}"]`
  ) as HTMLSelectElement | null;
  if (!el) throw new Error(`Select name="${name}" not found`);
  return el;
}

describe("Classic EntryForm — Add a dropdown", () => {
  it("renders an 'Add a' select with Track / Talkset / Breakpoint options", () => {
    renderWithProviders(<EntryForm />);
    const select = getNamedSelect("addEntryType");
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["track", "talkset", "breakpoint"]);
    expect(select.value).toBe("track");
  });

  it("hides the track-entry UI when Add a = Talkset", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "talkset");
    // The track-entry UI is identified by the From dropdown.
    expect(document.querySelector('select[name="releaseType"]')).toBeNull();
  });

  it("hides the track-entry UI when Add a = Breakpoint", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "breakpoint");
    expect(document.querySelector('select[name="releaseType"]')).toBeNull();
  });

  it("submits a talkset payload immediately when Add a = Talkset + Add clicked", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "talkset");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.entry_type).toBe(FlowsheetEntryType.talkset);
    expect(payload.message).toBe("Talkset");
  });

  it("submits a breakpoint payload immediately when Add a = Breakpoint + Add clicked", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "breakpoint");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.entry_type).toBe(FlowsheetEntryType.breakpoint);
    expect(typeof payload.message).toBe("string");
    expect(payload.message.toLowerCase()).toContain("breakpoint");
  });
});

describe("Classic EntryForm — From dropdown", () => {
  it("renders a 'From' select with Rotation / Library / Other when Add a = Track", () => {
    renderWithProviders(<EntryForm />);
    const select = getNamedSelect("releaseType");
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual([
      "rotationRelease",
      "libraryRelease",
      "otherRelease",
    ]);
  });

  it("shows the Bin dropdown when From = Rotation", () => {
    renderWithProviders(<EntryForm />);
    // Default is rotationRelease, so Bin should be visible immediately.
    const bin = document.querySelector('select[name="rotationType"]');
    expect(bin).not.toBeNull();
  });

  it("hides the Bin dropdown when From = Library", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "libraryRelease");
    expect(document.querySelector('select[name="rotationType"]')).toBeNull();
  });

  it("hides the Bin dropdown when From = Other", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    expect(document.querySelector('select[name="rotationType"]')).toBeNull();
  });

  it("shows the Artist textbox when From = Library or Other", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "libraryRelease");
    expect(document.querySelector('input[name="artistName"]')).not.toBeNull();
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    expect(document.querySelector('input[name="artistName"]')).not.toBeNull();
  });
});

describe("Classic EntryForm — Request checkbox (not radios)", () => {
  it("renders Request as a single checkbox, not a yes/no radio pair", () => {
    renderWithProviders(<EntryForm />);
    const requestCheckbox = screen.getByRole("checkbox", {
      name: /^request$/i,
    }) as HTMLInputElement;
    expect(requestCheckbox.type).toBe("checkbox");
    expect(requestCheckbox.checked).toBe(false);
    // No leftover request-answer radios.
    expect(
      document.querySelector('input[type="radio"][name="requestAnswer"]')
    ).toBeNull();
  });

  it("submits request_flag=true when the Request checkbox is checked", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    await user.type(getNamedInput("artistName"), "Juana Molina");
    await user.type(getNamedInput("songTitle"), "la paradoja");
    await user.click(screen.getByRole("checkbox", { name: /^request$/i }));
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    expect(addToFlowsheetMock.mock.calls[0][0].request_flag).toBe(true);
  });
});

describe("Classic EntryForm — Segue checkbox", () => {
  it("renders a Segue checkbox, unchecked by default", () => {
    renderWithProviders(<EntryForm />);
    const segueCheckbox = screen.getByRole("checkbox", {
      name: /segue/i,
    }) as HTMLInputElement;
    expect(segueCheckbox.checked).toBe(false);
  });

  it("submits segue=true when the Segue checkbox is checked", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    await user.type(getNamedInput("artistName"), "Jessica Pratt");
    await user.type(getNamedInput("songTitle"), "Back, Baby");
    await user.click(screen.getByRole("checkbox", { name: /segue/i }));
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    expect(addToFlowsheetMock.mock.calls[0][0].segue).toBe(true);
  });
});

describe("Classic EntryForm — Submit disabled until track chosen", () => {
  it("disables Submit when From = Library and the song title is empty", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "libraryRelease");
    const submit = screen.getByRole("button", {
      name: /^add$/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("disables Submit when From = Other and the song title is empty", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    const submit = screen.getByRole("button", {
      name: /^add$/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("enables Submit once Artist + Song are filled in (From = Other)", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    await user.type(getNamedInput("artistName"), "Chuquimamani-Condori");
    await user.type(getNamedInput("songTitle"), "Call Your Name");
    const submit = screen.getByRole("button", {
      name: /^add$/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it("enables Submit immediately when Add a = Talkset (no track required)", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "talkset");
    const submit = screen.getByRole("button", {
      name: /^add$/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it("enables Submit immediately when Add a = Breakpoint (no track required)", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "breakpoint");
    const submit = screen.getByRole("button", {
      name: /^add$/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });
});

describe("Classic EntryForm — Bin dropdown (replaces H/M/L/S radios)", () => {
  it("renders Bin as a select with Heavy/Medium/Light/Singles + empty placeholder", () => {
    renderWithProviders(<EntryForm />);
    const bin = getNamedSelect("rotationType");
    const optionValues = Array.from(bin.options).map((o) => o.value);
    expect(optionValues).toEqual(["", "heavy", "medium", "light", "singles"]);
    expect(bin.value).toBe("");
    // No leftover rotationType radios.
    expect(
      document.querySelector('input[type="radio"][name="rotationType"]')
    ).toBeNull();
  });

  it("labels the empty Bin placeholder so screen readers can announce it", () => {
    renderWithProviders(<EntryForm />);
    const bin = getNamedSelect("rotationType");
    const placeholder = bin.options[0];
    expect(placeholder.value).toBe("");
    // Visible text on the placeholder option — not zero-width — so VO/JAWS
    // can announce something meaningful for the unselected state.
    expect(placeholder.textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe("Classic EntryForm — Rotation submission payload", () => {
  it("submits a rotation entry with album_id, rotation_id, and rotation_bin", async () => {
    rotationDataMock = [
      createTestRotationAlbum(Rotation.H, {
        id: 5101,
        rotation_id: 5102,
        title: "Aluminum Tunes",
        label: "Duophonic",
        artist: createTestArtist({
          name: "Stereolab",
          lettercode: "RO",
          numbercode: 87,
        }),
      }),
    ];
    const { user } = renderWithProviders(<EntryForm />);
    // Default state is Track + Rotation. Pick Heavy, then the release.
    await user.selectOptions(getNamedSelect("rotationType"), "heavy");
    await user.selectOptions(getNamedSelect("heavyRelease"), "5101");
    await user.type(getNamedInput("songTitle"), "Tone Burst");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.album_id).toBe(5101);
    expect(payload.rotation_id).toBe(5102);
    expect(payload.rotation_bin).toBe(Rotation.H);
    expect(payload.track_title).toBe("Tone Burst");
    expect(payload.record_label).toBe("Duophonic");
    // Pin the absence of the legacy field name so a future rename doesn't
    // silently regress to `play_freq`.
    expect("play_freq" in payload).toBe(false);
  });
});

describe("Classic EntryForm — Breakpoint message format", () => {
  it("formats the breakpoint message as 'H:MM AM/PM Breakpoint'", async () => {
    // mockCurrentTime() can't be used here because it installs fake timers,
    // which hangs userEvent's internal setTimeout-based delays. Instead we
    // pin only the *shape* of the message — that catches regressions to a
    // 24-hour clock, missing AM/PM, dropped minutes, or wrong word.
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "breakpoint");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const message: string = addToFlowsheetMock.mock.calls[0][0].message;
    expect(message).toMatch(/^\d{1,2}:\d{2} (AM|PM) Breakpoint$/);
  });
});

describe("Classic EntryForm — post-submit reset behavior", () => {
  it("resets Add a back to Track after submitting a Talkset", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("addEntryType"), "talkset");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    expect(getNamedSelect("addEntryType").value).toBe("track");
  });
});

describe("Classic EntryForm — Enter-key submission guard", () => {
  it("does NOT submit when pressing Enter in the song field with no artist", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    const songInput = getNamedInput("songTitle");
    await user.type(songInput, "untitled{Enter}");
    // Brief settle so any errant submit could complete.
    await new Promise((r) => setTimeout(r, 10));
    expect(addToFlowsheetMock).not.toHaveBeenCalled();
  });

  it("DOES submit when pressing Enter in the song field after Artist+Song are filled", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    await user.selectOptions(getNamedSelect("releaseType"), "otherRelease");
    await user.type(getNamedInput("artistName"), "Cat Power");
    await user.type(getNamedInput("songTitle"), "Cross Bones Style{Enter}");

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    expect(addToFlowsheetMock.mock.calls[0][0].track_title).toBe(
      "Cross Bones Style"
    );
    expect(addToFlowsheetMock.mock.calls[0][0].artist_name).toBe("Cat Power");
  });
});
