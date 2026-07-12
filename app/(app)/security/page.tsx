import { requireUser } from "@/lib/auth";
import { SecurityClient } from "./security-client";
import { mySessionList } from "./actions";

export const metadata = { title: "Security · CAP Trellis" };

export default async function SecurityPage() {
  const user = await requireUser();
  const sessions = await mySessionList();
  return (
    <SecurityClient
      totpEnabled={user.totpEnabled === 1}
      recoveryCount={user.recoveryCodes.length}
      sessions={sessions}
    />
  );
}
