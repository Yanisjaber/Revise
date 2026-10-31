import { icon } from "../../core/components/icons.js";
import { C, D, M } from "../../core/services/app-data.js";
import { state } from "../../core/services/store.js";
import { $$, esc } from "../../core/utils/dom.js";
import { daysUntil, fmtLong, fmtNote } from "../../core/utils/format.js";
import { cd, fmtPoids } from "../dashboard/dashboard.utils.js";
import { seanceFor } from "../edt/edt.utils.js";
import { ccReadiness, pctCls } from "../elo/elo.utils.js";
import { calcFor } from "../notes/grades.js";
import { routerState } from "../../routing/router.store.js";

// Un CC ne se crée ni ne se modifie ici : il naît dans Notes & CC (épreuve du calculateur) et l'emploi du temps lui donne sa date.
// Ce fichier ne garde que l'affichage d'une échéance (fiche d'info) et ses petits calculs.

// Relie une échéance CC (cc_events, saisie dans Notes & CC) au cours qui la contient, si on en
// trouve un : d'abord le créneau EDT marqué cc=true pour cette matière/date (le lien le plus
// précis, posé depuis le crayon de l'EDT), sinon à défaut une séance de la même matière ce jour-là.
export function ccSeance(ev) {
  const edt = (ev.edtId && D.edt.events.find((x) => x.id === ev.edtId)) || D.edt.events.find((x) => x.cc && x.m === ev.matiere && x.d === ev.date);
  if (edt) { const s = seanceFor(edt); if (s) return s; }
  return C(ev.matiere)?.seances.find((s) => s.date === ev.date) || null;
}

export function closeCCModal() {
  $$(".modal-backdrop").forEach((b) => b.remove());
  document.removeEventListener("keydown", ccModalEsc);
  if (routerState.cleanup === closeCCModal) routerState.cleanup = null;
}

const ccModalEsc = (ev) => { if (ev.key === "Escape") closeCCModal(); };

// Popup déclenchée en cliquant une échéance CC dans la grille mensuelle (remplace l'ancien
// panneau générique #evd, qui n'avait ni la même DA que les autres popups ni de vraie mise en
// forme). Réutilise closeCCModal/ccModalEsc, génériques (ferment n'importe quel .modal-backdrop).
export function openCCInfoModal(ev) {
  closeCCModal();
  const m = M(ev.matiere), sc = ccSeance(ev), rd = ccReadiness(ev);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal card" role="dialog" aria-modal="true" aria-label="${esc(ev.titre)}" style="border-left:4px solid ${m.couleur}">
    <div class="row nowrap" style="margin-bottom:4px"><i class="dot" style="--c:${m.couleur}"></i><b>${esc(m.nom)}</b><div class="sp"></div><button type="button" class="btn sm ghost" data-a="cancelcc" aria-label="Fermer">✕</button></div>
    <h3 style="margin:4px 0 2px">${esc(ev.titre)}</h3>
    <div class="row small muted" style="gap:6px;flex-wrap:wrap">${esc(fmtLong(ev.date))}<span class="chip gr">${esc(fmtPoids(ev.poids))}</span>${ev.type === "2e" ? '<span class="chip wa">2e chance</span>' : ""}${ev.statut === "provisoire" ? '<span class="chip wa">date provisoire</span>' : ""}<span class="chip ${daysUntil(ev.date) < 0 ? "gr" : "ok"}">${cd(ev)}</span>${daysUntil(ev.date) < 0 && ccNote(ev) ? ccNoteChip(ccNote(ev)) : ""}</div>
    ${rd ? `<div class="row small" style="margin-top:8px;gap:6px"><span class="muted">Préparation (${ev.seances.length} séance${ev.seances.length > 1 ? "s" : ""})</span><span class="chip ${rd.filled ? pctCls(rd.pct) : rd.tier.cls}">${rd.filled ? `${rd.pct}% connu` : `${rd.rating} · ${esc(rd.tier.name)}`}</span></div>` : ""}
    ${ev.detail ? `<p class="small" style="margin-top:10px">${esc(ev.detail)}</p>` : ""}
    ${sc ? `<a class="btn sm ghost" style="margin-top:6px" href="#/m/${ev.matiere}">${icon("book")}Voir la matière</a>` : ""}
    <div class="row" style="margin-top:14px">
      <a class="btn sm pri" href="#/ccprep/${esc(ev.id)}">${icon("flag")}Se préparer</a>
      <a class="btn sm" href="#/qcm?m=${ev.matiere}">QCM</a>
      <a class="btn sm" href="#/m/${ev.matiere}/cc">Fiche CC</a>
      <div class="sp"></div>
      <a class="btn sm ghost" href="#/notes" title="Nom, poids, séances au programme : à modifier dans Notes &amp; CC">${icon("edit")}Notes &amp; CC</a>
    </div>
  </div>`;
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) closeCCModal(); });
  document.addEventListener("keydown", ccModalEsc);
  document.body.appendChild(backdrop);
  routerState.cleanup = closeCCModal;
}

// Note obtenue à une épreuve CC, retrouvée dans le calculateur (state.notes) par l'identifiant de l'épreuve reliée.
// Une échéance non reliée n'a pas de note (aucun rapprochement par le titre). Renvoie { v, max } ou null.
export function ccNote(ev) {
  const K = calcFor(ev.matiere); if (!K) return null;
  // Échéance reliée à une épreuve : on retrouve sa note par l'identifiant (moyenne des saisies si l'épreuve en a plusieurs).
  const ids = ev.epreuve && K.groups?.[ev.epreuve];
  if (ids) {
    const vals = ids.map((k) => state.notes[ev.matiere]?.v?.[k]);
    if (vals.some((x) => x === "" || x === null || x === undefined || isNaN(+x))) return null;
    return { v: vals.reduce((t, x) => t + +x, 0) / vals.length, max: K.champs.find(([k]) => k === ids[0])?.[2] || 20 };
  }
  return null;
}

export const ccNoteChip = (n) => `<span class="chip ${n.v >= n.max / 2 ? "ok" : "ko"}">${fmtNote(n.v)}/${n.max}</span>`;
