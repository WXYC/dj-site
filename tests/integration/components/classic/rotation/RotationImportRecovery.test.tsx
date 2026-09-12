import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import {
  RotationImportCreatedNotLinked,
  RotationImportLinkConflict,
} from "@/src/components/experiences/classic/rotation/RotationImportRecovery";

const LIBRARY = `${TEST_BACKEND_URL}/library`;

const CREATED = {
  albumId: 8801,
  artistName: "Chuquimamani-Condori",
  albumTitle: "Edits",
  libraryCode: "Electronic CHU 12/4",
  artistId: 771,
};

const ROTATION_ROW = {
  id: 6002,
  album_id: null,
  rotation_bin: "L",
  add_date: "2026-01-10",
  kill_date: "2026-02-01",
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  format_id: 3,
  label_id: null,
};

const linkFailure = (status: number, message: string) => ({
  linkRotationError: { status, data: { message } } as never,
});

describe("classic RotationImportCreatedNotLinked — the post-create link failure", () => {
  it("names the release it created, its code, and warns against resubmitting the form", () => {
    renderWithProviders(
      <RotationImportCreatedNotLinked
        rotationId={6002}
        created={CREATED}
        linkError={linkFailure(503, "")}
        onLinked={vi.fn()}
        onAlreadyLinked={vi.fn()}
      />,
    );

    expect(screen.getByText("Edits")).toBeInTheDocument();
    expect(screen.getByText("Electronic CHU 12/4")).toBeInTheDocument();
    expect(screen.getByText(/do not submit the import form again/i)).toBeInTheDocument();
    expect(screen.getByText(/second library release/i)).toBeInTheDocument();
  });

  // Retrying the link is the only forward move: the release exists, so every
  // other affordance either duplicates it or abandons it half-filed.
  it("offers linking again and nothing else", () => {
    renderWithProviders(
      <RotationImportCreatedNotLinked
        rotationId={6002}
        created={CREATED}
        linkError={linkFailure(503, "")}
        onLinked={vi.fn()}
        onAlreadyLinked={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Link the rotation release" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("reports the failure it was handed without claiming an outcome it cannot know", () => {
    renderWithProviders(
      <RotationImportCreatedNotLinked
        rotationId={6002}
        created={CREATED}
        linkError={linkFailure(503, "")}
        onLinked={vi.fn()}
        onAlreadyLinked={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/may or may not have been linked/i);
  });

  it("links the rotation row and hands the linked row back on a successful retry", async () => {
    let body: unknown;
    server.use(
      http.patch(`${LIBRARY}/rotation/:rotationId/link`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ROTATION_ROW, album_id: 8801 });
      }),
    );
    const onLinked = vi.fn();

    const { user } = renderWithProviders(
      <RotationImportCreatedNotLinked
        rotationId={6002}
        created={CREATED}
        linkError={linkFailure(503, "")}
        onLinked={onLinked}
        onAlreadyLinked={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Link the rotation release" }));

    await waitFor(() => expect(onLinked).toHaveBeenCalled());
    expect(body).toEqual({ album_id: 8801 });
  });

  // A retry that comes back already-linked means something else linked the
  // row, and the remedy is the other screen -- there is now a duplicate
  // release to deal with, which retrying can never resolve.
  it("hands off to the conflict screen when the retry comes back already linked", async () => {
    server.use(
      http.patch(`${LIBRARY}/rotation/:rotationId/link`, () =>
        HttpResponse.json(
          { message: "Rotation entry is already linked to a library release" },
          { status: 409 },
        ),
      ),
    );
    const onAlreadyLinked = vi.fn();

    const { user } = renderWithProviders(
      <RotationImportCreatedNotLinked
        rotationId={6002}
        created={CREATED}
        linkError={linkFailure(503, "")}
        onLinked={vi.fn()}
        onAlreadyLinked={onAlreadyLinked}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Link the rotation release" }));

    await waitFor(() => expect(onAlreadyLinked).toHaveBeenCalled());
  });

  it("keeps the retry available and states the new reason when the retry fails again", async () => {
    server.use(
      http.patch(`${LIBRARY}/rotation/:rotationId/link`, () =>
        HttpResponse.json({ message: "Rotation entry not found" }, { status: 404 }),
      ),
    );

    const { user } = renderWithProviders(
      <RotationImportCreatedNotLinked
        rotationId={6002}
        created={CREATED}
        linkError={linkFailure(503, "")}
        onLinked={vi.fn()}
        onAlreadyLinked={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Link the rotation release" }));

    expect(await screen.findByText(/no longer in the queue/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link the rotation release" })).toBeEnabled();
  });
});

describe("classic RotationImportLinkConflict — the already-linked backstop", () => {
  beforeEach(() => {
    server.use(
      http.get(`${LIBRARY}/rotation/:id`, () => HttpResponse.json({ ...ROTATION_ROW, album_id: 42 })),
      http.get(`${LIBRARY}/info`, () =>
        HttpResponse.json({
          id: 42,
          album_title: "Edits",
          artist_name: "Chuquimamani-Condori",
          genre_name: "Electronic",
          genre_id: 5,
          code_letters: "CHU",
          code_artist_number: 12,
          code_number: 2,
          format_name: "CD",
          label: "self-released",
          add_date: "2026-02-02",
        }),
      ),
    );
  });

  it("puts the release already linked beside the one this import created", async () => {
    renderWithProviders(
      <RotationImportLinkConflict rotationId={6002} created={CREATED} onDeleted={vi.fn()} />,
    );

    const comparison = await screen.findByRole("table", { name: /already linked/i });

    const alreadyLinked = (await within(comparison).findByText("Electronic CHU 12/2")).closest(
      "tr",
    ) as HTMLElement;
    expect(within(alreadyLinked).getByRole("rowheader")).toHaveTextContent("Already linked:");
    expect(within(alreadyLinked).getByText("Chuquimamani-Condori — Edits")).toBeInTheDocument();

    const createdHere = within(comparison).getByText("Electronic CHU 12/4").closest("tr") as HTMLElement;
    expect(within(createdHere).getByRole("rowheader")).toHaveTextContent("Created by this import:");
  });

  it("offers deleting the release this import created, and says which one that is", async () => {
    let deletedId: string | undefined;
    server.use(
      http.delete(`${LIBRARY}/:id`, ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();

    const { user } = renderWithProviders(
      <RotationImportLinkConflict rotationId={6002} created={CREATED} onDeleted={onDeleted} />,
    );
    await user.click(
      await screen.findByRole("button", { name: "Delete the release this import created" }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deletedId).toBe("8801");
  });

  // A release carrying flowsheet plays cannot be deleted, and the librarian
  // needs the server's own sentence rather than a retry that cannot succeed.
  it("states the server's refusal and withdraws the delete when it is refused on the merits", async () => {
    server.use(
      http.delete(`${LIBRARY}/:id`, () =>
        HttpResponse.json(
          { reason: "flowsheet_references", message: "Cannot delete: 3 flowsheet plays reference this release." },
          { status: 409 },
        ),
      ),
    );

    const { user } = renderWithProviders(
      <RotationImportLinkConflict rotationId={6002} created={CREATED} onDeleted={vi.fn()} />,
    );
    await user.click(
      await screen.findByRole("button", { name: "Delete the release this import created" }),
    );

    expect(
      await screen.findByText("Cannot delete: 3 flowsheet plays reference this release."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete the release this import created" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the delete available on a lock stand-down, which says nothing about deletability", async () => {
    server.use(
      http.delete(`${LIBRARY}/:id`, () =>
        HttpResponse.json({ reason: "lock_unavailable", message: "" }, { status: 503 }),
      ),
    );

    const { user } = renderWithProviders(
      <RotationImportLinkConflict rotationId={6002} created={CREATED} onDeleted={vi.fn()} />,
    );
    await user.click(
      await screen.findByRole("button", { name: "Delete the release this import created" }),
    );

    expect(await screen.findByText(/being written to right now/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete the release this import created" }),
    ).toBeEnabled();
  });
});
