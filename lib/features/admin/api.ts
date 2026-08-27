import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { authClient, authFetch } from "@/lib/features/authentication/client";
import { authErrorMessage } from "@/lib/features/authentication/auth-fetch";
import { resolveOrganizationIdAdmin } from "@/lib/features/authentication/organization-utils";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { BetterAuthUser, convertBetterAuthToAccountResult } from "./conversions-better-auth";
import { Account, ROSTER_FETCH_CHUNK_SIZE, ROSTER_MEMBER_CHUNK_SIZE } from "./types";

/**
 * `organizationSlug` must be threaded down from the roster page's server-side
 * read of NEXT_PUBLIC_APP_ORGANIZATION. That variable is not inlined into
 * client bundles, so this queryFn — which runs in the browser — cannot read it
 * from the environment itself.
 *
 * It is the only argument: search, role filter and pagination are applied to
 * the fetched roster (see `roster-filter.ts`), so they must not vary the cache
 * key or every keystroke would evict the roster and refetch it.
 */
type RosterArgs = { organizationSlug: string };
type RosterResult = { accounts: Account[] };

// No `name` field: better-auth's `user.name` column is not the display
// handle it sounds like — it has been silently duplicating DJs' legal names,
// so provisioning must never populate it from realName or username. Requires
// the auth provision route to accept a name-less body.
type ProvisionUserArgs = {
  email: string;
  username: string;
  organizationSlug: string;
  role: string;
  realName?: string;
  djName?: string;
};

type ProvisionUserResult = {
  emailSent?: boolean;
  emailError?: string;
};

/**
 * better-auth's SDK parser (betterJSONParse, strict:false) can hand back the
 * raw JSON string instead of a parsed object.
 */
function parseSdkPayload<T>(data: unknown, label: string): T | undefined {
  if (typeof data === "string") {
    console.warn(`[roster] better-auth returned unparsed JSON for ${label}; parsing manually`);
    return JSON.parse(data) as T;
  }
  return (data ?? undefined) as T | undefined;
}

/**
 * Fetch the organization roles for exactly the given users.
 *
 * Scoped to the ids asked for rather than the whole organization, so no
 * membership can be dropped by a limit — list-members applies no ORDER BY, and
 * a truncated page would be an arbitrary subset rendering as Members. The ids
 * go in chunks because they travel in the query string, which a proxy will
 * reject once it is long enough.
 *
 * A one-element array serializes to a single query parameter, which the server
 * reads back as a scalar and rejects under `in` — use `eq` for that case.
 */
async function fetchMemberRoles(
  organizationId: string,
  userIds: string[]
): Promise<[string, string][]> {
  const chunks: string[][] = [];
  for (let start = 0; start < userIds.length; start += ROSTER_MEMBER_CHUNK_SIZE) {
    chunks.push(userIds.slice(start, start + ROSTER_MEMBER_CHUNK_SIZE));
  }

  // Chunking is a query-string limit, not an ordering constraint, so the
  // requests go out together: a roster refetch runs after every account edit,
  // and serializing them would put one round trip per 50 accounts in front of
  // the table each time.
  const responses = await Promise.all(
    chunks.map((chunk) =>
      authClient.organization.listMembers({
        query: {
          organizationId,
          filterField: "userId",
          limit: chunk.length,
          ...(chunk.length === 1
            ? { filterOperator: "eq" as const, filterValue: chunk[0] }
            : { filterOperator: "in" as const, filterValue: chunk }),
        },
      })
    )
  );

  return responses.flatMap((result) => {
    throwIfBetterAuthError(result, "Failed to fetch organization roles");

    const payload = parseSdkPayload<{ members?: { userId: string; role: string }[] }>(
      result.data,
      "list-members"
    );

    return (payload?.members ?? []).map((member): [string, string] => [member.userId, member.role]);
  });
}

/**
 * Every non-anonymous account, in as many requests as it takes.
 *
 * The roster is fetched whole because its search and filters run client-side;
 * anonymous users stay excluded server-side because there are more of them than
 * real accounts and none of them belong on a DJ roster.
 *
 * Interim: the walk, the truncation guard and the client-side ordering all
 * exist only because better-auth answers the question badly. A Backend-Service
 * route joining `auth_user` and `auth_member` — the shape
 * `/auth/admin/resolve-organization` and `/auth/admin/provision-user` already
 * take when the SDK falls short — deletes all three. Worth building once the
 * roster outgrows one request, or when it needs a second sort or filter.
 *
 * `sortBy` is not cosmetic — without it `list-users` issues no ORDER BY, so two
 * offsets into an unordered result can repeat one account and omit another.
 * `id` is unique, which is all a stable offset walk needs; display order is
 * decided later.
 */
