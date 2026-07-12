import { redirect } from "next/navigation";
import { getPendingMfaSession } from "@/lib/auth";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Two-step verification · CAP Trellis" };

export default async function MfaPage() {
  const pending = await getPendingMfaSession();
  if (!pending) redirect("/login");
  return <MfaForm name={pending.user.name.split(" ")[0]} />;
}
