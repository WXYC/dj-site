/**
 * Auto-DJ status types.
 *
 * Vendored subset of the `@wxyc/shared/auto-dj` surface (networking-spec §5.2)
 * so dj-site isn't blocked on the shared-package publish (WXYC/wxyc-shared#203).
 * Swap these for `import { ... } from "@wxyc/shared/auto-dj"` once published.
 */

export type AutoDJActivationSourceType = "virtual_switch" | "button" | "relay";

export interface AutoDJActivationSource {
  source: AutoDJActivationSourceType;
  userId?: string;
  userName?: string;
  detail?: string;
}

export interface AutoDJCurrentTrack {
  artist: string;
  title: string;
  album: string;
  detectedAt: string;
}

export interface AutoDJDeviceSummary {
  online: boolean;
  transport: "ethernet" | "wifi";
  lastHeartbeat: string;
  relayState: "auto_dj_active" | "dj_live";
}

export interface AutoDJStatus {
  active: boolean;
  activatedBy?: AutoDJActivationSource;
  activatedAt?: string;
  showId?: number;
  currentTrack?: AutoDJCurrentTrack | null;
  lastDeactivatedAt?: string;
  lastDeactivatedBy?: AutoDJActivationSource;
  device?: AutoDJDeviceSummary | null;
}

export interface AutoDJDeactivateResponse {
  active: false;
  deactivatedBy: AutoDJActivationSource;
  deactivatedAt: string;
}
