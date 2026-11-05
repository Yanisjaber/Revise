import { icon } from "../../core/components/icons.js";
import { toast } from "../../core/components/toast.js";
import { C, D, M } from "../../core/services/app-data.js";
import { loadData } from "../../core/services/data-loader.js";
import { todayKey } from "../../core/services/store.js";
import { $, $$, esc } from "../../core/utils/dom.js";
import { placeCC, unplaceCC } from "../calendar/cc.service.js";
import { listEpreuves } from "../notes/grading.utils.js";
import { saveEdtEvent } from "./edt.service.js";
import { edtDefaultType, edtTypeIds } from "../settings/settings.js";
import { saveSeance } from "../seances/seances.service.js";
import { rerender } from "../../routing/navigation.js";
import { routerState } from "../../routing/router.store.js";

// L'échéance CC d'un créneau : uniquement celle reliée par `edtId` (aucune adoption d'une échéance « qui ressemble »).
const ccOfSlot = (slot) => (slot.id && D.cal.evenements.find((x) => x.edtId === slot.id)) || null;

// Épreuves de la matière qu'on peut poser sur ce créneau : celles qui n'ont pas de créneau, plus celle déjà posée ici.
function epreuveOptions(mid, current, selfId) {
  const taken = new Set([...D.cal.evenements, ...(D.cal.sansDate || [])].filter((x) => x.matiere === mid && x.epreuve && x.edtId && x.id !== selfId).map((x) => x.epreuve));
  const free = listEpreuves(M(mid)?.grading).filter((p) => !taken.has(p.id));
  if (!mid) return `<option value="">Choisis d'abord la matière</option>`;
  if (!free.length) return `<option value="">Aucune épreuve libre : crée-la dans Notes &amp; CC</option>`;
  return `<option value="">Choisis une épreuve</option>` + free.map((p) => `<option value="${esc(p.id)}" ${p.id === current ? "selected" : ""}>${esc(p.label)}${p.second ? " (2e chance)" : ""}</option>`).join("");
}

