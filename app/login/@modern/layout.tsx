import { isIncomplete } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import WXYCPage from "@/src/Layout/WXYCPage";

export default async function ModernLoginLayout({
  normal,
  reset,
}: {
  normal: React.ReactNode;
  reset: React.ReactNode;
}) {
  const serverSideProps = await createServerSideProps();

  return (
    <WXYCPage title="Login">
      {isIncomplete(serverSideProps.authentication) ? reset : normal}
    </WXYCPage>
  );
}
