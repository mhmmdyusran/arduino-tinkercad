// Penyimpanan tutorial berbasis file JSON (tanpa database).
const fs = require("fs");
const path = require("path");

const SEED = path.join(__dirname, "tutorials.json");
const FILE = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : SEED;

function load() {
  for (const f of [FILE, SEED]) {
    try { return JSON.parse(fs.readFileSync(f, "utf8")); }
    catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  return [];
}

let items = load();

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, FILE); // tulis atomik agar file tidak rusak
}

module.exports = {
  all: () => items,
  find: (id) => items.find((t) => t.id === id),
  create(t) { items.unshift(t); persist(); }, // tutorial baru tampil paling atas
  update(id, t) { const i = items.findIndex((x) => x.id === id); if (i < 0) return false; items[i] = t; persist(); return true; },
  remove(id) { const n = items.length; items = items.filter((t) => t.id !== id); if (items.length !== n) persist(); return items.length !== n; },
};
