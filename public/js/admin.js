const $ = (id) => document.getElementById(id);
const f = {
  title: $("fTitle"), id: $("fId"), short: $("fShort"), desc: $("fDesc"), url: $("fImageUrl"),
  file: $("fFile"), comps: $("fComponents"), intro: $("fIntro"), conn: $("fConn"), code: $("fCode"),
};
let editingId = null;
let image = ""; // URL / path / data:image base64
let idTouched = false;

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const msg = (t, ok) => { const m = $("formMsg"); m.textContent = t; m.style.color = ok ? "#1f7a45" : ""; };

function setImage(value, info) {
  image = value;
  const p = $("imgPreview");
  p.hidden = !value;
  if (value) p.src = value;
  $("imgInfo").textContent = info || "";
}

function resetForm() {
  editingId = null; idTouched = false;
  $("tForm").reset();
  setImage("");
  f.id.disabled = false;
  $("formTitle").textContent = "Tutorial baru";
  $("saveBtn").textContent = "Simpan tutorial";
  $("cancelBtn").hidden = true;
  msg("");
}

// Kompres: maks lebar 1200px, JPEG kualitas 0.8, lalu jadi base64
function compress(file, maxW = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("File gambar tidak bisa dibaca.")); };
    img.src = url;
  });
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
  return data;
}

f.title.addEventListener("input", () => { if (!editingId && !idTouched) f.id.value = slug(f.title.value); });
f.id.addEventListener("input", () => { idTouched = true; });

f.url.addEventListener("input", () => { f.file.value = ""; setImage(f.url.value.trim()); });
f.file.addEventListener("change", async () => {
  const file = f.file.files[0];
  if (!file) return;
  try {
    const data = await compress(file);
    f.url.value = "";
    setImage(data, `Hasil kompres: ±${Math.round((data.length * 0.75) / 1024)} KB (asli ${Math.round(file.size / 1024)} KB)`);
    msg("");
  } catch (e) { msg(e.message); }
});

$("tForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const payload = {
    id: f.id.value.trim(), title: f.title.value, short: f.short.value, description: f.desc.value,
    image, components: lines(f.comps.value), connectionsIntro: f.intro.value, code: f.code.value,
    connections: lines(f.conn.value).map((l) => {
      const i = l.indexOf("|");
      return i < 0 ? { from: l, to: "" } : { from: l.slice(0, i).trim(), to: l.slice(i + 1).trim() };
    }),
  };
  if (payload.connections.some((c) => !c.to)) return msg('Format sambungan harus "dari | ke" di setiap baris.');
  $("saveBtn").disabled = true;
  try {
    editingId
      ? await api("PUT", `/admin/api/tutorials/${encodeURIComponent(editingId)}`, payload)
      : await api("POST", "/admin/api/tutorials", payload);
    msg("Tersimpan!", true);
    setTimeout(() => location.reload(), 600);
  } catch (err) { msg(err.message); }
  $("saveBtn").disabled = false;
});

document.addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  try {
    if (edit) {
      const t = await api("GET", `/admin/api/tutorials/${encodeURIComponent(edit.dataset.edit)}`);
      resetForm();
      editingId = t.id;
      f.title.value = t.title; f.id.value = t.id; f.id.disabled = true;
      f.short.value = t.short || ""; f.desc.value = t.description;
      f.comps.value = t.components.join("\n"); f.intro.value = t.connectionsIntro || "";
      f.conn.value = t.connections.map((c) => `${c.from} | ${c.to}`).join("\n"); f.code.value = t.code;
      if (!t.image.startsWith("data:")) f.url.value = t.image;
      setImage(t.image, t.image.startsWith("data:") ? "Gambar tersimpan. Pilih file baru untuk menggantinya." : "");
      $("formTitle").textContent = `Edit: ${t.title}`;
      $("saveBtn").textContent = "Simpan perubahan";
      $("cancelBtn").hidden = false;
      $("tForm").scrollIntoView({ behavior: "smooth" });
    } else if (del && confirm(`Hapus tutorial "${del.dataset.title}"? Tindakan ini tidak bisa dibatalkan.`)) {
      await api("DELETE", `/admin/api/tutorials/${encodeURIComponent(del.dataset.delete)}`);
      location.reload();
    }
  } catch (err) { msg(err.message); }
});
$("newBtn").addEventListener("click", () => { resetForm(); f.title.focus(); });
$("cancelBtn").addEventListener("click", resetForm);
