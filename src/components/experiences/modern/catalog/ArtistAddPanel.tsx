"use client";

import { useState } from "react";
import { PersonAdd } from "@mui/icons-material";
import { Button, DialogTitle, Modal, ModalClose, ModalDialog } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import ArtistAddForm from "./ArtistAddForm";

/**
 * Reachability for the artist-add form: `POST /library/artists` is the only
 * way to file an artist, and a release cannot be added under an artist that
 * is not already catalogued in its genre — the add-release panel says so and
 * tells the MD to add the artist first. Without an entry point that sentence
 * names a step the product does not offer.
 *
 * Closing discards the form. `Modal` unmounts its children while shut, so the
 * fields and any standing code-taken conflict go with it, and a reopened panel
 * starts empty — the add-release panel guards its own dismissal against that,
 * this one does not yet.
 */
export default function ArtistAddPanel() {
  const [open, setOpen] = useState(false);

  return (
    <RequireMD>
      <Button
        variant="outlined"
        color="success"
        startDecorator={<PersonAdd />}
        onClick={() => setOpen(true)}
      >
        Add Artist
      </Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog sx={{ maxWidth: 480, width: "100%" }}>
          <ModalClose />
          <DialogTitle>Add Artist</DialogTitle>
          <ArtistAddForm />
        </ModalDialog>
      </Modal>
    </RequireMD>
  );
}
