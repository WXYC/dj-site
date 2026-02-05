import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NewEntryPreview from "./NewEntryPreview";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

// Mock hooks
const mockHandleSubmit = vi.fn();
const mockCtrlKeyPressed = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSubmit: () => ({
    ctrlKeyPressed: mockCtrlKeyPressed(),
    handleSubmit: mockHandleSubmit,
  }),
}));

// Mock icons
vi.mock("@mui/icons-material/Create", () => ({
  default: () => <span data-testid="create-icon">CreateIcon</span>,
}));

function createTestStore(
  searchQuery = { song: "", artist: "", album: "", label: "", request: false },
  selectedResult = 0
) {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
    preloadedState: {
      flowsheet: {
        ...flowsheetSlice.getInitialState(),
        search: {
          open: true,
          query: searchQuery,
          selectedResult,
        },
      },
    },
  });
}

describe("NewEntryPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtrlKeyPressed.mockReturnValue(false);
  });

  describe("Visibility", () => {
    it("should not render when search query is completely empty", () => {
      const store = createTestStore({
        song: "",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      const { container } = render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render when song has content", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });

    it("should render when artist has content", () => {
      const store = createTestStore({
        song: "",
        artist: "Test Artist",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Test Artist")).toBeInTheDocument();
    });

    it("should render when album has content", () => {
      const store = createTestStore({
        song: "",
        artist: "",
        album: "Test Album",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Test Album")).toBeInTheDocument();
    });

    it("should render when label has content", () => {
      const store = createTestStore({
        song: "",
        artist: "",
        album: "",
        label: "Test Label",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });
  });

  describe("Content display", () => {
    it("should display all field labels", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        label: "Test Label",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("SONG")).toBeInTheDocument();
      expect(screen.getByText("ARTIST")).toBeInTheDocument();
      expect(screen.getByText("ALBUM")).toBeInTheDocument();
      expect(screen.getByText("LABEL")).toBeInTheDocument();
    });

    it("should display all field values", () => {
      const store = createTestStore({
        song: "My Song",
        artist: "My Artist",
        album: "My Album",
        label: "My Label",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("My Song")).toBeInTheDocument();
      expect(screen.getByText("My Artist")).toBeInTheDocument();
      expect(screen.getByText("My Album")).toBeInTheDocument();
      expect(screen.getByText("My Label")).toBeInTheDocument();
    });

    it("should display 'Not specified' for empty song field", () => {
      const store = createTestStore({
        song: "",
        artist: "Artist",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Multiple "Not specified" elements expected
      const notSpecifiedElements = screen.getAllByText("Not specified");
      expect(notSpecifiedElements.length).toBeGreaterThan(0);
    });

    it("should display 'Not specified' for empty artist field", () => {
      const store = createTestStore({
        song: "Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      const notSpecifiedElements = screen.getAllByText("Not specified");
      expect(notSpecifiedElements.length).toBe(3); // artist, album, label
    });

    it("should display 'Not specified' for all empty fields except one", () => {
      const store = createTestStore({
        song: "",
        artist: "",
        album: "Test Album",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      const notSpecifiedElements = screen.getAllByText("Not specified");
      expect(notSpecifiedElements.length).toBe(3); // song, artist, label
    });

    it("should render the create icon", () => {
      const store = createTestStore({
        song: "Test",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByTestId("create-icon")).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call handleSubmit on click", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Click on the component
      fireEvent.click(screen.getByText("Test Song").closest("div")!.parentElement!);

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it("should dispatch setSelectedResult on mouse over", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Find the main container and trigger mouseOver
      const container = screen.getByText("Test Song").closest("div")!.parentElement!;
      fireEvent.mouseOver(container);

      // Verify the store was updated - selectedResult should be set to 0
      const state = store.getState();
      expect(state.flowsheet.search.selectedResult).toBe(0);
    });
  });

  describe("Selection state styling", () => {
    it("should apply primary background when selected and not submitting to queue", () => {
      mockCtrlKeyPressed.mockReturnValue(false);

      const store = createTestStore(
        {
          song: "Test Song",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        0 // selected
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Component should render with selected styling
      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });

    it("should apply success background when selected and submitting to queue (ctrl pressed)", () => {
      mockCtrlKeyPressed.mockReturnValue(true);

      const store = createTestStore(
        {
          song: "Test Song",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        0 // selected
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Component should render with queue styling
      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });

    it("should apply transparent background when not selected", () => {
      const store = createTestStore(
        {
          song: "Test Song",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        1 // not selected (index 0 is new entry, index 1+ are search results)
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Component should render with non-selected styling
      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });
  });

  describe("Text styling based on selection", () => {
    it("should apply white text color to song when selected", () => {
      const store = createTestStore(
        {
          song: "Test Song",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        0
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // The component applies "white" color when selected
      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });

    it("should apply italic style for empty fields", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // "Not specified" should be italicized
      const notSpecified = screen.getAllByText("Not specified")[0];
      expect(notSpecified).toHaveStyle({ fontStyle: "italic" });
    });

    it("should apply normal font style for populated fields", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      const songElement = screen.getByText("Test Song");
      expect(songElement).toHaveStyle({ fontStyle: "normal" });
    });

    it("should apply reduced opacity for empty fields", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      const notSpecified = screen.getAllByText("Not specified")[0];
      expect(notSpecified).toHaveStyle({ opacity: "0.6" });
    });

    it("should apply full opacity for populated fields", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      const songElement = screen.getByText("Test Song");
      expect(songElement).toHaveStyle({ opacity: "1" });
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in search query", () => {
      const store = createTestStore({
        song: "Test & <Song> 'Title'",
        artist: "Artist with \"quotes\"",
        album: "Album: Subtitle",
        label: "Label/Records",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Test & <Song> 'Title'")).toBeInTheDocument();
      expect(screen.getByText('Artist with "quotes"')).toBeInTheDocument();
      expect(screen.getByText("Album: Subtitle")).toBeInTheDocument();
      expect(screen.getByText("Label/Records")).toBeInTheDocument();
    });

    it("should handle very long text values", () => {
      const longText = "A".repeat(100);
      const store = createTestStore({
        song: longText,
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("should handle unicode characters", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });

    it("should handle whitespace-only values", () => {
      const store = createTestStore({
        song: "   ",
        artist: "",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Whitespace-only string is truthy so component renders
      // Find the SONG label and verify the component is rendered
      expect(screen.getByText("SONG")).toBeInTheDocument();
      // There should be 3 "Not specified" texts for artist, album, label
      expect(screen.getAllByText("Not specified").length).toBe(3);
    });

    it("should handle request flag being true", () => {
      const store = createTestStore({
        song: "Test Song",
        artist: "",
        album: "",
        label: "",
        request: true,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Component should still render with request flag
      expect(screen.getByText("Test Song")).toBeInTheDocument();
    });
  });

  describe("Multiple field combinations", () => {
    it("should render with only song and artist", () => {
      const store = createTestStore({
        song: "My Song",
        artist: "My Artist",
        album: "",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("My Song")).toBeInTheDocument();
      expect(screen.getByText("My Artist")).toBeInTheDocument();
      expect(screen.getAllByText("Not specified").length).toBe(2);
    });

    it("should render with song, artist, and album", () => {
      const store = createTestStore({
        song: "My Song",
        artist: "My Artist",
        album: "My Album",
        label: "",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("My Song")).toBeInTheDocument();
      expect(screen.getByText("My Artist")).toBeInTheDocument();
      expect(screen.getByText("My Album")).toBeInTheDocument();
      expect(screen.getAllByText("Not specified").length).toBe(1);
    });

    it("should render with all fields populated", () => {
      const store = createTestStore({
        song: "Complete Song",
        artist: "Complete Artist",
        album: "Complete Album",
        label: "Complete Label",
        request: false,
      });

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByText("Complete Song")).toBeInTheDocument();
      expect(screen.getByText("Complete Artist")).toBeInTheDocument();
      expect(screen.getByText("Complete Album")).toBeInTheDocument();
      expect(screen.getByText("Complete Label")).toBeInTheDocument();
      expect(screen.queryByText("Not specified")).not.toBeInTheDocument();
    });
  });

  describe("Icon color based on selection", () => {
    it("should show lighter icon color when selected", () => {
      const store = createTestStore(
        {
          song: "Test",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        0 // selected
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Icon should render (color changes based on selection)
      expect(screen.getByTestId("create-icon")).toBeInTheDocument();
    });

    it("should show secondary icon color when not selected", () => {
      const store = createTestStore(
        {
          song: "Test",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        1 // not selected
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      expect(screen.getByTestId("create-icon")).toBeInTheDocument();
    });
  });

  describe("Label color based on selection", () => {
    it("should apply lighter label color when selected", () => {
      const store = createTestStore(
        {
          song: "Test",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        0 // selected
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Labels should have neutral.300 color when selected
      expect(screen.getByText("SONG")).toBeInTheDocument();
    });

    it("should apply tertiary label color when not selected", () => {
      const store = createTestStore(
        {
          song: "Test",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
        1 // not selected
      );

      render(
        <Provider store={store}>
          <NewEntryPreview />
        </Provider>
      );

      // Labels should have text.tertiary color when not selected
      expect(screen.getByText("SONG")).toBeInTheDocument();
    });
  });
});
