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
import { LockOpen, VisibilityOffRounded, VisibilityRounded, WarningRounded } from "@mui/icons-material";
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
import {
  cooldownLiftsAtMs,
  formatHoldRemaining,
  isRefusedOutcome,
  outcomeCensus,
  useServerClockMs,
} from "./stationSignupStatusView";

/** How often the read-only status poll refreshes. Reveal/rotate/revoke/clear-cooldown invalidate it immediately on success. */
const STATUS_POLL_INTERVAL_MS = 20_000;

/** The countdown ticks per second; the status poll is far too coarse to count down against. */
const COUNTDOWN_TICK_MS = 1_000;

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

function RevealedCredentials({ credential }: { credential: LiveCredential }) {
  const codes =
    "passcodes" in credential
      ? credential.passcodes.map((p) => ({ id: p.id, code: p.code }))
      : [credential.rotated];

  // A reveal against a station with the key configured but no live row returns
  // an empty list, which is a real state and not a failure -- saying so beats
  // an audit-weight warning heading with nothing under it. Dismissal is the
  // toolbar's Reveal/Hide toggle, so this alert carries no button of its own.
  if (codes.length === 0) {
    return (
      <Alert color="neutral" variant="soft" startDecorator={<VisibilityRounded />}>
        <Typography level="title-sm">No active passcode to reveal — rotate to mint one.</Typography>
      </Alert>
    );
  }

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
      </Stack>
    </Alert>
  );
}

