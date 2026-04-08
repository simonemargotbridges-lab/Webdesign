// writeEmail.js
// ---------------------------------------------------------------
// Uses Claude to draft a friendly, personalized cold email for one
// prospect. Returns { subject, body, bodyHtml } so the sender can
// ship it via Gmail.
//
// Usage as a library:
//   import { writeEmailFor } from "./writeEmail.js";
//   const draft = await writeEmailFor(prospect);
//
// Usage from CLI (drafts for every prospect in data/prospects.json):
//   node src/writeEmail.js
// ---------------------------------------------------------------

import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config, dataDir } from "./config.js";

const MODEL = "claude-opus-4-6";

function buildSignature() {
  const { me, venmo } = config;
  const lines = [
    `— ${me.name}`,
    me.business,
  ];
  if (me.portfolio) lines.push(`Portfolio: ${me.portfolio}`);
  if (me.replyEmail) lines.push(`Email: ${me.replyEmail}`);
  if (me.phone) lines.push(`Phone: ${me.phone}`);
  if (venmo.link) lines.push(`Venmo (to pay a deposit or tip): ${venmo.link}`);
  return lines.join("\n");
}

function buildSystemPrompt() {
  const { me } = config;
  return `You are a helpful copywriter drafting cold outreach emails on behalf of ${me.name}, a young web designer who runs ${me.business}. She builds affordable, mobile-friendly websites for small local businesses.

Rules for every email you write:
1. Be warm, short, and human — NOT salesy. Max 120 words in the body.
2. Lead with a specific, genuine observation about the business (use the name, category, and location you are given).
3. Mention clearly that you noticed they don't appear to have a website yet.
4. Offer one concrete value: a free mockup / starter site preview — no obligation.
5. Include a single, low-pressure call to action ("reply with 'yes' and I'll send a preview").
6. Never invent facts about the business. If you don't know something, don't claim it.
7. No emojis. No exclamation-point spam. No "Dear Sir/Madam".
8. End with the provided signature EXACTLY as given — do not rewrite it.
9. Return ONLY valid JSON in this exact shape:
   {"subject": "...", "body": "..."}
   where "body" is plain text with \\n line breaks. Do NOT wrap in markdown.`;
}

function buildUserPrompt(prospect) {
  return `Draft an outreach email for this prospect:

Name: ${prospect.name}
Category: ${prospect.category}
Address: ${prospect.address}
Phone: ${prospect.phone || "(not listed)"}
Has website: no

Signature to append verbatim at the end of the body (after a blank line):
---
${buildSignature()}
---`;
}

// Convert plain-text body to a simple HTML version (preserves newlines,
// turns URLs into links) for the HTML part of the email.
function textToHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap;">${linked}</div>`;
}

export async function writeEmailFor(prospect) {
  const client = new Anthropic({ apiKey: config.anthropicKey() });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(prospect) }],
  });

  const raw = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Claude is asked for strict JSON, but strip code fences just in case.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Claude did not return valid JSON for ${prospect.name}:\n${raw}`
    );
  }

  if (!parsed.subject || !parsed.body) {
    throw new Error(`Draft missing subject or body: ${raw}`);
  }

  return {
    prospect,
    subject: parsed.subject,
    body: parsed.body,
    bodyHtml: textToHtml(parsed.body),
  };
}

// CLI: draft emails for everything in data/prospects.json and save to
// data/drafts.json for the sender to pick up.
async function main() {
  const prospectsPath = path.join(dataDir, "prospects.json");
  const prospects = JSON.parse(await fs.readFile(prospectsPath, "utf8"));

  const drafts = [];
  for (const p of prospects.slice(0, config.maxEmailsPerRun)) {
    process.stdout.write(`Drafting for ${p.name}... `);
    try {
      const draft = await writeEmailFor(p);
      drafts.push(draft);
      console.log("ok");
    } catch (err) {
      console.log(`FAILED (${err.message})`);
    }
  }

  const outPath = path.join(dataDir, "drafts.json");
  await fs.writeFile(outPath, JSON.stringify(drafts, null, 2));
  console.log(`\nSaved ${drafts.length} drafts → ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
