import { requireUser } from "@/lib/auth";
import { PageHead } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHead title="Good morning," titleAccent={user.name.split(" ")[0] + "."} lede="Placeholder — implementation in progress." />
    </div>
  );
}
