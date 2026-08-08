"use client";

import { useState } from "react";
import { PersonAdd } from "@mui/icons-material";
import { Button, Modal, ModalClose, ModalDialog, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import ArtistAddForm from "./ArtistAddForm";

/**
 * Reachability for the artist-add form: `POST /library/artists` is the only
 * way to file an artist, and a release cannot be added under an artist that
 * is not already catalogued in its genre — the add-release panel says so and
 * tells the MD to add the artist first. Without an entry point that sentence
 * names a step the product does not offer.
 *
 * The form is not remounted between openings, so a 409 the MD is working
 * through survives an accidental dismissal.
 */
export default function ArtistAddPanel() {
  const [open, setOpen] = useState(false);

  return (
    <RequireMD>
      <Button
        variant="outlined"
        startDecorator={<PersonAdd />}
        onClick={() => setOpen(true)}
      >
        Add Artist
      </Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog sx={{ maxWidth: 480, width: "100%" }}>
          <ModalClose />
          <Typography level="title-lg">Add Artist</Typography>
          <ArtistAddForm />
        </ModalDialog>
      </Modal>
    </RequireMD>
  );
}
