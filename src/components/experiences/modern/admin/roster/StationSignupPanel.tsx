"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { LockOpen, VisibilityRounded, WarningRounded } from "@mui/icons-material";
import { RequireSM } from "@/src/components/shared/Authorization";
import {
  useClearStationSignupCooldownMutation,
  useGetStationSignupStatusQuery,
  useRevealStationPasscodesMutation,
  useRevokeStationPasscodeMutation,
  useRotateStationPasscodeMutation,
} from "@/lib/features/station-signup/api";
import type { RevealedStationPasscode, StationSignupApiError } from "@/lib/features/station-signup/types";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";

/** How often the read-only status poll refreshes. Reveal/rotate/revoke/clear-cooldown invalidate it immediately on success. */
const STATUS_POLL_INTERVAL_MS = 20_000;

function isStationSignupApiError(error: unknown): error is StationSignupApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "status" in error
  );
}

/**
 * Distinct copy for an unauthenticated caller, a signed-in caller who isn't a
 * manager, and the two typed 503s the auth service returns when the passcode
 * key is unset or an active row won't decrypt. Everything else falls back to
 * the server's own message.
 */
function stationSignupErrorMessage(error: unknown): string {
  if (!isStationSignupApiError(error)) {
    return "Something went wrong talking to the station signup admin API.";
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to manage the station passcode.";
  }
  if (error.status === 403) {
    return "You do not have station manager access, so the station passcode cannot be managed from here.";
  }
  if (error.code === "passcode_key_unset") {
    return (
      "STATION_PASSCODE_KEY is not set on the auth service, so station passcodes can be neither " +
      "revealed nor minted. Set it on the host and restart the service."
    );
  }
  if (error.code === "passcode_undecryptable") {
    return (
      "An active station passcode will not decrypt, so the signup gate is failing closed. Rotating " +
      "administratively revokes the undecryptable code and mints a working one."
    );
  }
  if (error.code === "passcode_cap_exceeded") {
    return "Two station passcodes are already active. Revoke one before rotating.";
  }
  return error.message;
}

/** Date and time, station-local -- a bare time is ambiguous between tonight and next week. */
function formatPasscodeTimestamp(isoString: string | null): string {
  if (!isoString) return "Never";
  const { day, time } = formatStationDateTime(isoString);
  return `${day} ${time}`;
}

function PasscodeStateChip({
  state,
  exhausted,
  revokedByKeyRotation,
}: {
  state: string;
  exhausted: boolean;
  revokedByKeyRotation: boolean;
}) {
  if (state === "revoked") {
    return (
      <Chip color="danger" size="sm">
        Revoked{revokedByKeyRotation ? " (key rotation)" : ""}
      </Chip>
    );
  }
  if (state === "expired") {
    return (
      <Chip color="neutral" size="sm">
        Expired
      </Chip>
    );
  }
  if (exhausted) {
    return (
      <Chip color="warning" size="sm">
        Active, exhausted
      </Chip>
    );
  }
  return (
    <Chip color="success" size="sm">
      Active
    </Chip>
  );
}

/** The plaintext a reveal or rotate just returned. Cleared on hide, on unmount, and never persisted anywhere. */
type LiveCredential = { passcodes: RevealedStationPasscode[] } | { rotated: { id: string; code: string } };

function RevealedCredentials({
  credential,
  onHide,
}: {
  credential: LiveCredential;
  onHide: () => void;
}) {
  const codes =
    "passcodes" in credential
      ? credential.passcodes.map((p) => ({ id: p.id, code: p.code }))
      : [credential.rotated];

  return (
    <Alert color="warning" variant="soft" startDecorator={<VisibilityRounded />}>
      <Stack spacing={1} sx={{ width: "100%" }}>
        <Typography level="title-sm">
          Live station passcode{codes.length > 1 ? "s" : ""} — this reveal was logged
        </Typography>
        {codes.map(({ id, code }) => (
          <Typography key={id} level="body-lg" fontFamily="monospace" sx={{ letterSpacing: "0.1em" }}>
            {code}
          </Typography>
        ))}
        <Button size="sm" variant="outlined" color="warning" onClick={onHide} sx={{ alignSelf: "flex-start" }}>
          Hide
        </Button>
      </Stack>
    </Alert>
  );
}

