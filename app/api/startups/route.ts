import { createStartup, listStartups, pickInput } from "@/lib/backend/startups";
import { fail } from "./fail";

// Browser → Next → Django. Keeps the backend token on the server.
export async function GET() {
  try {
    return Response.json(await listStartups());
  } catch (e) {
    return fail(e, "Could not load your startups.");
  }
}

/** Add a startup by hand (no lookup). */
export async function POST(request: Request) {
  try {
    return Response.json(await createStartup(pickInput(await request.json())), { status: 201 });
  } catch (e) {
    return fail(e, "Could not add the startup.");
  }
}
