import { createPortfolioCompany, listPortfolio, pickPortfolioInput } from "@/lib/backend/portfolio";
import { fail } from "../startups/fail";

// Browser → Next → Django. Keeps the backend token on the server.
export async function GET() {
  try {
    return Response.json(await listPortfolio());
  } catch (e) {
    return fail(e, "Could not load your portfolio.");
  }
}

/** Add a company by hand (no lookup). */
export async function POST(request: Request) {
  try {
    return Response.json(await createPortfolioCompany(pickPortfolioInput(await request.json())), { status: 201 });
  } catch (e) {
    return fail(e, "Could not add the company.");
  }
}
