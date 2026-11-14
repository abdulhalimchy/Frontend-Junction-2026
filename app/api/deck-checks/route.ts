import { BackendError } from "@/lib/backend/client";
import { uploadDeck } from "@/lib/backend/deck-checks";

// Browser → Next → Django. Keeps the backend token on the server.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a PDF file." }, { status: 400 });
    const startup = form.get("startup");
    return Response.json(
      await uploadDeck(file, String(form.get("company_name") ?? ""), typeof startup === "string" && startup ? startup : undefined),
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  const err = e instanceof BackendError ? e : new BackendError("Upload failed.", 500);
  return Response.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 500 });
}
