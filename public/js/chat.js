const socket = io();
const $ = (id) => document.getElementById(id);
const joinBox = $("joinBox"), chatBox = $("chatBox");
const input = $("usernameInput"), err = $("joinError");
const messages = $("messages");

// Identitas tab ini disimpan di sessionStorage, jadi bertahan saat pindah halaman
let clientId = sessionStorage.getItem("chat-client-id");
if (!clientId) {
  clientId = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem("chat-client-id", clientId);
}
let me = sessionStorage.getItem("chat-username");

function show(inChat) {
  chatBox.hidden = !inChat;
  joinBox.hidden = inChat;
}
if (me) { $("meName").textContent = me; show(true); } else { show(false); }

const fmt = (t) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

function append(el) {
  const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
  messages.appendChild(el);
  if (atBottom) messages.scrollTop = messages.scrollHeight;
}
function addMessage({ username, text, time }) {
  const el = document.createElement("div");
  el.className = "msg" + (username === me ? " mine" : "");
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${username} · ${fmt(time)}`;
  const body = document.createElement("div");
  body.className = "text";
  body.textContent = text; // textContent = aman dari HTML injection
  el.append(meta, body);
  append(el);
}
function addSystem({ text, time }) {
  const el = document.createElement("div");
  el.className = "sys";
  el.textContent = `${text} (${fmt(time)})`;
  append(el);
}

function join(name) {
  socket.emit("join", { name, clientId }, (res) => {
    if (!res.ok) {
      me = null;
      sessionStorage.removeItem("chat-username");
      show(false);
      err.textContent = res.error;
      return;
    }
    me = res.username;
    sessionStorage.setItem("chat-username", me);
    $("meName").textContent = me;
    err.textContent = "";
    show(true);
    messages.innerHTML = "";
    res.history.forEach((h) => (h.type === "message" ? addMessage(h) : addSystem(h)));
    messages.scrollTop = messages.scrollHeight;
    $("messageInput").focus();
  });
}

$("joinBtn").addEventListener("click", () => { err.textContent = ""; join(input.value); });
input.addEventListener("keydown", (e) => { if (e.key === "Enter") $("joinBtn").click(); });

$("leaveBtn").addEventListener("click", () => {
  socket.emit("leave");
  me = null;
  sessionStorage.removeItem("chat-username");
  messages.innerHTML = "";
  input.value = "";
  show(false);
  input.focus();
});

$("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const box = $("messageInput");
  const text = box.value.trim();
  if (!text) return;
  socket.emit("message", text);
  box.value = "";
});

socket.on("message", addMessage);
socket.on("system", addSystem);
socket.on("users", (list) => {
  $("userCount").textContent = list.length;
  const ul = $("userList");
  ul.innerHTML = "";
  list.forEach((n) => {
    const li = document.createElement("li");
    li.textContent = n + (n === me ? " (kamu)" : "");
    ul.appendChild(li);
  });
});

// Masuk otomatis (tanpa input nama) saat halaman dibuka lagi atau koneksi tersambung ulang
socket.on("connect", () => { if (me) join(me); });