// Formulaire unique pour ajouter OU modifier un créneau à la main (bouton "+" du header, ou
// crayon sur une carte de la grille) — remplace l'ancien sélecteur "changer le type" isolé.
function edtEventForm(e) {
  const isNew = !e;
  const v = e || { id: "", d: todayKey(), s: "08:00", e: "10:00", t: edtDefaultType(), m: "", r: "", p: "", g: "", n: "", cc: false, allday: false, cancelled: false };
  const linked = ccOfSlot(v);
  return `${linked ? `<div class="row" style="margin-bottom:12px"><a class="btn sm ghost" href="#/cal">${icon("cal")}Voir dans le calendrier</a></div>` : ""}
  <form data-a="saveedt">
    <input type="hidden" name="id" value="${esc(v.id)}">
    <div class="grid g2">
      <div class="field"><label>Matière</label><select name="m"><option value="">(aucune)</option>${D.matieres.map((mm) => `<option value="${esc(mm.id)}" ${v.m === mm.id ? "selected" : ""}>${esc(mm.nom)}</option>`).join("")}</select></div>
      <div class="field"><label>Type</label><select name="t">${edtTypeIds().map((t) => `<option value="${t}" ${v.t === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label>Date</label><input type="date" name="d" required value="${esc(v.d || "")}"></div>
      <div class="field" style="align-self:end"><label class="row small" style="gap:6px"><input type="checkbox" name="allday" ${v.allday ? "checked" : ""}> Toute la journée</label></div>
      <div class="field"><label>Début</label><input type="time" name="s" value="${esc(v.s || "")}"></div>
      <div class="field"><label>Fin</label><input type="time" name="e" value="${esc(v.e || "")}"></div>
      <div class="field"><label>Salle</label><input type="text" name="r" value="${esc(v.r || "")}" placeholder="ex. B204"></div>
      <div class="field"><label>Groupe</label><input type="text" name="g" value="${esc(v.g || "")}" placeholder="ex. TD2"></div>
    </div>
    <label class="row small" style="gap:6px;margin-top:10px"><input type="checkbox" name="cancelled" ${v.cancelled ? "checked" : ""}> Cours annulé <span class="tiny muted">(reste affiché, barré, et ne compte plus)</span></label>
    <label class="row small" style="gap:6px;margin-top:10px"><input type="checkbox" name="cc" ${v.cc ? "checked" : ""}> Contrôle continu pendant ce créneau</label>
    <div id="edtCC" ${v.cc ? "" : "hidden"} style="margin-top:10px"><div class="field"><label>Épreuve de Notes &amp; CC</label><select name="epreuve">${epreuveOptions(v.m, linked?.epreuve, linked?.id)}</select>
      <p class="tiny muted" style="margin:6px 0 0">Le CC se crée dans Notes &amp; CC. Ici tu lui donnes seulement sa date : celle de ce créneau.</p></div></div>
    <div class="field" style="margin-top:10px"><label>Note</label><input type="text" name="n" value="${esc(v.n || "")}" placeholder="intitulé affiché sous le créneau, ou détails du CC"></div>
    <div class="row" style="margin-top:12px">
      <button class="btn pri" type="submit">${icon("check")}${isNew ? "Ajouter" : "Enregistrer"}</button>
      ${isNew ? "" : `<button class="btn" type="button" data-a="deledt" data-id="${esc(v.id)}">Supprimer</button>`}
      <button class="btn ghost" type="button" data-a="canceledt">Annuler</button>
    </div>
  </form>`;
}

// Popup centrée (pas un panneau en bas de page) pour ajouter OU modifier un créneau — ouverte par
// le "+" de l'en-tête ou le crayon d'une carte, fermée par Annuler/Échap/clic hors de la boîte.
// Même mécanisme que l'overlay d'écriture manuscrite pour être retirée au changement de route :
// elle s'enregistre dans `cleanup`, rappelé au tout début de route().
export function openEdtModal(e) {
  closeEdtModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal card" role="dialog" aria-modal="true" aria-label="${e ? "Modifier le créneau" : "Ajouter un créneau"}">
    <div class="row" style="margin-bottom:12px"><h3 style="margin:0">${e ? "Modifier le créneau" : "Ajouter un créneau"}</h3><div class="sp"></div><button type="button" class="btn sm ghost" data-a="canceledt" aria-label="Fermer">✕</button></div>
    ${edtEventForm(e)}
  </div>`;
  backdrop.addEventListener("mousedown", (ev) => { if (ev.target === backdrop) closeEdtModal(); });
  document.addEventListener("keydown", edtModalEsc);
  document.body.appendChild(backdrop);
  const f = $('form[data-a="saveedt"]', backdrop);
  // Bloc « Contrôle continu » : visible et obligatoire seulement quand la case est cochée (le champ masqué est
  // désactivé, sinon le navigateur bloquerait l'envoi sur un champ invisible).
  const ccBox = $("#edtCC", f), epSel = f.elements.epreuve, linkedNow = ccOfSlot(e || {});
  const toggleCC = () => { const on = f.elements.cc.checked; ccBox.hidden = !on; epSel.disabled = !on; epSel.required = on; };
  f.elements.cc.addEventListener("change", toggleCC);
  f.elements.m.addEventListener("change", () => { epSel.innerHTML = epreuveOptions(f.elements.m.value, "", linkedNow?.id); });
  toggleCC();
  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f), btn = $('button[type="submit"]', f);
    if (btn.disabled) return; // un seul enregistrement à la fois (double clic)
    btn.disabled = true;
    try {
      const d = fd.get("d"), m = fd.get("m") || null, wantCC = fd.get("cc") === "on", ep = wantCC ? fd.get("epreuve") : "";
      const before = ccOfSlot({ id: fd.get("id") });
      if (wantCC && !m) throw new Error("Choisis la matière du CC");
      // Le cours relié appartient à la matière du créneau : changer de matière le laisserait sans créneau.
      if (e?.sid && e.m && m !== e.m) throw new Error("Ce créneau porte un cours : supprime d'abord le cours pour changer de matière");
      if (wantCC && !ep) throw new Error("Choisis l'épreuve de Notes & CC (ou crée-la d'abord là-bas)");
      const id = await saveEdtEvent({ id: fd.get("id") || undefined, d, s: fd.get("s"), e: fd.get("e"), t: fd.get("t"), m, sid: e?.sid, r: fd.get("r"), p: fd.get("p"), g: fd.get("g"), n: fd.get("n"), cc: wantCC, allday: fd.get("allday") === "on", cancelled: fd.get("cancelled") === "on" });
      f.elements.id.value = id; // si la suite échoue, un nouvel envoi met à jour ce créneau au lieu d'en créer un autre
      // Le CC déjà posé ici est détaché s'il change d'épreuve ou si la case est décochée : il perd sa date mais reste dans Notes & CC.
      if (before && (!wantCC || before.epreuve !== ep || before.matiere !== m)) await unplaceCC(before);
      if (wantCC) await placeCC({ matiere: m, epreuve: ep, slot: { id, d } }); // la date de l'épreuve = celle du créneau (suit aussi un déplacement)
      // Même chose pour la séance de cours liée (lien explicite e.sid, plus besoin de deviner par
      // date+type+matière) : sans ça elle reste sur l'ancienne date, se détache du créneau dans
      // l'EDT (qui propose alors de "recréer" un cours) et continue de s'afficher à l'ancienne
      // date dans la vue matière.
      const linkedSeance = e?.sid && e.m ? C(e.m)?.seances.find((s) => s.id === e.sid) : null;
      if (linkedSeance && d !== e.d) await saveSeance(e.m, { ...linkedSeance, date: d });
      toast("Créneau enregistré");
      closeEdtModal();
      await loadData(); rerender();
    } catch (err) { btn.disabled = false; toast("Erreur : " + err.message); }
  });
  routerState.cleanup = closeEdtModal;
}

export function closeEdtModal() {
  $$(".modal-backdrop").forEach((b) => b.remove());
  document.removeEventListener("keydown", edtModalEsc);
  if (routerState.cleanup === closeEdtModal) routerState.cleanup = null;
}

const edtModalEsc = (ev) => { if (ev.key === "Escape") closeEdtModal(); };
