const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

function load() {
  if (!fs.existsSync(DB_PATH)) {
    return { listings: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { listings: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function all() {
  return load().listings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function get(id) {
  return load().listings.find((l) => l.id === id);
}

function insert(listing) {
  const data = load();
  data.listings.push(listing);
  save(data);
  return listing;
}

function update(id, patch) {
  const data = load();
  const idx = data.listings.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  data.listings[idx] = { ...data.listings[idx], ...patch, updatedAt: new Date().toISOString() };
  save(data);
  return data.listings[idx];
}

function remove(id) {
  const data = load();
  const before = data.listings.length;
  data.listings = data.listings.filter((l) => l.id !== id);
  save(data);
  return data.listings.length < before;
}

module.exports = { all, get, insert, update, remove };
