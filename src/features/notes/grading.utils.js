// Manipulation de la configuration du calculateur (colonne `grading`, voir grades.js) sans toucher au DOM.
// Lecture de la configuration (liste des épreuves, identifiants neufs) pour les écrans qui s'appuient dessus (CC, EDT, éditeur).
import { secondAt } from "./grades.js";

export const MAX_LABEL = 80;  // caractères d'un nom d'épreuve
export const MAX_VALUE = 1e6; // poids et « Sur » : au-delà, les calculs perdent leur sens

// Nombre fini strictement positif et pas démesuré.
export const sane = (x) => Number.isFinite(x) && x > 0 && x <= MAX_VALUE;
// Poids d'une épreuve : 0 est permis (épreuve à 0 %, qui ne compte pas dans la moyenne).
export const saneWeight = (x) => Number.isFinite(x) && x >= 0 && x <= MAX_VALUE;

// Identifiant neuf, jamais réutilisé : une épreuve retirée puis une autre ajoutée ne doivent pas se partager la même note.
let seq = 0;
export function newEpreuveId(base, used) {
  let id;
  do id = base + Date.now().toString(36) + (seq++).toString(36); while (used.has(id));
  used.add(id);
  return id;
}

// Les épreuves d'une configuration dans l'ordre de l'éditeur (la 2e chance à sa place) : [{ id, label, weight, max, second }].
export function listEpreuves(g) {
  const items = (g?.items || []).map((it) => ({ id: it.id, label: it.label, weight: +it.weight || 0, max: +it.max > 0 ? +it.max : 20, second: false, seances: it.seances }));
  if (g?.second) items.splice(secondAt({ items: g.items || [], second: g.second }), 0, { id: g.second.id, label: g.second.label, weight: +g.second.weight || 0, max: +g.second.max > 0 ? +g.second.max : 20, second: true, seances: g.second.seances });
  return items;
}

export const epreuveOf = (g, id) => listEpreuves(g).find((e) => e.id === id) || null;
