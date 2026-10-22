const STATUTS = {
  "Envoyée": "#2563eb",
  "Relancée": "#d97706",
  "Test technique": "#7c3aed",
  "Entretien": "#7c3aed",
  "Offre reçue": "#16a34a",
  "Acceptée": "#16a34a",
  "Refusée": "#dc2626",
  "Sans réponse": "#6b7280",
};
const CLE_STOCKAGE = "candidatures";
const JOURS_AVANT_RELANCE = 10;

let candidatures = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || "[]");
const $ = (id) => document.getElementById(id);

// ---------- Utilitaires ----------
const sauvegarder = () => localStorage.setItem(CLE_STOCKAGE, JSON.stringify(candidatures));
const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const joursDepuis = (date) => Math.floor((Date.now() - new Date(date)) / 86400000);
const aRelancer = (c) =>
  ["Envoyée", "Relancée"].includes(c.statut) && joursDepuis(c.date) >= JOURS_AVANT_RELANCE;
const echapper = (texte) =>
  String(texte).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// ---------- Affichage ----------
function afficherStats() {
  $("s-total").textContent = candidatures.length;
  $("s-encours").textContent = candidatures.filter(
    (c) => !["Refusée", "Sans réponse", "Acceptée"].includes(c.statut)).length;
  $("s-entretiens").textContent = candidatures.filter(
    (c) => ["Test technique", "Entretien", "Offre reçue", "Acceptée"].includes(c.statut)).length;
  $("s-relance").textContent = candidatures.filter(aRelancer).length;
}

function creerLigne(c) {
  const couleur = STATUTS[c.statut];
  const options = Object.keys(STATUTS)
    .map((s) => `<option ${s === c.statut ? "selected" : ""}>${s}</option>`).join("");
  return `
    <li class="item" data-id="${c.id}">
      <div>
        <h3>
          ${echapper(c.entreprise)}
          <span class="badge" style="color:${couleur};background:${couleur}22">${c.statut}</span>
          <span class="badge" style="background:#8882">${c.type}</span>
          ${aRelancer(c) ? '<span class="badge" style="color:#d97706;background:#f59e0b22">à relancer</span>' : ""}
        </h3>
        <p class="meta">
          ${echapper(c.poste)}${c.source ? " · " + echapper(c.source) : ""} · il y a ${joursDepuis(c.date)} j
          ${c.lien ? ` · <a href="${echapper(c.lien)}" target="_blank" rel="noopener">voir l'offre</a>` : ""}
        </p>
        ${c.notes ? `<p class="meta">${echapper(c.notes)}</p>` : ""}
      </div>
      <div class="actions">
        <select class="changer-statut">${options}</select>
        <button class="supprimer" aria-label="Supprimer">✕</button>
      </div>
    </li>`;
}

function afficher() {
  afficherStats();
  const statut = $("f-statut").value;
  const type = $("f-type").value;
  const recherche = $("recherche").value.toLowerCase();

  const visibles = candidatures
    .filter((c) => (!statut || c.statut === statut) && (!type || c.type === type))
    .filter((c) => c.entreprise.toLowerCase().includes(recherche))
    .sort((a, b) => b.date.localeCompare(a.date));

  $("liste").innerHTML = visibles.length
    ? visibles.map(creerLigne).join("")
    : '<p class="vide">Aucune candidature ici pour l\'instant.</p>';
}

// ---------- Actions ----------
$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  candidatures.push({
    id: nouvelId(),
    entreprise: $("ent").value.trim(),
    poste: $("pos").value.trim(),
    type: $("type").value,
    date: $("date").value || aujourdhui(),
    source: $("src").value.trim(),
    statut: "Envoyée",
    lien: $("lien").value.trim(),
    notes: $("note").value.trim(),
  });
  sauvegarder();
  ["ent", "pos", "src", "lien", "note"].forEach((id) => ($(id).value = ""));
  afficher();
});

$("liste").addEventListener("change", (e) => {
  if (!e.target.classList.contains("changer-statut")) return;
  const id = e.target.closest(".item").dataset.id;
  candidatures.find((c) => c.id === id).statut = e.target.value;
  sauvegarder();
  afficher();
});

$("liste").addEventListener("click", (e) => {
  if (!e.target.classList.contains("supprimer")) return;
  if (!confirm("Supprimer cette candidature ?")) return;
  const id = e.target.closest(".item").dataset.id;
  candidatures = candidatures.filter((c) => c.id !== id);
  sauvegarder();
  afficher();
});

["f-statut", "f-type"].forEach((id) => $(id).addEventListener("change", afficher));
$("recherche").addEventListener("input", afficher);

// ---------- CSV ----------
function exporterCSV() {
  const entetes = ["Entreprise", "Poste", "Type", "Date", "Source", "Statut", "Lien", "Notes"];
  const cellule = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lignes = candidatures.map((c) =>
    [c.entreprise, c.poste, c.type, c.date, c.source, c.statut, c.lien, c.notes].map(cellule).join(";"));
  const csv = "\uFEFF" + [entetes.join(";"), ...lignes].join("\n");
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  lien.download = `candidatures-${aujourdhui()}.csv`;
  lien.click();
}

function parserCSV(texte) {
  texte = texte.replace(/^\uFEFF/, "");
  const separateur = texte.split("\n")[0].includes(";") ? ";" : ",";
  const lignes = [];
  let ligne = [], champ = "", dansGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (dansGuillemets) {
      if (ch === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (ch === '"') dansGuillemets = false;
      else champ += ch;
    } else if (ch === '"') dansGuillemets = true;
    else if (ch === separateur) { ligne.push(champ); champ = ""; }
    else if (ch === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else if (ch !== "\r") champ += ch;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

$("import").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  if (!fichier) return;
  const lignes = parserCSV(await fichier.text()).slice(1); // on saute l'en-tête
  const importees = lignes
    .filter((l) => l[0]?.trim())
    .map(([entreprise, poste, type, date, source, statut, lien, notes]) => ({
      id: nouvelId(),
      entreprise,
      poste: poste || "",
      type: type === "Alternance" ? "Alternance" : "Stage",
      date: date || aujourdhui(),
      source: source || "",
      statut: STATUTS[statut] ? statut : "Envoyée",
      lien: lien || "",
      notes: notes || "",
    }));
  candidatures.push(...importees);
  sauvegarder();
  afficher();
  alert(`${importees.length} candidature(s) importée(s).`);
  e.target.value = "";
});

$("export").addEventListener("click", exporterCSV);

// ---------- Démarrage ----------
Object.keys(STATUTS).forEach((s) => $("f-statut").add(new Option(s)));
$("date").value = aujourdhui();
afficher();