// run.js
// ---------------------------------------------------------------
// End-to-end orchestrator. Runs the full pipeline in order:
//   1. Find prospects          (Google Places)
//   2. Draft emails             (Claude)
//   3. Generate preview sites   (Claude) — optional, --sites flag
//   4. Review + send            (Gmail, with per-email y/N confirm)
//
// Usage:
//   node src/run.js                 # find → draft → send
//   node src/run.js --sites         # also generate preview sites
//   node src/run.js --no-send       # find + draft only (manual review)
// ---------------------------------------------------------------

import { findProspects } from "./findProspects.js";
import { writeEmailFor } from "./writeEmail.js";
import { generateSiteFor } from "./generateSite.js";
import { sendDrafts } from "./sendEmail.js";
import { config } from "./config.js";

async function main() {
  const args = new Set(process.argv.slice(2));
  const doSites = args.has("--sites");
  const doSend = !args.has("--no-send");

  console.log("═".repeat(60));
  console.log(" Simone Outreach Pipeline");
  console.log("═".repeat(60));
  console.log(
    ` Dry run: ${config.dryRun}   Max sends: ${config.maxEmailsPerRun}`
  );

  // 1. Find prospects
  const prospects = await findProspects();
  const shortlist = prospects.slice(0, config.maxEmailsPerRun);
  if (!shortlist.length) {
    console.log("No prospects without websites found. Done.");
    return;
  }

  // 2. Draft an email for each
  console.log("\nDrafting emails with Claude...");
  const drafts = [];
  for (const p of shortlist) {
    process.stdout.write(`  ${p.name}... `);
    try {
      drafts.push(await writeEmailFor(p));
      console.log("ok");
    } catch (err) {
      console.log(`FAILED (${err.message})`);
    }
  }

  // 3. (optional) Generate a preview site for each
  if (doSites) {
    console.log("\nGenerating preview sites with Claude...");
    for (const p of shortlist) {
      process.stdout.write(`  ${p.name}... `);
      try {
        const file = await generateSiteFor(p);
        console.log(file);
      } catch (err) {
        console.log(`FAILED (${err.message})`);
      }
    }
  }

  // 4. Review + send (with per-email confirmation)
  if (doSend && drafts.length) {
    console.log("\nReview and send:");
    await sendDrafts(drafts);
  } else {
    console.log(`\nSkipping send (${drafts.length} drafts ready).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