export default function StationSignupPanel() {
  const { data: status, error, isLoading, isFetching } = useGetStationSignupStatusQuery(undefined, {
    pollingInterval: STATUS_POLL_INTERVAL_MS,
  });

  const [reveal, { isLoading: isRevealing, reset: resetReveal }] = useRevealStationPasscodesMutation();
  const [rotate, { isLoading: isRotating, reset: resetRotate }] = useRotateStationPasscodeMutation();
  const [revoke, { isLoading: isRevoking }] = useRevokeStationPasscodeMutation();
  const [clearCooldown, { isLoading: isClearingCooldown }] = useClearStationSignupCooldownMutation();

  const [liveCredential, setLiveCredential] = useState<LiveCredential | null>(null);
  const [serviceFault, setServiceFault] = useState<StationSignupApiError | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  // The status endpoint never decrypts, so the lift deadline has to be derived
  // from the attempt log rather than read off the payload.
  const liftsAtMs =
    status && status.cooldown.inCooldown
      ? cooldownLiftsAtMs(status.attempts, status.cooldown.holdMinutes)
      : null;
  const serverNowMs = useServerClockMs(status?.now, liftsAtMs === null ? null : COUNTDOWN_TICK_MS);
  const holdRemainingMs = liftsAtMs !== null && serverNowMs !== null ? liftsAtMs - serverNowMs : null;

  const attemptCensus = status ? outcomeCensus(status.attempts.countsByOutcome) : [];

  /**
   * A 503 says the service itself cannot mint or read passcodes; it stays on
   * screen until the manager fixes it, because the fix is a host change or a
   * rotation, not a retry. Everything else is a transient toast.
   */
  const surfaceMutationError = useCallback((err: unknown) => {
    if (isStationSignupApiError(err) && err.status === 503) {
      setServiceFault(err);
      return;
    }
    toast.error(stationSignupErrorMessage(err));
  }, []);

  const handleReveal = useCallback(async () => {
    try {
      const result = await reveal().unwrap();
      setServiceFault(null);
      setLiveCredential({ passcodes: result.passcodes });
    } catch (err) {
      surfaceMutationError(err);
    }
  }, [reveal, surfaceMutationError]);

  const handleRotate = useCallback(async () => {
    try {
      const result = await rotate().unwrap();
      setServiceFault(null);
      setLiveCredential({ rotated: { id: result.id, code: result.code } });
      if (result.autoRevokedPasscodeIds.length > 0) {
        toast.warning(
          "Rotation auto-revoked a code that could no longer decrypt — any sticky note carrying it is dead."
        );
      } else {
        toast.success("Station passcode rotated.");
      }
    } catch (err) {
      surfaceMutationError(err);
    }
  }, [rotate, surfaceMutationError]);

  const handleHideCredential = useCallback(() => {
    setLiveCredential(null);
    // The plaintext also sits in the mutation cache until that entry is reset,
    // so hiding has to clear both or the code outlives the alert showing it.
    resetReveal();
    resetRotate();
  }, [resetReveal, resetRotate]);

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

        {serviceFault && (
          <Alert
            color="danger"
            variant="soft"
            startDecorator={<WarningRounded />}
            sx={{ mb: 2 }}
            data-testid="station-signup-service-fault"
          >
            <Stack spacing={1} sx={{ width: "100%" }}>
              <Typography level="body-sm">{stationSignupErrorMessage(serviceFault)}</Typography>
              <Stack direction="row" spacing={1}>
                {serviceFault.code === "passcode_undecryptable" && (
                  <Button size="sm" variant="solid" color="danger" loading={isRotating} onClick={handleRotate}>
                    Rotate
                  </Button>
                )}
                <Button size="sm" variant="plain" color="neutral" onClick={() => setServiceFault(null)}>
                  Dismiss
                </Button>
              </Stack>
            </Stack>
          </Alert>
        )}

        {liveCredential && <RevealedCredentials credential={liveCredential} />}

        {isLoading ? (
          <CircularProgress size="sm" />
        ) : error ? (
          <Alert color="danger" startDecorator={<WarningRounded />}>
            {stationSignupErrorMessage(error)}
          </Alert>
        ) : status ? (
          <Stack spacing={2}>
            {status.cooldown.inCooldown && (
              <Alert color="danger" variant="soft" startDecorator={<WarningRounded />}>
                <Stack spacing={1} sx={{ width: "100%" }}>
                  <Typography level="title-sm">Signup is in cooldown</Typography>
                  <Typography level="body-sm">
                    {status.cooldown.noMatchFailureCount} failed match{status.cooldown.noMatchFailureCount === 1 ? "" : "es"} in
                    the last {status.cooldown.windowMinutes} minutes (threshold {status.cooldown.threshold}).
                  </Typography>
                  <Typography level="body-sm">
                    {holdRemainingMs === null
                      ? `It lifts on its own ${status.cooldown.holdMinutes} minutes after the last qualifying failure, or immediately below.`
                      : holdRemainingMs > 0
                        ? `Lifts on its own in ${formatHoldRemaining(holdRemainingMs)}, or immediately below.`
                        : "The hold has run out — the next refresh should show it lifted, or lift it immediately below."}
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
                startDecorator={liveCredential ? <VisibilityOffRounded /> : <VisibilityRounded />}
                loading={isRevealing}
                onClick={liveCredential ? handleHideCredential : handleReveal}
              >
                {liveCredential ? "Hide" : "Reveal"}
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
                        <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                          <PasscodeStateChip
                            state={passcode.state}
                            exhausted={passcode.exhausted}
                            revokedByKeyRotation={passcode.revokedByKeyRotation}
                          />
                          {passcode.revokedReason && (
                            <Typography level="body-xs">{passcode.revokedReason}</Typography>
                          )}
                        </Stack>
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

            <Divider />

            {/*
              The window-wide census, not a tally of the rows above: a healthy
              passcode table says nothing about a brute-force ramp or a wave of
              exhausted-code refusals, which is exactly what a manager fielding
              "the code isn't working" needs to tell apart.
            */}
            <Stack spacing={1}>
              <Typography level="title-sm">
                {`Signup attempts, last ${status.attempts.windowHours} hours`}
              </Typography>
              {attemptCensus.length === 0 ? (
                <Typography level="body-sm">No signup attempts recorded in this window.</Typography>
              ) : (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {attemptCensus.map(({ outcome, label, count }) => (
                    <Chip
                      key={outcome}
                      size="sm"
                      variant="soft"
                      color={isRefusedOutcome(outcome) ? "warning" : "neutral"}
                    >
                      {`${label}: ${count}`}
                    </Chip>
                  ))}
                </Stack>
              )}
              {status.cooldown.lastClearedAt && (
                <Typography level="body-xs">
                  {`Cooldown last cleared ${formatPasscodeTimestamp(status.cooldown.lastClearedAt)}`}
                </Typography>
              )}
            </Stack>
          </Stack>
        ) : null}

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
