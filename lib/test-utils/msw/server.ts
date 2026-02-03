import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Setup MSW server with base handlers
export const server = setupServer(...handlers);
