import { ApplicationState } from "./application/types";
import {
  AuthenticationData,
  AuthenticationSession,
} from "./authentication/types";

export function setDefault(session: AuthenticationSession) {
  session.refreshToken = undefined;
}

export type SiteProps = {
  application: ApplicationState;
  authentication: AuthenticationData;
};
