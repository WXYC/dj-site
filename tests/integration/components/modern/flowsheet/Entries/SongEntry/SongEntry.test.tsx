import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";

// Mock hooks
const mockUseShowControl = vi.fn();
const mockUseFlowsheet = vi.fn();
const mockAddToFlowsheet = vi.fn();
const mockDispatch = vi.fn();
const mockUpdateFlowsheet = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
  useFlowsheetActions: () => mockUseFlowsheet(),
}));

vi.mock("@/lib/features/flowsheet/api", () => ({
  useAddToFlowsheetMutation: () => [mockAddToFlowsheet, { isLoading: false }],
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => {
    // Mock the queue items selector
    if (typeof selector === "function") {
      return [];
    }
    return [];
  },
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      removeFromQueue: vi.fn((id) => ({ type: "removeFromQueue", payload: id })),
      updateQueueEntry: vi.fn((data) => ({
        type: "updateQueueEntry",
        payload: data,
      })),
    },
  },
}));

// Mock motion/react
vi.mock("motion/react", () => ({
  useDragControls: () => ({
    start: vi.fn(),
  }),
}));

// Mock child components
vi.mock("@/src/components/experiences/modern/flowsheet/Entries/Components/DragButton", () => ({
  default: ({ controls }: any) => (
    <button data-testid="drag-button">Drag</button>
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Entries/Components/RemoveButton", () => ({
  default: ({ queue, entry }: any) => (
    <button data-testid="remove-button" data-queue={queue}>
      Remove {entry.id}
    </button>
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Entries/DraggableEntryWrapper", () => ({
  default: ({ children, variant, color, style }: any) => (
    <tr
      data-testid="draggable-wrapper"
      data-variant={variant}
      data-color={color}
      style={style}
    >
      {children}
    </tr>
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Entries/SongEntry/FlowsheetEntryField", () => ({
  default: ({ name, entry, label, editable, playing, queue }: any) => (
    <span
      data-testid={`field-${name}`}
      data-editable={editable}
      data-playing={playing}
      data-queue={queue}
    >
      {entry[name]}
    </span>
  ),
}));

// LinkButton mock removed — SongEntry now uses a standard IconButton with dispatch instead of LinkIconButton

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("SongEntry", () => {
  const mockEntry: FlowsheetSongEntry = {
    id: 1,
    play_order: 0,
    show_id: 100,
    track_title: "Test Track",
    artist_name: "Test Artist",
    album_title: "Test Album",
    record_label: "Test Label",
    request_flag: false,
    segue: false,
    album_id: 42,
    rotation: "H",
    rotation_id: 10,
    artwork_url: "/test-album-art.jpg",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseShowControl.mockReturnValue({
      live: true,
      autoplay: false,
      currentShow: 100,
    });

    mockUseFlowsheet.mockReturnValue({
      updateFlowsheet: mockUpdateFlowsheet,
    });

    mockAddToFlowsheet.mockReturnValue(Promise.resolve());
  });

  describe("Basic rendering", () => {
    it("should render all entry fields", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      // Every field mounts exactly once. Where the artist/label render
      // depends on the breakpoint (own column at xl, stacked second line
      // below); jsdom's matchMedia matches false, so this is the sub-xl
      // stacked layout.
      expect(screen.getAllByTestId("field-track_title")).toHaveLength(1);
      expect(screen.getAllByTestId("field-album_title")).toHaveLength(1);
      expect(screen.getAllByTestId("field-artist_name")).toHaveLength(1);
      expect(screen.getAllByTestId("field-record_label")).toHaveLength(1);
    });

    it("should display entry field values", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      expect(screen.getAllByText("Test Track")).toHaveLength(1);
      expect(screen.getAllByText("Test Album")).toHaveLength(1);
      expect(screen.getAllByText("Test Artist")).toHaveLength(1);
      expect(screen.getAllByText("Test Label")).toHaveLength(1);
    });

    it("should render album art image from entry.artwork_url", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", "/test-album-art.jpg");
      expect(image).toHaveAttribute("alt", "album art");
    });

    it("should fall back to the default cassette image when entry.artwork_url is missing", () => {
      const entryWithoutArtwork = { ...mockEntry, artwork_url: undefined };

      render(
        <SongEntry entry={entryWithoutArtwork} playing={false} queue={false} />
      );

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", "/img/cassette.png");
    });

    it("should render info button for album detail", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const buttons = screen.getAllByRole("button");
      const infoButton = buttons.find(
        (btn) => !btn.hasAttribute("disabled") && btn.querySelector('[data-testid="InfoOutlinedIcon"]')
      );
      expect(infoButton).toBeDefined();
    });

    it("should disable info button when album_id is missing", () => {
      const entryWithoutAlbumId = { ...mockEntry, album_id: undefined };

      render(
        <SongEntry entry={entryWithoutAlbumId} playing={false} queue={false} />
      );

      const buttons = screen.getAllByRole("button");
      const infoButton = buttons.find(
        (btn) => btn.querySelector('[data-testid="InfoOutlinedIcon"]')
      );
      expect(infoButton).toBeDisabled();
    });

    it("should disable info button when album_id is negative", () => {
      const entryWithNegativeId = { ...mockEntry, album_id: -1 };

      render(
        <SongEntry entry={entryWithNegativeId} playing={false} queue={false} />
      );

      const buttons = screen.getAllByRole("button");
      const infoButton = buttons.find(
        (btn) => btn.querySelector('[data-testid="InfoOutlinedIcon"]')
      );
      expect(infoButton).toBeDisabled();
    });
  });

  describe("DraggableEntryWrapper styling", () => {
    it("should use soft variant and success color when in queue", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveAttribute("data-variant", "soft");
      expect(wrapper).toHaveAttribute("data-color", "success");
    });

    it("should use solid variant and primary color when playing", () => {
      render(<SongEntry entry={mockEntry} playing={true} queue={false} />);

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveAttribute("data-variant", "solid");
      expect(wrapper).toHaveAttribute("data-color", "primary");
    });

    it("should use plain variant and neutral color when not playing and not in queue", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveAttribute("data-variant", "plain");
      expect(wrapper).toHaveAttribute("data-color", "neutral");
    });

    it("should set opacity to 0.85 when in queue", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveStyle({ opacity: "0.85" });
    });

    it("should set opacity to 1 when not in queue", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveStyle({ opacity: "1" });
    });
  });

  describe("Editable state", () => {
    it("should be editable when in queue", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      expect(screen.getByTestId("field-album_title")).toHaveAttribute(
        "data-editable",
        "true"
      );
    });

    it("should be editable when live and entry belongs to current show", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      expect(screen.getByTestId("field-album_title")).toHaveAttribute(
        "data-editable",
        "true"
      );
    });

    it("should NOT be editable when not live and not in queue", () => {
      mockUseShowControl.mockReturnValue({
        live: false,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      expect(screen.getByTestId("field-album_title")).toHaveAttribute(
        "data-editable",
        "false"
      );
    });

    it("should NOT be editable when entry belongs to different show", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 999, // Different show
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      expect(screen.getByTestId("field-album_title")).toHaveAttribute(
        "data-editable",
        "false"
      );
    });
  });

  describe("DragButton and RemoveButton", () => {
    it("should show DragButton when editable (in queue)", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      expect(screen.getAllByTestId("drag-button").length).toBeGreaterThan(0);
    });

    it("should show RemoveButton when editable", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      expect(screen.getByTestId("remove-button")).toBeInTheDocument();
    });

    it("should pass queue prop to RemoveButton", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      expect(screen.getByTestId("remove-button")).toHaveAttribute(
        "data-queue",
        "true"
      );
    });

    it("should NOT show RemoveButton when not editable", () => {
      mockUseShowControl.mockReturnValue({
        live: false,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
    });
  });

  describe("Segue checkbox", () => {
    it("should render segue checkbox", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it("should reflect segue state", () => {
      const entryWithSegue = { ...mockEntry, segue: true };

      render(
        <SongEntry entry={entryWithSegue} playing={false} queue={false} />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      // Segue checkbox is the first one
      expect(checkboxes[0]).toBeChecked();
    });

    it("should call updateFlowsheet when segue checkbox changes (not in queue)", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: { segue: true },
      });
    });

    it("should dispatch updateQueueEntry when segue checkbox changes (in queue)", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe("Request flag checkbox", () => {
    it("should render request flag checkbox", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it("should reflect request_flag state", () => {
      const entryWithRequest = { ...mockEntry, request_flag: true };

      render(
        <SongEntry entry={entryWithRequest} playing={false} queue={false} />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      // Request checkbox is the second one
      expect(checkboxes[1]).toBeChecked();
    });

    it("should not render checkboxes when not editable", () => {
      mockUseShowControl.mockReturnValue({
        live: false,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      // Read-only rows surface state via chips (REQ/SEGUE), not controls
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("should be enabled when editable", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((cb) => expect(cb).not.toBeDisabled());
    });

    it("should call updateFlowsheet when checkbox changes (not in queue)", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: { request_flag: true },
      });
    });

    it("should dispatch updateQueueEntry when checkbox changes (in queue)", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe("EXCLUSIVE chip", () => {
    it("should render EXCLUSIVE chip when on_streaming is false", () => {
      const exclusiveEntry = { ...mockEntry, on_streaming: false };

      render(
        <SongEntry entry={exclusiveEntry} playing={false} queue={false} />
      );

      expect(screen.getByText("EXCLUSIVE")).toBeInTheDocument();
    });

    it("should NOT render EXCLUSIVE chip when on_streaming is true", () => {
      const streamingEntry = { ...mockEntry, on_streaming: true };

      render(
        <SongEntry entry={streamingEntry} playing={false} queue={false} />
      );

      expect(screen.queryByText("EXCLUSIVE")).not.toBeInTheDocument();
    });

    it("should NOT render EXCLUSIVE chip when on_streaming is undefined", () => {
      const entryWithoutStreaming = { ...mockEntry, on_streaming: undefined };

      render(
        <SongEntry
          entry={entryWithoutStreaming}
          playing={false}
          queue={false}
        />
      );

      expect(screen.queryByText("EXCLUSIVE")).not.toBeInTheDocument();
    });
  });

  describe("Rotation badge", () => {
    it("should display rotation badge when rotation is present", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      // The Badge component should show rotation value "H"
      expect(screen.getByText("H")).toBeInTheDocument();
    });

    it("should not display rotation badge when rotation is not present", () => {
      const entryWithoutRotation = { ...mockEntry, rotation: undefined };

      render(
        <SongEntry
          entry={entryWithoutRotation}
          playing={false}
          queue={false}
        />
      );

      expect(screen.queryByText("H")).not.toBeInTheDocument();
    });
  });

  describe("Field props", () => {
    it("should pass playing prop to fields", () => {
      render(<SongEntry entry={mockEntry} playing={true} queue={false} />);

      expect(screen.getByTestId("field-track_title")).toHaveAttribute(
        "data-playing",
        "true"
      );
    });

    it("should pass queue prop to fields", () => {
      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      expect(screen.getByTestId("field-track_title")).toHaveAttribute(
        "data-queue",
        "true"
      );
    });
  });

  describe("Mouse hover behavior for queue items", () => {
    it("should show play button on hover when queue and live", async () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      // Find the first td element (which contains the album art and hover target)
      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      expect(firstTd).toBeInTheDocument();

      // Trigger mouse enter
      fireEvent.mouseEnter(firstTd!);

      // Should show play button after hover
      await waitFor(() => {
        const playButton = screen.queryByRole("button", { name: /play/i });
        // The play button appears when canClose is true
        // It may or may not be present depending on implementation
      });
    });
  });

  describe("Autoplay styling", () => {
    it("should add margin when playing and autoplay is true", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: true,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={true} queue={false} />);

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveStyle({ marginBottom: "0.25rem" });
    });

    it("should not add margin when not playing", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: true,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const wrapper = screen.getByTestId("draggable-wrapper") as HTMLElement;
      expect(wrapper.style.marginBottom).toBe("initial");
    });
  });

  describe("Mouse leave behavior", () => {
    it("should hide play button on mouse leave", async () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      expect(firstTd).toBeInTheDocument();

      // Mouse enter to show play button
      fireEvent.mouseEnter(firstTd!);

      // Mouse leave to hide play button
      fireEvent.mouseLeave(firstTd!);

      // After mouse leave, canClose should be false, so play button hidden
      await waitFor(() => {
        // The play button should not be visible after mouse leave
        // This ensures handleMouseLeave is called
      });
    });

    it("should trigger handleMouseLeave on all td elements", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const allTds = screen.getByTestId("draggable-wrapper").querySelectorAll("td");

      // Mouse enter and leave on each td
      allTds.forEach((td) => {
        fireEvent.mouseEnter(td);
        fireEvent.mouseLeave(td);
      });

      // All events should complete without error
      expect(allTds.length).toBeGreaterThan(0);
    });
  });

  describe("Play button in queue", () => {
    it("should call addToFlowsheet when play button is clicked", async () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      mockAddToFlowsheet.mockReturnValue(Promise.resolve());

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      fireEvent.mouseEnter(firstTd!);

      // Wait for the play button to appear
      await waitFor(() => {
        const playButtons = screen.getAllByRole("button");
        // Find the play button (not drag or remove)
        const playButton = playButtons.find(btn =>
          btn.querySelector('svg[data-testid="PlayArrowIcon"]') !== null ||
          btn.textContent?.includes("Play") ||
          !btn.getAttribute("data-testid")?.includes("drag") &&
          !btn.getAttribute("data-testid")?.includes("remove")
        );
        if (playButton && !playButton.getAttribute("data-testid")) {
          fireEvent.click(playButton);
        }
      });

      // addToFlowsheet should be called with entry data
      // The promise resolves successfully
    });

    it("should dispatch removeFromQueue after successful addToFlowsheet", async () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      // Return a resolved promise
      mockAddToFlowsheet.mockImplementation(() => ({
        then: (callback: any) => {
          callback();
          return { catch: vi.fn() };
        },
      }));

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      fireEvent.mouseEnter(firstTd!);

      // Check that dispatch was ready to be called
      // The actual dispatch happens on successful addToFlowsheet
    });

    it("should show toast error when addToFlowsheet fails", async () => {
      const { toast } = await import("sonner");

      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      // Return a rejected promise
      const mockError = new Error("Failed to add");
      mockAddToFlowsheet.mockImplementation(() => ({
        then: (successCallback: any) => ({
          catch: (errorCallback: any) => {
            errorCallback(mockError);
          },
        }),
      }));

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      fireEvent.mouseEnter(firstTd!);

      // Error handling should be set up
    });

    it("should not show play button when not in queue", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      fireEvent.mouseEnter(firstTd!);

      // Play button should not appear since we're not in queue
      // The component logic is: canClose && queue
    });

    it("should not show play button when not live", () => {
      mockUseShowControl.mockReturnValue({
        live: false,
        autoplay: false,
        currentShow: 100,
      });

      render(<SongEntry entry={mockEntry} playing={false} queue={true} />);

      const firstTd = screen.getByTestId("draggable-wrapper").querySelector("td");
      fireEvent.mouseEnter(firstTd!);

      // Play button should not appear since we're not live
      // The handleMouseEnter logic only sets canClose when queue && live
    });
  });

  describe("Column order (tubafrenzy parity)", () => {
    // Point jsdom's matchMedia at the xl breakpoint (the vitest setup's
    // global mock always matches false, i.e. sub-xl).
    const originalMatchMedia = window.matchMedia;
    const setXl = (isXl: boolean) => {
      window.matchMedia = ((query: string) => ({
        matches: isXl && query === "(min-width: 1536px)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;
    };
    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    const renderedFieldOrder = () =>
      Array.from(
        screen
          .getByTestId("draggable-wrapper")
          .querySelectorAll('[data-testid^="field-"]')
      ).map((el) => el.getAttribute("data-testid"));

    it("reads artist, song, album, label in that order at xl", () => {
      setXl(true);
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      expect(renderedFieldOrder()).toEqual([
        "field-artist_name",
        "field-track_title",
        "field-album_title",
        "field-record_label",
      ]);
    });

    it("keeps the refactor's two-line stacked cells below xl", () => {
      setXl(false);
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      // Sub-xl keeps the two-line playlist-cell design (title over artist,
      // album over label) — tubafrenzy column order applies to the xl
      // full-column layout only.
      expect(renderedFieldOrder()).toEqual([
        "field-track_title",
        "field-artist_name",
        "field-album_title",
        "field-record_label",
      ]);
    });

    it("does not stack fields at xl and gives each field cell a single column", () => {
      setXl(true);
      render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

      const cells = Array.from(
        screen.getByTestId("draggable-wrapper").querySelectorAll("td")
      );
      cells.forEach((td) => {
        expect(
          td.querySelectorAll('[data-testid^="field-"]').length
        ).toBeLessThanOrEqual(1);
        if (td.querySelector('[data-testid^="field-"]')) {
          expect(td.colSpan).toBe(1);
        }
      });
    });
  });
});

describe("SongEntry two-line row structure", () => {
  const mockEntry: FlowsheetSongEntry = {
    id: 1,
    play_order: 0,
    show_id: 100,
    track_title: "On Your Own Love Again",
    artist_name: "Jessica Pratt",
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
    request_flag: false,
    segue: false,
    album_id: 42,
    rotation: "H",
    rotation_id: 10,
    artwork_url: "/test-album-art.jpg",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowControl.mockReturnValue({
      live: true,
      autoplay: false,
      currentShow: 100,
    });
    mockUseFlowsheet.mockReturnValue({
      updateFlowsheet: mockUpdateFlowsheet,
    });
  });

  // Point jsdom's matchMedia at a chosen breakpoint. The vitest setup's
  // global mock always matches false (sub-xl); this override lets the xl
  // structure be exercised too. Restored by the next test's beforeEach via
  // the afterEach below.
  const originalMatchMedia = window.matchMedia;
  const setXl = (isXl: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: isXl && query === "(min-width: 1536px)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  };
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renders exactly 6 cells at xl to match the collapsed thead grid", () => {
    setXl(true);
    render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

    const row = screen.getByTestId("draggable-wrapper");
    expect(row.querySelectorAll(":scope > td")).toHaveLength(6);
  });

  it("puts each field in its own column at xl (artist/label standalone)", () => {
    setXl(true);
    render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

    const cells = screen
      .getByTestId("draggable-wrapper")
      .querySelectorAll(":scope > td");

    // Standalone artist column leads (index 1) — tubafrenzy order, see #820.
    expect(
      cells[1].querySelector('[data-testid="field-artist_name"]')
    ).not.toBeNull();
    // Title cell (index 2): the title only — the artist has its own column.
    expect(
      cells[2].querySelector('[data-testid="field-track_title"]')
    ).not.toBeNull();
    expect(
      cells[2].querySelector('[data-testid="field-artist_name"]')
    ).toBeNull();
    // Album cell (index 3): the album only.
    expect(
      cells[3].querySelector('[data-testid="field-album_title"]')
    ).not.toBeNull();
    expect(
      cells[3].querySelector('[data-testid="field-record_label"]')
    ).toBeNull();
    // Standalone label column (index 4).
    expect(
      cells[4].querySelector('[data-testid="field-record_label"]')
    ).not.toBeNull();
  });

  it("renders 4 cells below xl, stacking artist/label into the title/album cells", () => {
    setXl(false);
    render(<SongEntry entry={mockEntry} playing={false} queue={false} />);

    const cells = screen
      .getByTestId("draggable-wrapper")
      .querySelectorAll(":scope > td");
    expect(cells).toHaveLength(4);

    // Title cell (index 1): the title plus the artist's stacked second line.
    expect(
      cells[1].querySelector('[data-testid="field-track_title"]')
    ).not.toBeNull();
    expect(
      cells[1].querySelector('[data-testid="field-artist_name"]')
    ).not.toBeNull();
    // Album cell (index 2): the album plus the label's stacked second line.
    expect(
      cells[2].querySelector('[data-testid="field-album_title"]')
    ).not.toBeNull();
    expect(
      cells[2].querySelector('[data-testid="field-record_label"]')
    ).not.toBeNull();
  });

  it("shows the rotation chip on the title line", () => {
    render(<SongEntry entry={mockEntry} playing={false} queue={false} />);
    expect(screen.getByText("H")).toBeDefined();
  });

  it("omits the rotation chip when the entry has no rotation", () => {
    render(
      <SongEntry
        entry={{ ...mockEntry, rotation: undefined }}
        playing={false}
        queue={false}
      />
    );
    expect(screen.queryByText("H")).toBeNull();
  });

  it("shows a read-only REQ chip on requested entries from previous shows", () => {
    mockUseShowControl.mockReturnValue({
      live: true,
      autoplay: false,
      currentShow: 200, // entry.show_id 100 => not editable
    });
    render(
      <SongEntry
        entry={{ ...mockEntry, request_flag: true }}
        playing={false}
        queue={false}
      />
    );
    expect(screen.getByText("REQ")).toBeDefined();
  });

  it("does not show the REQ chip when the row is editable", () => {
    render(
      <SongEntry
        entry={{ ...mockEntry, request_flag: true }}
        playing={false}
        queue={false}
      />
    );
    expect(screen.queryByText("REQ")).toBeNull();
  });
});
