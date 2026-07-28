async function getCaptured() {
  const { captured = [] } = await chrome.storage.local.get("captured");
  return captured;
}

function payload(people) {
  return JSON.stringify(
    { hearth: "linkedin-capture", v: 1, exportedAt: new Date().toISOString(), people },
    null, 2
  );
}

function initials(name) {
  const p = String(name).trim().split(/\s+/);
  return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

async function render() {
  const list = document.getElementById("list");
  const people = await getCaptured();
  list.innerHTML = "";
  if (!people.length) {
    list.innerHTML = '<div class="empty">Nothing captured yet.<br/>Open a LinkedIn profile and click "Save to Hearth".</div>';
    return;
  }
  for (const p of people) {
    const row = document.createElement("div");
    row.className = "row";
    const av = p.photo
      ? Object.assign(document.createElement("img"), { src: p.photo, alt: "" })
      : Object.assign(document.createElement("div"), { className: "ph", textContent: initials(p.name) });
    const who = document.createElement("div");
    who.className = "who";
    const b = document.createElement("b"); b.textContent = p.name;
    const s = document.createElement("span"); s.textContent = p.headline || p.company || p.linkedin;
    who.append(b, s);
    const rm = Object.assign(document.createElement("button"), { className: "rm", textContent: "✕", title: "Remove" });
    rm.addEventListener("click", async () => {
      const cur = await getCaptured();
      await chrome.storage.local.set({ captured: cur.filter((x) => x.linkedin !== p.linkedin) });
      render();
    });
    row.append(av, who, rm);
    list.appendChild(row);
  }
}

const status = (t) => { document.getElementById("status").textContent = t; setTimeout(() => { document.getElementById("status").textContent = ""; }, 2200); };

document.getElementById("copy").addEventListener("click", async () => {
  const people = await getCaptured();
  if (!people.length) return status("Nothing to copy");
  await navigator.clipboard.writeText(payload(people));
  status("Copied — paste it into Hearth");
});

document.getElementById("download").addEventListener("click", async () => {
  const people = await getCaptured();
  if (!people.length) return status("Nothing to download");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([payload(people)], { type: "application/json" }));
  a.download = "hearth-linkedin-capture.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ captured: [] });
  render();
});

render();