export default function StationSignupPanel() {
  const { data: status, error, isLoading, isFetching } = useGetStationSignupStatusQuery(undefined, {
    pollingInterval: STATUS_POLL_INTERVAL_MS,
  });

  const [reveal, { isLoading: isRevealing }] = useRevealStationPasscodesMutation();
  const [rotate, { isLoading: isRotating }] = useRotateStationPasscodeMutation();
  const [revoke, { isLoading: isRevoking }] = useRevokeStationPasscodeMutation();
  const [clearCooldown, { isLoading: isClearingCooldown }] = useClearStationSignupCooldownMutation();

  const [liveCredential, setLiveCredential] = useState<LiveCredential | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleReveal = useCallback(async () => {
    try {
      const result = await reveal().unwrap();
      setLiveCredential({ passcodes: result.passcodes });
      setConfirmReveal(false);
    } catch (err) {
      toast.error(stationSignupErrorMessage(err));
      setConfirmReveal(false);
    }
  }, [reveal]);

  const handleRotate = useCallback(async () => {
    try {
      const result = await rotate().unwrap();
      setLiveCredential({ rotated: { id: result.id, code: result.code } });
      if (result.autoRevokedPasscodeIds.length > 0) {
        toast.warning(
          "Rotation auto-revoked a code that could no longer decrypt — any sticky note carrying it is dead."
        );
      } else {
        toast.success("Station passcode rotated.");
      }
    } catch (err) {
      toast.error(stationSignupErrorMessage(err));
    }
  }, [rotate]);

  const handleRevokeConfirmed = useCallback(async () => {
    if (!confirmRevokeId) return;
    const passcodeId = confirmRevokeId;
    try {
      const result = await revoke({ passcodeId }).unwrap();
      if (result.revoked) {
        toast.success("Station passcode revoked.");
      } else {
        toast("That passcode was already inactive.");
      }
    } catch (err) {
      toast.error(stationSignupErrorMessage(err));
    } finally {
      setConfirmRevokeId(null);
    }
  }, [confirmRevokeId, revoke]);

  const handleClearCooldown = useCallback(async () => {
    try {
      await clearCooldown().unwrap();
      toast.success("Signup cooldown cleared.");
    } catch (err) {
      toast.error(stationSignupErrorMessage(err));
    }
  }, [clearCooldown]);

  return (
    <RequireSM>
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }} data-testid="station-signup-panel">
        <Typography level="title-md" sx={{ mb: 1 }}>
          Station Signup Passcode
        </Typography>

        {liveCredential && <RevealedCredentials credential={liveCredential} onHide={() => setLiveCredential(null)} />}

        {isLoading ? (
          <CircularProgress size="sm" />
        ) : error ? (
          <Stack spacing={2}>
            <Alert color="danger" startDecorator={<WarningRounded />}>
              {stationSignupErrorMessage(error)}
            </Alert>
            {isStationSignupApiError(error) && error.code === "passcode_undecryptable" && (
              <Button size="sm" variant="outlined" loading={isRotating} onClick={handleRotate} sx={{ alignSelf: "flex-start" }}>
                Rotate
              </Button>
            )}
          </Stack>
        ) : status ? (
          <Stack spacing={2}>
            {status.cooldown.inCooldown && (
              <Alert color="danger" variant="soft" startDecorator={<WarningRounded />}>
                <Stack spacing={1} sx={{ width: "100%" }}>
                  <Typography level="title-sm">Signup is in cooldown</Typography>
                  <Typography level="body-sm">
                    {status.cooldown.noMatchFailureCount} failed match{status.cooldown.noMatchFailureCount === 1 ? "" : "es"} in
                    the last {status.cooldown.windowMinutes} minutes (threshold {status.cooldown.threshold}). It lifts on its
                    own {status.cooldown.holdMinutes} minutes after the last qualifying failure, or immediately below.
                  </Typography>
                  <Button
                    size="sm"
                    variant="solid"
                    color="danger"
                    startDecorator={<LockOpen />}
                    loading={isClearingCooldown}
                    onClick={handleClearCooldown}
                  >
                    Clear cooldown
                  </Button>
                </Stack>
              </Alert>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                size="sm"
                variant="solid"
                color="warning"
                startDecorator={<VisibilityRounded />}
                loading={isRevealing}
                onClick={() => setConfirmReveal(true)}
              >
                Reveal
              </Button>
              <Button size="sm" variant="outlined" loading={isRotating} onClick={handleRotate}>
                Rotate
              </Button>
              {isFetching && <CircularProgress size="sm" />}
            </Stack>

            <Divider />

            <Table size="sm">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Last used</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {status.passcodes.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <Typography level="body-sm">No station passcodes exist yet.</Typography>
                    </td>
                  </tr>
                ) : (
                  status.passcodes.map((passcode) => (
                    <tr key={passcode.id}>
                      <td>
                        <PasscodeStateChip
                          state={passcode.state}
                          exhausted={passcode.exhausted}
                          revokedByKeyRotation={passcode.revokedByKeyRotation}
                        />
                      </td>
                      <td>{formatPasscodeTimestamp(passcode.lastUsedAt)}</td>
                      <td>
                        {passcode.useCount} / {passcode.maxUses}
                      </td>
                      <td>{formatPasscodeTimestamp(passcode.expiresAt)}</td>
                      <td>
                        {passcode.state === "active" && (
                          <Button
                            size="sm"
                            variant="plain"
                            color="danger"
                            loading={isRevoking && confirmRevokeId === passcode.id}
                            onClick={() => setConfirmRevokeId(passcode.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Stack>
        ) : null}

        <ConfirmDialog
          open={confirmReveal}
          onClose={() => setConfirmReveal(false)}
          pending={isRevealing}
          title="Reveal the station passcode?"
          titleId="reveal-passcode-title"
          actions={
            <>
              <Button variant="solid" color="warning" loading={isRevealing} onClick={handleReveal}>
                Reveal
              </Button>
              <Button variant="plain" color="neutral" disabled={isRevealing} onClick={() => setConfirmReveal(false)}>
                Cancel
              </Button>
            </>
          }
        >
          This shows the live passcode on screen and is logged as a "passcode revealed" event, attributed to your
          account.
        </ConfirmDialog>

        <ConfirmDialog
          open={confirmRevokeId !== null}
          onClose={() => setConfirmRevokeId(null)}
          pending={isRevoking}
          title="Revoke this station passcode?"
          titleId="revoke-passcode-title"
          actions={
            <>
              <Button variant="solid" color="danger" loading={isRevoking} onClick={handleRevokeConfirmed}>
                Revoke
              </Button>
              <Button variant="plain" color="neutral" disabled={isRevoking} onClick={() => setConfirmRevokeId(null)}>
                Cancel
              </Button>
            </>
          }
        >
          Anyone using this code will be locked out immediately. This cannot be undone.
        </ConfirmDialog>
      </Sheet>
    </RequireSM>
  );
}
