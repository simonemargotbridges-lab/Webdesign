const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

const db = require("../db");
const { generateListingCopy } = require("../services/ai");
const { CONNECTORS, publishTo, unpublishFrom } = require("../services/connectors");

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "uploads"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

function freshMarketplaceState() {
  const state = {};
  for (const id of Object.keys(CONNECTORS)) {
    state[id] = { status: "not_listed" };
  }
  return state;
}

router.get("/", (req, res) => {
  res.json(db.all());
});

router.get("/:id", (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });
  res.json(listing);
});

router.post("/", upload.array("images", 10), async (req, res) => {
  const { title, category, condition, brand, size, notes } = req.body;
  if (!title || !category || !condition) {
    return res.status(400).json({ error: "title, category, and condition are required" });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "At least one image is required" });
  }

  const input = { title, category, condition, brand, size, notes };
  const generated = await generateListingCopy(input);

  const listing = {
    id: crypto.randomUUID(),
    ...input,
    images: req.files.map((f) => f.filename),
    description: generated.description,
    hashtags: generated.hashtags,
    price: generated.price,
    aiSource: generated.source,
    status: "draft",
    soldOn: null,
    marketplaces: freshMarketplaceState(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.insert(listing);
  res.status(201).json(listing);
});

router.post("/:id/regenerate", async (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });

  const generated = await generateListingCopy(listing);
  const updated = db.update(listing.id, {
    description: generated.description,
    hashtags: generated.hashtags,
    price: generated.price,
    aiSource: generated.source,
  });
  res.json(updated);
});

router.patch("/:id", (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });

  const editable = ["title", "description", "hashtags", "notes", "brand", "size"];
  const patch = {};
  for (const key of editable) {
    if (key in req.body) patch[key] = req.body[key];
  }
  if (req.body.price) {
    patch.price = { ...listing.price, ...req.body.price };
  }

  res.json(db.update(listing.id, patch));
});

router.post("/:id/publish", async (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });

  const marketplaceIds = req.body.marketplaceIds || Object.keys(CONNECTORS);
  const results = await publishTo(listing, marketplaceIds);

  const marketplaces = { ...listing.marketplaces };
  for (const [id, result] of Object.entries(results)) {
    marketplaces[id] = { ...marketplaces[id], ...result };
  }

  const anyLive = Object.values(marketplaces).some((m) =>
    ["listed", "ready_to_post"].includes(m.status)
  );

  const updated = db.update(listing.id, {
    marketplaces,
    status: anyLive ? "listed" : listing.status,
  });
  res.json(updated);
});

router.post("/:id/marketplaces/:mpId/confirm-posted", (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });
  const mpId = req.params.mpId;
  if (!listing.marketplaces[mpId]) return res.status(400).json({ error: "Unknown marketplace" });

  const marketplaces = {
    ...listing.marketplaces,
    [mpId]: { ...listing.marketplaces[mpId], status: "listed", note: undefined },
  };
  res.json(db.update(listing.id, { marketplaces, status: "listed" }));
});

router.post("/:id/marketplaces/:mpId/confirm-removed", (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });
  const mpId = req.params.mpId;
  if (!listing.marketplaces[mpId]) return res.status(400).json({ error: "Unknown marketplace" });

  const marketplaces = {
    ...listing.marketplaces,
    [mpId]: { ...listing.marketplaces[mpId], status: "unlisted", note: undefined },
  };
  res.json(db.update(listing.id, { marketplaces }));
});

// The core "keep track of what's sold" feature: mark sold on one marketplace
// (or manually) and every other marketplace this was cross-listed on gets
// unpublished automatically — for real on eBay, and flagged for manual
// removal on the platforms with no listing API.
router.post("/:id/sold", async (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });

  const soldOn = req.body.soldOn || null;
  const marketplaces = { ...listing.marketplaces };
  if (soldOn && marketplaces[soldOn]) {
    marketplaces[soldOn] = { ...marketplaces[soldOn], status: "sold" };
  }

  const toUnpublish = Object.fromEntries(
    Object.entries(marketplaces).filter(([id]) => id !== soldOn)
  );
  const results = await unpublishFrom(listing, toUnpublish);
  for (const [id, result] of Object.entries(results)) {
    marketplaces[id] = { ...marketplaces[id], ...result };
  }

  const updated = db.update(listing.id, {
    status: "sold",
    soldOn,
    soldAt: new Date().toISOString(),
    marketplaces,
  });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const listing = db.get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Not found" });

  for (const filename of listing.images) {
    const filePath = path.join(__dirname, "..", "uploads", filename);
    fs.unlink(filePath, () => {});
  }
  db.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
