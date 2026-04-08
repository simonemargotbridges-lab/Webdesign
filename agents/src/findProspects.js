// findProspects.js
// ---------------------------------------------------------------
// Finds local businesses that DO NOT already have a website.
// Uses the Google Places API (New) "searchText" endpoint, which
// returns a website field when one exists on the Google listing.
//
// Usage:
//   node src/findProspects.js
//   node src/findProspects.js "bakery" "Wellesley, MA"
//
// Output:
//   Writes agents/data/prospects.json — an array of prospects:
//   [
//     { name, address, phone, category, placeId, mapsUrl, email? }
//   ]
// ---------------------------------------------------------------

import fs from "node:fs/promises";
import path from "node:path";
import { config, dataDir } from "./config.js";

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

// Fields we ask Google for. "websiteUri" is the key one — if missing,
// the business likely has no website.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.primaryType",
  "places.businessStatus",
].join(",");

async function searchOneKeyword(keyword, location) {
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.googlePlacesKey(),
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${keyword} in ${location}`,
      maxResultCount: 20,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.places ?? [];
}

function normalize(place, category) {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? "(unknown)",
    address: place.formattedAddress ?? "",
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? "",
    website: place.websiteUri ?? "",
    mapsUrl: place.googleMapsUri ?? "",
    category,
    status: place.businessStatus ?? "",
  };
}

export async function findProspects({ keywords, location } = {}) {
  const kws = keywords ?? config.searchKeywords;
  const loc = location ?? config.searchLocation;

  console.log(`\nSearching near "${loc}" for: ${kws.join(", ")}\n`);

  const all = [];
  for (const kw of kws) {
    try {
      const places = await searchOneKeyword(kw, loc);
      const mapped = places.map((p) => normalize(p, kw));
      all.push(...mapped);
      console.log(`  ${kw.padEnd(18)} → ${mapped.length} results`);
    } catch (err) {
      console.error(`  ${kw} → ERROR: ${err.message}`);
    }
  }

  // Dedupe by placeId
  const byId = new Map();
  for (const p of all) byId.set(p.placeId, p);
  const unique = [...byId.values()];

  // Keep only OPERATIONAL businesses without a website
  const prospects = unique.filter(
    (p) => !p.website && p.status !== "CLOSED_PERMANENTLY"
  );

  console.log(
    `\nFound ${unique.length} unique businesses, ${prospects.length} have NO website.\n`
  );

  await fs.mkdir(dataDir, { recursive: true });
  const outPath = path.join(dataDir, "prospects.json");
  await fs.writeFile(outPath, JSON.stringify(prospects, null, 2));
  console.log(`Saved → ${outPath}`);

  return prospects;
}

// Run directly from CLI: `node src/findProspects.js [keyword] [location]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , kwArg, locArg] = process.argv;
  const keywords = kwArg ? [kwArg] : undefined;
  const location = locArg || undefined;
  findProspects({ keywords, location }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
