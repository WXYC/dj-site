import { authConfig } from "@/app/cognitoConfig";
import { Authority } from "@/lib/models";
import { NextServer, createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth/server";

export const { runWithAmplifyServerContext } = createServerRunner({
  config: {
    Auth: authConfig,
  },
});

export async function authenticatedUser(context: NextServer.Context) {
  return await runWithAmplifyServerContext({
    nextServerContext: context,
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        if (!session.tokens) {
          return;
        }
        const user = {
          ...(await getCurrentUser(contextSpec)),
          authority: Authority.None,
        };
        const groups = session.tokens.accessToken.payload["cognito:groups"];
        // @ts-ignore
        var isMusicDirector = Boolean(groups && groups.includes("music-management"));
        // @ts-ignore
        var isStationManagement = Boolean(groups && groups.includes("station-management"));

        user.authority = !user ? Authority.None : (
          isStationManagement ? Authority.SM : (
            isMusicDirector ? Authority.MD : Authority.DJ
          )
        );

        return user;
      } catch (error) {
        console.log(error);
      }
    },
  });
}
