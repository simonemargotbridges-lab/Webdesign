const state = {
  files: [],
  marketplaces: [],
  currentListing: null,
};

const el = (sel) => document.querySelector(sel);

const dropzone = el("#dropzone");
const fileInput = el("#images");
const previewStrip = el("#preview-strip");
const form = el("#listing-form");
const generatedPanel = el("#generated-panel");

// ---------- Photo picker ----------

dropzone.addEventListener("click", () => fileInput.click());
["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", (e) => addFiles(e.target.files));

function addFiles(fileList) {
  state.files.push(...Array.from(fileList));
  renderPreviews();
}

function renderPreviews() {
  previewStrip.innerHTML = "";
  state.files.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    previewStrip.appendChild(img);
  });
}

// ---------- Marketplace list ----------

async function loadMarketplaces() {
  const res = await fetch("/api/marketplaces");
  state.marketplaces = await res.json();
}

function renderMarketplacePicker() {
  const container = el("#marketplace-picker");
  container.innerHTML = state.marketplaces
    .map(
      (mp) => `
      <label>
        <input type="checkbox" name="mp" value="${mp.id}" checked />
        ${mp.name}
        <span class="mp-badge status-${mp.mode === "live" ? "listed" : mp.mode === "manual" ? "not_listed" : "ready_to_post"}">${mp.mode}</span>
      </label>`
    )
    .join("");
}

// ---------- Create listing / generate copy ----------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.files.length === 0) {
    alert("Add at least one photo first.");
    return;
  }

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Generating...";

  const fd = new FormData(form);
  state.files.forEach((file) => fd.append("images", file));

  try {
    const res = await fetch("/api/listings", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create listing");
    const listing = await res.json();
    state.currentListing = listing;
    showGenerated(listing);
    await loadListings();
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "✨ Generate listing";
  }
});

function showGenerated(listing) {
  generatedPanel.hidden = false;
  el("#ai-source").textContent =
    listing.aiSource === "claude" ? "✨ Written by Claude" : "✨ Auto-generated (add an ANTHROPIC_API_KEY for AI-written copy)";
  el("#gen-description").value = listing.description;
  el("#gen-hashtags").innerHTML = listing.hashtags.map((h) => `<span>${h}</span>`).join("");
  el("#gen-price-list").value = listing.price.list;
  el("#gen-price-low").textContent = listing.price.low;
  el("#gen-price-high").textContent = listing.price.high;
  renderMarketplacePicker();
  generatedPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

el("#save-edits-btn").addEventListener("click", async () => {
  if (!state.currentListing) return;
  const patch = {
    description: el("#gen-description").value,
    price: { list: Number(el("#gen-price-list").value) },
  };
  const res = await fetch(`/api/listings/${state.currentListing.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  state.currentListing = await res.json();
  await loadListings();
});

el("#publish-btn").addEventListener("click", async () => {
  if (!state.currentListing) return;
  const marketplaceIds = Array.from(document.querySelectorAll('input[name="mp"]:checked')).map(
    (i) => i.value
  );
  if (marketplaceIds.length === 0) {
    alert("Pick at least one marketplace.");
    return;
  }

  const btn = el("#publish-btn");
  btn.disabled = true;
  btn.textContent = "Publishing...";

  try {
    const res = await fetch(`/api/listings/${state.currentListing.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplaceIds }),
    });
    state.currentListing = await res.json();
    await loadListings();
    resetForm();
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Publish to selected";
  }
});

function resetForm() {
  form.reset();
  state.files = [];
  renderPreviews();
  generatedPanel.hidden = true;
  state.currentListing = null;
}

// ---------- Listings dashboard ----------

const STATUS_LABEL = {
  not_listed: "Not listed",
  ready_to_post: "Ready to post",
  listed: "Listed",
  unlisted: "Unlisted",
  sold: "Sold",
  needs_manual_removal: "Remove me!",
  error: "Error",
};

async function loadListings() {
  const res = await fetch("/api/listings");
  const listings = await res.json();
  renderListings(listings);
}

function renderListings(listings) {
  const grid = el("#listings-grid");
  grid.innerHTML = "";

  if (listings.length === 0) {
    grid.innerHTML = '<p class="empty-state">No listings yet — create one above.</p>';
    return;
  }

  const tpl = el("#listing-card-template");

  listings.forEach((listing) => {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector(".listing-card");
    card.dataset.id = listing.id;

    node.querySelector(".card-image img").src = `/uploads/${listing.images[0]}`;

    const overall = node.querySelector(".overall-status");
    overall.textContent = listing.status;
    overall.classList.add(`status-${listing.status}`);

    node.querySelector(".card-title").textContent = listing.title;
    node.querySelector(".card-price").textContent = `$${listing.price.list}`;

    const mpContainer = node.querySelector(".card-marketplaces");
    Object.entries(listing.marketplaces).forEach(([mpId, mpState]) => {
      const mpMeta = state.marketplaces.find((m) => m.id === mpId);
      const badge = document.createElement("span");
      badge.className = `mp-badge status-${mpState.status}`;
      badge.title = mpState.note || "";
      badge.textContent = `${mpMeta ? mpMeta.name : mpId}: ${STATUS_LABEL[mpState.status] || mpState.status}`;

      if (mpState.status === "ready_to_post") {
        badge.appendChild(actionButton("Mark posted", () => confirmPosted(listing.id, mpId)));
      }
      if (mpState.status === "needs_manual_removal") {
        badge.appendChild(actionButton("Mark removed", () => confirmRemoved(listing.id, mpId)));
      }
      mpContainer.appendChild(badge);
    });

    const soldBtn = node.querySelector(".sold-btn");
    if (listing.status === "sold") {
      soldBtn.disabled = true;
      soldBtn.textContent = "Sold ✓";
    } else {
      soldBtn.addEventListener("click", () => markSold(listing));
    }

    node.querySelector(".delete-btn").addEventListener("click", () => deleteListing(listing.id));

    grid.appendChild(node);
  });
}

function actionButton(label, onClick) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

async function confirmPosted(listingId, mpId) {
  await fetch(`/api/listings/${listingId}/marketplaces/${mpId}/confirm-posted`, { method: "POST" });
  await loadListings();
}

async function confirmRemoved(listingId, mpId) {
  await fetch(`/api/listings/${listingId}/marketplaces/${mpId}/confirm-removed`, { method: "POST" });
  await loadListings();
}

async function markSold(listing) {
  const liveMarketplaces = Object.entries(listing.marketplaces)
    .filter(([, s]) => ["listed", "ready_to_post"].includes(s.status))
    .map(([id]) => id);

  const options = liveMarketplaces
    .map((id) => state.marketplaces.find((m) => m.id === id)?.name || id)
    .concat("Other / in person");

  const choice = prompt(
    `Sold it! Where did it sell?\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nEnter a number:`
  );
  const idx = Number(choice) - 1;
  const soldOn = idx >= 0 && idx < liveMarketplaces.length ? liveMarketplaces[idx] : null;

  await fetch(`/api/listings/${listing.id}/sold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soldOn }),
  });
  await loadListings();
}

async function deleteListing(id) {
  if (!confirm("Delete this listing for good?")) return;
  await fetch(`/api/listings/${id}`, { method: "DELETE" });
  await loadListings();
}

// ---------- Boot ----------

(async function init() {
  await loadMarketplaces();
  await loadListings();
})();
