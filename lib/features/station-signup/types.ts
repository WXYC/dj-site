/**
 * Wire types for `/auth/admin/station-signup/*`. Every timestamp crosses the
 * wire as an ISO string, never a `Date` -- these types describe the JSON
 * exactly as `fetch` hands it back, and the panel formats strings through
 * `stationTime.ts` at render time rather than parsing dates here.
 */

export type StationPasscodeState = "active" | "revoked" | "expired";

export type StationPasscodeStateRow = {
  id: string;
  state: StationPasscodeState;
  createdAt: string;
  createdBy: string | null;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  /** This row was auto-revoked by a rotation that could not decrypt it, not by a manager. */
  revokedByKeyRotation: boolean;
  lastUsedAt: string | null;
  useCount: number;
  maxUses: number;
  /** `useCount >= maxUses`. Still `active` by the state predicate, but every further use will fail. */
  exhausted: boolean;
};

export type StationSignupCooldown = {
  inCooldown: boolean;
  /** In-window `passcode_fail` count -- the only outcome that feeds refusal. */
  noMatchFailureCount: number;
  /** In-window count across every failure outcome, including the refusal-exempt ones. */
  allFailureCount: number;
  windowMinutes: number;
  holdMinutes: number;
  /** Refusal triggers on MORE than this many no-match failures in the window. */
  threshold: number;
  /** The most recent `cooldown_cleared` row in the whole log, or null. */
  lastClearedAt: string | null;
};

export type StationSignupAttemptView = {
  id: string;
  attemptedAt: string;
  outcome: string;
  passcodeId: string | null;
  actorUserId: string | null;
  ipHash: string | null;
};

export type StationSignupAttempts = {
  since: string;
  windowHours: number;
  /** Window-wide census, keyed by outcome. Absent outcomes are absent, not zero. Never derive counts from `recent`. */
  countsByOutcome: Record<string, number>;
  /** A display list, not a census: the newest rows only. */
  recent: StationSignupAttemptView[];
};

export type PendingReviewAccountView = {
  userId: string;
  name: string;
  djName: string | null;
  selfSignupAt: string;
  daysPending: number;
  selfSignupDowngradedAt: string | null;
};

export type StationSignupStatus = {
  now: string;
  /** Active rows plus every row that went inactive inside the classification horizon. Never any plaintext. */
  passcodes: StationPasscodeStateRow[];
  cooldown: StationSignupCooldown;
  attempts: StationSignupAttempts;
  pendingReview: PendingReviewAccountView[];
};

export type RevealedStationPasscode = {
  id: string;
  code: string;
  expiresAt: string;
  useCount: number;
  maxUses: number;
};

export type RevealStationPasscodesResult = {
  passcodes: RevealedStationPasscode[];
};

export type RotatedStationPasscode = {
  id: string;
  code: string;
  expiresAt: string;
  maxUses: number;
  /** Ids of active rows this rotation administratively revoked because they would not decrypt. Normally empty. */
  autoRevokedPasscodeIds: string[];
};

export type RevokeStationPasscodeResult = {
  passcodeId: string;
  /** The idempotent no-op case (unknown id, or already revoked) reads `false`, not an error. */
  revoked: boolean;
};

export type ClearStationSignupCooldownResult = {
  cleared: true;
  cooldown: StationSignupCooldown;
};

/** `code` is only ever set for the two typed 503s; every other failure (400/401/403/409/500) carries none. */
export type StationSignupErrorCode = "passcode_cap_exceeded" | "passcode_key_unset" | "passcode_undecryptable";

export type StationSignupApiError = {
  message: string;
  status: number;
  code?: StationSignupErrorCode;
};