async function fetchAllAccounts(): Promise<BetterAuthUser[]> {
  const users: BetterAuthUser[] = [];

  // Latched from the first response and never revised. `list-users` answers a
  // query that threw with 200 `{users: [], total: 0}`, so a later response's
  // count is not evidence about the roster — believing one would let a failure
  // mid-walk retire the loop as though the roster had shrunk to whatever had
  // already arrived, which is the silent truncation the guard below refuses.
  let expected: number | null = null;

  do {
    const result = await authClient.admin.listUsers({
      query: {
        limit: ROSTER_FETCH_CHUNK_SIZE,
        offset: users.length,
        sortBy: "id",
        sortDirection: "asc",
        filterField: "isAnonymous",
        filterValue: "false",
        filterOperator: "eq",
      },
    });
    throwIfBetterAuthError(result, "Failed to fetch users");

    const parsed = parseSdkPayload<{ users?: unknown[]; total?: number }>(
      result.data,
      "list-users"
    );
    const batch = (parsed?.users ?? []) as BetterAuthUser[];
    expected ??= parsed?.total ?? batch.length;

    // A short roster that renders as a complete one is the failure mode worth
    // refusing: an admin cannot tell a missing DJ from a DJ who never existed.
    if (batch.length === 0 && users.length < expected) {
      throw new Error(
        `The roster is incomplete: the server counts ${expected} accounts but stopped returning them after ${users.length}.`
      );
    }

    users.push(...batch);
  } while (users.length < expected);

  return users;
}

/** Normalize a rejected provisionUser mutation into a user-facing message. */
export function provisionErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Failed to create account";
}

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fakeBaseQuery<{ message: string }>(),
  tagTypes: ["Roster"],
  endpoints: (builder) => ({
    getRoster: builder.query<RosterResult, RosterArgs>({
      queryFn: async ({ organizationSlug }) => {
        try {
          if (!organizationSlug) {
            throw new Error(
              "The station organization is not configured, so account roles are unavailable."
            );
          }

          const [organizationId, users] = await Promise.all([
            resolveOrganizationIdAdmin(organizationSlug),
            fetchAllAccounts(),
          ]);

          // A DJ's or music director's role lives only on their organization
          // membership: provisioning mirrors nothing but stationManager into the
          // better-auth user row, so user.role reads as "user" for them. Refuse
          // to build the roster without the membership — labelling every DJ a
          // Member looks like an answer instead of a failure.
          if (!organizationId) {
            throw new Error(
              "Could not resolve the station organization, so account roles are unavailable."
            );
          }

          const userIds = users.map((user) => user.id);
          const memberRoleMap = new Map(
            userIds.length > 0 ? await fetchMemberRoles(organizationId, userIds) : []
          );

          const accounts = users.map((user) => {
            // No membership means no station role, which is what "member"
            // encodes. Every non-anonymous user gets one on creation, so this
            // only covers rows that predate that guarantee.
            user.role = (memberRoleMap.get(user.id) ?? "member") as typeof user.role;
            return convertBetterAuthToAccountResult(user);
          });

          return { data: { accounts } };
        } catch (err) {
          return { error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      providesTags: ["Roster"],
    }),
    provisionUser: builder.mutation<ProvisionUserResult, ProvisionUserArgs>({
      queryFn: async (args) => {
        try {
          const { ok, status, data } = await authFetch<
            ProvisionUserResult & { message?: string; error?: string }
          >("/admin/provision-user", { method: "POST", json: args });

          if (!ok) {
            return {
              error: { message: authErrorMessage(data, `Failed to create user (${status})`) },
            };
          }

          return { data: { emailSent: data?.emailSent, emailError: data?.emailError } };
        } catch (err) {
          return {
            error: {
              message: err instanceof Error ? err.message : "Failed to create user",
            },
          };
        }
      },
    }),
  }),
});

export const { useGetRosterQuery, useProvisionUserMutation } = adminApi;
