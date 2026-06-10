import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { visibleClients } from "@/lib/access";

/** Topbar client search — results are scoped server-side to the user's assigned programs. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json([]);

  const hits = visibleClients(user)
    .filter((c) =>
      (c.first + " " + c.last).toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q),
    )
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: `${c.first} ${c.last}`,
      sub: `${c.id} · ${(c.address ?? "").split(",")[1]?.trim() ?? c.county ?? ""}`,
      initial: c.first[0] ?? "?",
    }));

  return NextResponse.json(hits);
}
