require("dotenv").config();
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const { Server } = require("socket.io");
const store = require("./data/store");

const app = express();
const server = http.createServer(app); // satu server untuk Express + Socket.IO
const io = new Server(server);

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// Gambar base64 disajikan lewat /media/:id supaya halaman tidak berat
app.locals.imgSrc = (t) =>
  String(t.image || "").startsWith("data:") ? `/media/${t.id}?v=${t.updatedAt || 0}` : t.image;
app.use(express.static(path.join(__dirname, "public")));

// ---------- Halaman publik ----------
app.get("/", (req, res) =>
  res.render("index", { page: "home", title: "Beranda", featured: store.all().slice(0, 3) }));

app.get("/tutorials", (req, res) =>
  res.render("tutorials", { page: "tutorials", title: "Daftar Tutorial", tutorials: store.all() }));

app.get("/tutorials/:id", (req, res, next) => {
  const tutorial = store.find(req.params.id);
  if (!tutorial) return next();
  res.render("tutorial-detail", { page: "tutorials", title: tutorial.title, tutorial });
});

app.get("/media/:id", (req, res, next) => {
  const t = store.find(req.params.id);
  const m = t && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(t.image || "");
  if (!m) return next();
  res.set({ "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" });
  res.send(Buffer.from(m[2], "base64"));
});

app.get("/chat", (req, res) => res.render("chat", { page: "chat", title: "Chat" }));

// ---------- Admin (hanya password) ----------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SECRET = process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update(ADMIN_PASSWORD + "|arduino-tinkercad").digest("hex");
const TTL = 7 * 24 * 3600 * 1000;

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const mac = (exp) => crypto.createHmac("sha256", SECRET).update(String(exp)).digest("hex");
const makeToken = () => { const exp = Date.now() + TTL; return `${exp}.${mac(exp)}`; };
const getCookie = (req, name) =>
  (req.headers.cookie || "").split(";").map((s) => s.trim())
    .find((s) => s.startsWith(name + "="))?.slice(name.length + 1);

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const [exp, sig] = (getCookie(req, "admin") || "").split(".");
  return !!exp && !!sig && Number(exp) > Date.now() && safeEqual(sig, mac(exp));
}
const cookie = (req, value, maxAge) =>
  `admin=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${req.secure ? "; Secure" : ""}`;
const loginPage = (res, error, status = 200) =>
  res.status(status).render("admin-login", { page: "", title: "Admin", error });

app.get("/admin", (req, res) => {
  if (!ADMIN_PASSWORD) return loginPage(res, "ADMIN_PASSWORD belum diisi di file .env.", 500);
  if (!isAdmin(req)) return loginPage(res, "");
  res.render("admin", { page: "", title: "Admin", tutorials: store.all() });
});

const attempts = new Map();
app.post("/admin/login", express.urlencoded({ extended: false }), (req, res) => {
  const a = attempts.get(req.ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return loginPage(res, "Terlalu banyak percobaan. Tunggu 1 menit.", 429);
  if (ADMIN_PASSWORD && safeEqual(req.body.password || "", ADMIN_PASSWORD)) {
    attempts.delete(req.ip);
    res.setHeader("Set-Cookie", cookie(req, makeToken(), TTL / 1000));
    return res.redirect("/admin");
  }
  if (++a.n >= 5) { a.until = Date.now() + 60000; a.n = 0; }
  attempts.set(req.ip, a);
  loginPage(res, "Password salah.", 401);
});

app.post("/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", cookie(req, "", 0));
  res.redirect("/admin");
});

// API admin
const str = (v, max) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validate(b, id) {
  const title = str(b.title, 100);
  const description = str(b.description, 1000);
  const code = str(b.code, 20000);
  const image = str(b.image, 6 * 1024 * 1024);
  if (!title) return { error: "Judul wajib diisi." };
  if (!slugOk.test(id) || id.length > 80) return { error: "ID hanya boleh huruf kecil, angka, dan tanda minus." };
  if (!description) return { error: "Deskripsi wajib diisi." };
  if (!code) return { error: "Kode Arduino wajib diisi." };
  const okImage = /^https?:\/\/\S+$/.test(image) || /^\/(?!\/)[^\s]*$/.test(image) ||
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image);
  if (!okImage || image.length > 4 * 1024 * 1024) return { error: "Gambar wajib diisi (URL, path, atau upload, maks ±3 MB)." };
  const components = (Array.isArray(b.components) ? b.components : []).map((c) => str(c, 150)).filter(Boolean).slice(0, 30);
  if (!components.length) return { error: "Isi minimal satu komponen." };
  const connections = (Array.isArray(b.connections) ? b.connections : [])
    .map((c) => ({ from: str(c && c.from, 150), to: str(c && c.to, 250) }))
    .filter((c) => c.from && c.to).slice(0, 40);
  return {
    value: {
      id, title, description,
      short: str(b.short, 160) || description.slice(0, 110),
      image, imageAlt: `Gambar rangkaian ${title}`,
      components, connectionsIntro: str(b.connectionsIntro, 300), connections, code,
      updatedAt: Date.now(),
    },
  };
}

