// sendEmail.js
// ---------------------------------------------------------------
// Sends drafted emails via Gmail SMTP using a Google App Password.
//
// Safety features:
//   - DRY_RUN=true by default → prints emails instead of sending
//   - Asks for y/N confirmation before EACH real send
//   - Respects MAX_EMAILS_PER_RUN hard cap
//   - Logs every send to data/sent-log.json so you never double-send
//     the same prospect
//
// Prospect emails: the Google Places API rarely returns an email
// address. This script will use `prospect.email` when present,
// otherwise it falls back to sending the draft to yourself so you
// can forward it through the business's contact form by hand.
// ---------------------------------------------------------------

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import nodemailer from "nodemailer";
import { config, dataDir } from "./config.js";

async function loadSentLog() {
  const p = path.join(dataDir, "sent-log.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return [];
  }
}

async function appendSentLog(entry) {
  const p = path.join(dataDir, "sent-log.json");
  const log = await loadSentLog();
  log.push({ ...entry, sentAt: new Date().toISOString() });
  await fs.writeFile(p, JSON.stringify(log, null, 2));
}

function buildTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.gmail.user(),
      pass: config.gmail.pass(),
    },
  });
}

async function confirm(rl, question) {
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

function printDraft(draft) {
  const { prospect, subject, body } = draft;
  const divider = "─".repeat(60);
  console.log(`\n${divider}`);
  console.log(`To:      ${prospect.name} <${prospect.email || "(no email)"}>`);
  console.log(`Addr:    ${prospect.address}`);
  console.log(`Phone:   ${prospect.phone}`);
  console.log(`Subject: ${subject}`);
  console.log(divider);
  console.log(body);
  console.log(`${divider}\n`);
}

export async function sendDrafts(drafts) {
  const transport = config.dryRun ? null : buildTransport();
  const sentLog = await loadSentLog();
  const alreadySent = new Set(sentLog.map((e) => e.placeId));

  const rl = readline.createInterface({ input, output });
  let sent = 0;

  try {
    for (const draft of drafts) {
      if (sent >= config.maxEmailsPerRun) {
        console.log(`Hit MAX_EMAILS_PER_RUN (${config.maxEmailsPerRun}). Stopping.`);
        break;
      }
      if (alreadySent.has(draft.prospect.placeId)) {
        console.log(`Skipping ${draft.prospect.name} (already emailed).`);
        continue;
      }

      printDraft(draft);

      if (config.dryRun) {
        console.log("DRY_RUN=true → not actually sending.");
        continue;
      }

      const go = await confirm(rl, "Send this email?");
      if (!go) {
        console.log("Skipped.");
        continue;
      }

      const to = draft.prospect.email || config.gmail.user();
      const info = await transport.sendMail({
        from: `"${config.me.name}" <${config.gmail.user()}>`,
        to,
        subject: draft.subject,
        text: draft.body,
        html: draft.bodyHtml,
        replyTo: config.me.replyEmail || config.gmail.user(),
      });

      console.log(`  sent → ${to}  (id: ${info.messageId})`);
      await appendSentLog({
        placeId: draft.prospect.placeId,
        name: draft.prospect.name,
        to,
        subject: draft.subject,
      });
      sent++;
    }
  } finally {
    rl.close();
  }

  console.log(`\nDone. Sent ${sent} email(s).`);
}

// CLI: read data/drafts.json and run the send loop.
async function main() {
  const p = path.join(dataDir, "drafts.json");
  const drafts = JSON.parse(await fs.readFile(p, "utf8"));
  if (!drafts.length) {
    console.log("No drafts found. Run `npm run draft` first.");
    return;
  }
  await sendDrafts(drafts);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
