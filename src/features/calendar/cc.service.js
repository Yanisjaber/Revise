import { D, M } from "../../core/services/app-data.js";
import { sync } from "../../core/services/store.js";
import { client } from "../../core/services/supabase.client.js";
import { fmt1 } from "../../core/utils/format.js";
import { saveEdtEvent } from "../edt/edt.service.js";
import { calcFor, shareText } from "../notes/grades.js";
import { epreuveOf, listEpreuves } from "../notes/grading.utils.js";

// Un CC naît dans Notes & CC (c'est une épreuve du calculateur). L'emploi du temps ne fait que lui donner une date :
// `evenements` = les CC qui ont une date (calendrier, accueil…), `sansDate` = ceux dont le créneau a disparu.
export async function loadCC() {
  if (!sync.client || !sync.user) return { evenements: [], sansDate: [], remarques: [] };
  const { data, error } = await sync.client.from("cc_events").select("*").order("date", { ascending: true });
  if (error) { console.warn("loadCC", error); return { evenements: [], sansDate: [], remarques: [] }; }
  const all = data.map((r) => ({ id: r.id, matiere: r.matiere, titre: r.titre, date: r.date, poids: r.poids, type: r.type, statut: r.statut, detail: r.detail, edtId: r.edt_id, epreuve: r.epreuve || null, seances: r.seances || [] }));
  return { evenements: all.filter((e) => e.date), sansDate: all.filter((e) => !e.date), remarques: [] };
}

// Une échéance reliée à une épreuve du calculateur affiche TOUJOURS le nom et le coef de cette épreuve : ils remplacent le
// titre et le poids saisis à la main, pour qu'ils ne puissent plus contredire le calculateur (un seul nom, un seul coef).
// À appeler une fois les matières chargées.
export function applyEpreuve(evenements) {
  for (const e of evenements) {
    const ep = e.epreuve ? epreuveOf(M(e.matiere)?.grading, e.epreuve) : null;
    if (!ep) continue;
    e.titre = ep.label;
    const share = calcFor(e.matiere)?.epShares?.[e.epreuve];
    if (share !== undefined) e.poids = shareText(share);
    if (Array.isArray(ep.seances)) e.seances = ep.seances; // séances au programme : réglées sur l'épreuve, dans Notes & CC
  }
}

export async function saveCCEvent(e) {
  const row = { user_id: sync.user.id, matiere: e.matiere, titre: e.titre || "", date: e.date || null, poids: e.poids || "", type: e.type || "CC", statut: e.statut || "", detail: e.detail || "", edt_id: e.edtId || null, epreuve: e.epreuve || null, seances: e.seances || [] };
  if (e.id) row.id = e.id;
  const { data, error } = await client().from("cc_events").upsert(row, { onConflict: "user_id,id" }).select().single();
  if (error) throw error;
  return data.id;
}

export async function deleteCCEvent(id) {
  const { error } = await client().from("cc_events").delete().eq("id", id);
  if (error) throw error;
}

// L'échéance (avec ou sans date) d'une épreuve, si elle existe déjà.
export const ccOfEpreuve = (matiere, epreuve) => [...D.cal.evenements, ...(D.cal.sansDate || [])].find((x) => x.matiere === matiere && x.epreuve === epreuve) || null;

// Place une épreuve sur un créneau de l'emploi du temps : la date vient du créneau, le nom et le poids de l'épreuve.
// Réutilise l'échéance de l'épreuve si elle existe (par exemple sans date), sinon la crée. Rend son identifiant.
export async function placeCC({ matiere, epreuve, slot }) {
  const ep = epreuveOf(M(matiere)?.grading, epreuve);
  if (!ep) throw new Error("Épreuve introuvable : crée-la d'abord dans Notes & CC");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(slot?.d || ""))) throw new Error("Le créneau n'a pas de date valide");
  const old = ccOfEpreuve(matiere, epreuve);
  return saveCCEvent({ ...(old || {}), matiere, epreuve: ep.id, date: slot.d, edtId: slot.id, titre: ep.label, poids: `${fmt1(ep.weight)} %`, type: ep.second ? "2e" : "CC" });
}

// Détache l'échéance de son créneau : elle perd sa date mais reste dans Notes & CC.
export const unplaceCC = (ev) => saveCCEvent({ ...ev, date: null, edtId: null });

// « Dissocier » depuis Notes & CC : l'échéance perd sa date et son lien, et son créneau d'EDT n'est plus marqué CC.
export async function detachCC(ev) {
  await unplaceCC(ev);
  const slot = ev.edtId && D.edt.events.find((x) => x.id === ev.edtId);
  if (slot) await saveEdtEvent({ ...slot, cc: false });
}

// Après une modification du calculateur : retire les échéances dont l'épreuve n'existe plus, et décoche leur créneau d'EDT.
export async function dropCCOfRemovedEpreuves(mid, grading) {
  const keep = new Set(listEpreuves(grading).map((p) => p.id));
  const gone = [...D.cal.evenements, ...(D.cal.sansDate || [])].filter((x) => x.matiere === mid && x.epreuve && !keep.has(x.epreuve));
  for (const ev of gone) {
    await deleteCCEvent(ev.id);
    const slot = ev.edtId && D.edt.events.find((x) => x.id === ev.edtId);
    if (slot) await saveEdtEvent({ ...slot, cc: false });
  }
}
