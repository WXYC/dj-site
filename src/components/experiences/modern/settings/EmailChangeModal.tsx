"use client";

import { authClient } from "@/lib/features/authentication/client";
import { isValidEmail } from "@wxyc/shared/validation";
import { Email, Key } from "@mui/icons-material";
import {
  Button,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Stack,
  Typography,
} from "@mui/joy";
import { useState } from "react";
import { toast } from "sonner";

type EmailChangeModalProps = {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
};

type ModalState = "form" | "success";

export default function EmailChangeModal({
  open,
  onClose,
  currentEmail,
}: EmailChangeModalProps) {
  const [state, setState] = useState<ModalState>("form");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    // Reset state when closing
    setState("form");
    setNewEmail("");
    setPassword("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!newEmail || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (newEmail === currentEmail) {
      setError("New email must be different from your current email");
      return;
    }

    // Email format validation using shared validator
    if (!isValidEmail(newEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      // First verify the password by attempting to get session
      // Better Auth's changeEmail requires the user to be authenticated
      // and we verify the password to prevent unauthorized changes
      const verifyResult = await authClient.signIn.username({
        username: currentEmail, // Use email as identifier for verification
        password,
      });

      // Check if there's a structured error response (Better Auth returns error object)
      if (verifyResult && typeof verifyResult === 'object' && 'error' in verifyResult && verifyResult.error) {
        const errorObj = verifyResult.error as { message?: string };
        throw new Error(errorObj.message || "Invalid password");
      }

      // Build callback URL for verification redirect
      const callbackURL =
        typeof window !== "undefined"
          ? `${window.location.origin}/dashboard/settings`
          : undefined;

      // Call Better Auth changeEmail API
      const result = await authClient.changeEmail({
        newEmail,
        callbackURL,
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to initiate email change");
      }

      // Success - show verification message
      setState("success");
      toast.success("Verification email sent!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to change email";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        variant="outlined"
        sx={{
          maxWidth: 400,
          borderRadius: "md",
        }}
      >
        <ModalClose />
        {state === "form" ? (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" gap={1}>
                <Email />
                Change Email Address
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Typography level="body-sm" sx={{ mb: 2 }}>
                We'll send a verification link to your new email address. Your
                email won't change until you click that link.
              </Typography>
              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <FormControl>
                    <FormLabel>Current Email</FormLabel>
                    <Input value={currentEmail} disabled endDecorator={<Email />} />
                  </FormControl>

                  <FormControl error={!!error && error.includes("email")}>
                    <FormLabel>New Email</FormLabel>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter your new email"
                      endDecorator={<Email />}
                      disabled={isLoading}
                    />
                  </FormControl>

                  <FormControl error={!!error && error.includes("password")}>
                    <FormLabel>Current Password</FormLabel>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Confirm your password"
                      endDecorator={<Key />}
                      disabled={isLoading}
                    />
                    <FormHelperText>
                      Enter your password to confirm this change
                    </FormHelperText>
                  </FormControl>

                  {error && (
                    <Typography level="body-sm" color="danger">
                      {error}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="plain"
                      color="neutral"
                      onClick={handleClose}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="solid"
                      color="primary"
                      loading={isLoading}
                    >
                      Send Verification Email
                    </Button>
                  </Stack>
                </Stack>
              </form>
            </DialogContent>
          </>
        ) : (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" gap={1}>
                <Email color="success" />
                Check Your Inbox
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Typography level="body-md">
                  We've sent a verification email to:
                </Typography>
                <Typography level="title-md" sx={{ fontWeight: "bold" }}>
                  {newEmail}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Click the link in the email to confirm your new address. Your
                  email will remain as <strong>{currentEmail}</strong> until you
                  verify the new one.
                </Typography>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleClose}
                  sx={{ mt: 1 }}
                >
                  Done
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </ModalDialog>
    </Modal>
  );
}
