import type { Source } from "@/lib/types";

// Fixture sources. URLs point at example.com on purpose: these are mocks, not real documents.
export function src(name: string, path: string, date: string, rank = 1): Source {
  return { name, document: `https://example.com/${path}`, date, source_rank: rank };
}

export const S = {
  registryFI: (path: string, date = "2026-10-02") => src("Finnish Trade Register", `prh/${path}`, date, 1),
  registryNO: (path: string, date = "2026-09-20") => src("Brønnøysund Register", `brreg/${path}`, date, 1),
  registryNL: (path: string, date = "2026-09-12") => src("KvK Business Register", `kvk/${path}`, date, 1),
  registrySE: (path: string, date = "2026-09-28") => src("Bolagsverket", `bolagsverket/${path}`, date, 1),
  site: (company: string, path = "about", date = "2026-10-10") => src(`${company} website`, `${slug(company)}/${path}`, date, 3),
  press: (title: string, date: string) => src(title, `press/${slug(title)}`, date, 2),
  grant: (agency: string, path: string, date: string) => src(agency, `grants/${path}`, date, 1),
  news: (outlet: string, path: string, date: string) => src(outlet, `news/${path}`, date, 2),
  linkedin: (who: string, date = "2026-10-30") => src("Professional profile", `profiles/${slug(who)}`, date, 4),
  slush: (path: string, date = "2026-11-10") => src("Slush 2026 attendee list", `slush/${path}`, date, 1),
};

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
