// Menu mobile
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");
if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
}

// Copy code
const copyBtn = document.getElementById("copyBtn");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const text = document.getElementById(copyBtn.dataset.target).innerText;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea"); // cadangan untuk HTTP non-aman
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    const old = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("done");
    setTimeout(() => { copyBtn.textContent = old; copyBtn.classList.remove("done"); }, 1800);
  });
}