const api = express.Router();
api.use(express.json({ limit: "8mb" }));
api.use((req, res, next) =>
  isAdmin(req) ? next() : res.status(401).json({ error: "Sesi habis. Muat ulang halaman lalu login lagi." }));

api.get("/tutorials/:id", (req, res) => {
  const t = store.find(req.params.id);
  t ? res.json(t) : res.status(404).json({ error: "Tutorial tidak ditemukan." });
});
api.post("/tutorials", (req, res) => {
  const { value, error } = validate(req.body, str(req.body.id, 80));
  if (error) return res.status(400).json({ error });
  if (store.find(value.id)) return res.status(409).json({ error: "ID sudah dipakai tutorial lain." });
  store.create(value);
  res.json({ ok: true, id: value.id });
});
api.put("/tutorials/:id", (req, res) => {
  const { value, error } = validate(req.body, req.params.id);
  if (error) return res.status(400).json({ error });
  store.update(req.params.id, value)
    ? res.json({ ok: true, id: value.id })
    : res.status(404).json({ error: "Tutorial tidak ditemukan." });
});
api.delete("/tutorials/:id", (req, res) =>
  store.remove(req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: "Tutorial tidak ditemukan." }));
api.use((err, req, res, next) =>
  res.status(err.status || 400).json({ error: err.type === "entity.too.large" ? "Gambar terlalu besar." : "Data tidak valid." }));
app.use("/admin/api", api);

app.use((req, res) => res.status(404).render("404", { page: "", title: "Tidak ditemukan" }));

// ---------- Chat realtime ----------
const GRACE_MS = 5000; // jeda sebelum user dianggap keluar (agar pindah halaman tidak dianggap keluar)
const users = new Map(); // clientId -> { name, sockets:Set, timer }
const history = []; // 100 pesan terakhir, hanya di memori

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
const onlineList = () => [...users.values()].map((u) => u.name);
const nameTaken = (name, cid) =>
  [...users.entries()].some(([id, u]) => id !== cid && u.name.toLowerCase() === name.toLowerCase());

function pushHistory(entry) {
  history.push(entry);
  if (history.length > 100) history.shift();
}
function announce(text) {
  const entry = { type: "system", text, time: Date.now() };
  pushHistory(entry);
  io.emit("system", entry);
}
function removeUser(cid) {
  const u = users.get(cid);
  if (!u) return;
  clearTimeout(u.timer);
  users.delete(cid);
  io.emit("users", onlineList());
  announce(`${u.name} keluar`);
}

io.on("connection", (socket) => {
  socket.on("join", (data, ack) => {
    if (typeof ack !== "function") return;
    const name = clean(data && data.name, 20);
    const cid = String((data && data.clientId) || "");
    if (!/^[\w-]{8,64}$/.test(cid)) return ack({ ok: false, error: "Sesi tidak valid. Muat ulang halaman." });
    if (!name) return ack({ ok: false, error: "Username tidak boleh kosong." });

    let u = users.get(cid);
    if (u) {
      clearTimeout(u.timer); // user yang sama kembali (pindah halaman / refresh)
      u.timer = null;
    } else {
      if (nameTaken(name, cid)) return ack({ ok: false, error: "Username sedang dipakai orang lain. Coba nama lain." });
      u = { name, sockets: new Set(), timer: null };
      users.set(cid, u);
      announce(`${name} bergabung`);
    }
    u.sockets.add(socket.id);
    socket.data.cid = cid;
    ack({ ok: true, username: u.name, history });
    io.emit("users", onlineList());
  });

  socket.on("message", (raw) => {
    const u = users.get(socket.data.cid);
    const text = String(raw || "").trim().slice(0, 500);
    if (!u || !text) return;
    const entry = { type: "message", username: u.name, text, time: Date.now() };
    pushHistory(entry);
    io.emit("message", entry);
  });

  // Tombol "Keluar": langsung dihapus dari daftar online
  socket.on("leave", () => {
    const cid = socket.data.cid;
    socket.data.cid = null;
    if (cid) removeUser(cid);
  });

  // Tutup tab / pindah halaman: dihapus setelah jeda singkat jika tidak kembali
  socket.on("disconnect", () => {
    const cid = socket.data.cid;
    const u = cid && users.get(cid);
    if (!u) return;
    u.sockets.delete(socket.id);
    if (u.sockets.size === 0) u.timer = setTimeout(() => removeUser(cid), GRACE_MS);
  });

  socket.emit("users", onlineList());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
