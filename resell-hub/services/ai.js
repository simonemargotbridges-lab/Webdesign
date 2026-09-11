const CONDITION_MULTIPLIER = {
  "new-with-tags": 1.0,
  "like-new": 0.8,
  "good": 0.6,
  "fair": 0.4,
  "worn": 0.25,
};

const CATEGORY_BASE_PRICE = {
  tops: 18,
  dresses: 28,
  outerwear: 45,
  denim: 32,
  shoes: 35,
  bags: 40,
  accessories: 15,
  activewear: 22,
  other: 20,
};

// A rough "in-demand brand" bump. Not exhaustive — just nudges the estimate up
// when the seller names a brand resale shoppers actively search for.
const HYPE_BRANDS = [
  "nike", "adidas", "zara", "arcteryx", "north face", "the north face", "levi",
  "coach", "carhartt", "stussy", "supreme", "lululemon", "patagonia", "doc martens",
  "dr martens", "ugg", "new balance", "vintage", "brandy melville", "reformation",
];

const TRENDY_OPENERS = [
  "Certified closet gem alert",
  "Okay this one's a vibe",
  "New to my closet, straight to yours",
  "Rare find incoming",
  "Been sitting on this one and it's time to let go",
  "Grabbed too fast, gotta re-home this",
];

const TRENDY_CLOSERS = [
  "Won't last — bundle for a discount!",
  "DM or comment before it's gone.",
  "Smoke-free, pet-free home.",
  "Ships fast, packaged with care.",
  "Open to reasonable offers!",
  "Tag a friend who needs this.",
];

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function estimatePrice({ category, condition, brand }) {
  const base = CATEGORY_BASE_PRICE[category] || CATEGORY_BASE_PRICE.other;
  const mult = CONDITION_MULTIPLIER[condition] ?? 0.6;
  let estimate = base * mult;

  const brandLower = (brand || "").toLowerCase();
  if (HYPE_BRANDS.some((b) => brandLower.includes(b))) {
    estimate *= 1.6;
  }

  const list = Math.max(5, Math.round(estimate));
  const low = Math.max(4, Math.round(list * 0.8));
  const high = Math.round(list * 1.25);
  return { list, low, high };
}

function fallbackDescription({ title, category, condition, brand, size, notes }) {
  const seed = hashSeed(title || category || "item");
  const opener = pick(TRENDY_OPENERS, seed);
  const closer = pick(TRENDY_CLOSERS, seed >> 3);

  const conditionText = {
    "new-with-tags": "brand new with tags, never worn",
    "like-new": "like-new condition, barely worn",
    "good": "good pre-loved condition with light signs of wear",
    "fair": "fair condition — some visible wear, priced accordingly",
    "worn": "well-worn, loved and priced to reflect it",
  }[condition] || "great pre-loved condition";

  const bits = [];
  bits.push(`${opener}: ${title}${brand ? ` by ${brand}` : ""}.`);
  bits.push(`${conditionText}${size ? `, size ${size}` : ""}.`);
  if (notes) bits.push(notes.trim());
  bits.push(closer);

  const hashtags = [
    "#thrifted", "#secondhand", "#preloved", "#sustainablefashion",
    category ? `#${category.replace(/[^a-z0-9]/gi, "")}` : null,
    brand ? `#${brand.toLowerCase().replace(/[^a-z0-9]/gi, "")}` : null,
  ].filter(Boolean);

  return { description: bits.join(" "), hashtags };
}

async function claudeDescription(input) {
  const { Anthropic } = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const prompt = `You write short, trendy resale listing copy for apps like Depop, Vinted, and Poshmark.
Write a punchy 2-4 sentence description (casual, marketing tone, a couple of relevant emoji is fine, no false claims) and 5-8 lowercase hashtags for this item.

Title: ${input.title}
Category: ${input.category}
Condition: ${input.condition}
Brand: ${input.brand || "unbranded"}
Size: ${input.size || "n/a"}
Seller notes: ${input.notes || "none"}

Respond ONLY as JSON: {"description": "...", "hashtags": ["#...", ...]}`;

  const msg = await client.messages.create({
    model,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response");
  const parsed = JSON.parse(jsonMatch[0]);
  return { description: parsed.description, hashtags: parsed.hashtags || [] };
}

async function generateListingCopy(input) {
  const price = estimatePrice(input);
  let copy;
  let source = "template";

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      copy = await claudeDescription(input);
      source = "claude";
    } catch (err) {
      console.warn("AI description generation failed, using fallback template:", err.message);
    }
  }

  if (!copy) {
    copy = fallbackDescription(input);
  }

  return {
    description: copy.description,
    hashtags: copy.hashtags,
    price,
    source,
  };
}

module.exports = { generateListingCopy, estimatePrice };
