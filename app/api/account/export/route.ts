import { connection } from "next/server";
import { exportData } from "@/lib/backend/account";
import { fail } from "../../startups/fail";

/** Downloads everything Warmline stores about the signed-in user as a JSON file (GDPR art. 15 and 20). */
export async function GET() {
  await connection(); // per user, never prerendered
  try {
    const data = await exportData();
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="warmline-data.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e, "Could not export your data.");
  }
}
