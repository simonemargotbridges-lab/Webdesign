// Loads environment variables from .env and exposes them as a typed config object.
// Every other file should import from here instead of reading process.env directly.

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..");
export const dataDir = path.join(projectRoot, "data");
export const sitesDir = path.join(projectRoot, "generated-sites");

function required(name) {
  const v = process.env[name];
  if (!v || v.startsWith("sk-ant-xxxx") || v.startsWith("AIzaxxxx")) {
    throw new Error(
      `Missing required env var: ${name}. Copy agents/.env.example to agents/.env and fill it in.`
    );
  }
  return v;
}

function optional(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export const config = {
  anthropicKey: () => required("ANTHROPIC_API_KEY"),
  googlePlacesKey: () => required("GOOGLE_PLACES_API_KEY"),

  searchLocation: optional("SEARCH_LOCATION", "Wellesley, MA"),
  searchRadiusMeters: Number(optional("SEARCH_RADIUS_METERS", "5000")),
  searchKeywords: optional(
    "SEARCH_KEYWORDS",
    "nail salon,bakery,plumber,barber,hair salon"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  gmail: {
    user: () => required("GMAIL_USER"),
    pass: () => required("GMAIL_APP_PASSWORD"),
  },

  me: {
    name: optional("YOUR_NAME", "Simone Bridges"),
    business: optional("YOUR_BUSINESS", "Simone Bridges Web Design"),
    replyEmail: optional("YOUR_REPLY_EMAIL", ""),
    phone: optional("YOUR_PHONE", ""),
    portfolio: optional("YOUR_PORTFOLIO_URL", ""),
    mailingAddress: optional("YOUR_MAILING_ADDRESS", ""),
  },

  venmo: {
    username: optional("VENMO_USERNAME", ""),
    link: optional("VENMO_LINK", ""),
  },

  dryRun: optional("DRY_RUN", "true").toLowerCase() !== "false",
  maxEmailsPerRun: Number(optional("MAX_EMAILS_PER_RUN", "5")),
};
