import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BinMenu from "./BinMenu";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: vi.fn(() => ({
    live: false,
  })),
}));

vi.mock("@/src/hooks/applicationHooks", () => ({
  useShiftKey: vi.fn(() => false),
}));

// Mock child components
vi.mock("@/src/components/shared/General/LinkButton", () => ({
  MenuLinkItem: ({ children, href }: any) => (
    <div data-testid="menu-link" data-href={href}>
      {children}
    </div>
  ),
}));

vi.mock("./AddToQueueFromBin", () => ({
  default: ({ entry }: any) => <div data-testid="add-to-queue">{entry.title}</div>,
}));

vi.mock("./PlayFromBin", () => ({
  default: ({ entry }: any) => <div data-testid="play-from-bin">{entry.title}</div>,
}));

vi.mock("./DeleteFromBin", () => ({
  default: ({ album }: any) => <div data-testid="delete-from-bin">{album.title}</div>,
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  MoreVert: () => <span data-testid="more-vert-icon" />,
}));

vi.mock("@mui/icons-material/InfoOutlined", () => ({
  default: () => <span data-testid="info-icon" />,
}));

describe("BinMenu", () => {
  const mockEntry: AlbumEntry = {
    id: 1,
    title: "Test Album",
    entry: 5,
    format: "CD",
    artist: {
      id: 1,
      name: "Test Artist",
      lettercode: "AB",
      numbercode: 123,
      genre: "Rock",
    },
  } as AlbumEntry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render menu button with more icon", () => {
    render(<BinMenu entry={mockEntry} />);

    expect(screen.getByTestId("more-vert-icon")).toBeInTheDocument();
  });

  it("should render dropdown menu button", () => {
    render(<BinMenu entry={mockEntry} />);

    // The menu button should be in the document
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-haspopup", "menu");
  });

  it("should toggle menu expanded state when clicked", () => {
    render(<BinMenu entry={mockEntry} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
