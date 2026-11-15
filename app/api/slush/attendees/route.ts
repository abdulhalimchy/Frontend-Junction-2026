import { fetchSlush } from "@/lib/cala/slush";
import { normaliseName } from "@/lib/names";

// Attendee names as you type in the Slush attendee search. Reads the cached attendee list, so it costs no lookup.

export async function GET(request: Request) {
  const needle = normaliseName((new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100));
  if (needle.length < 2) return Response.json({ hits: [] });
  try {
    const { attendees } = await fetchSlush();
    const starts: string[] = [];
    const contains: string[] = [];
    for (const a of attendees) {
      const at = normaliseName(a.name).indexOf(needle);
      if (at === 0) starts.push(a.name);
      else if (at > 0) contains.push(a.name);
    }
    const names = [...new Set([...starts, ...contains])].slice(0, 8);
    return Response.json({ hits: names.map((name) => ({ id: name, name, subtitle: "On the attendee list" })) });
  } catch {
    return Response.json({ hits: [] });
  }
}
