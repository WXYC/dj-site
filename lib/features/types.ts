import { ApplicationState } from "./application/types";
import {
  AuthenticationData,
} from "./authentication/types";

export type SiteProps = {
  application: ApplicationState;
  authentication: AuthenticationData;
};
