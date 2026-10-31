import { appConfirm } from "../../core/components/dialog.js";
import { toast } from "../../core/components/toast.js";
import { D } from "../../core/services/app-data.js";
import { loadData } from "../../core/services/data-loader.js";
import { rerender } from "../../routing/navigation.js";
import { detachCC } from "../calendar/cc.service.js";
import { closeGradingModal, openGradingModal } from "./grading-modal.js";
import { openResultsSheet } from "./notes-export.js";

// Actions déclenchées par les attributs data-a (clic, change, input) pour cette fonctionnalité.
export const notesActions = {
  click: {
    // Crayon (ou « Créer le calculateur ») d'une matière : ouvre la pop-up du calculateur.
    editgrading: async (t, e) => { openGradingModal(t.dataset.m); },
    // « Exporter les résultats » : ouvre la feuille de relevé dans une nouvelle fenêtre (à imprimer ou enregistrer en PDF).
    exportnotes: async (t, e) => { if (!openResultsSheet()) toast("Fenêtre bloquée : autorise les pop-ups pour ce site"); },
    // « Dissocier la date » dans l'éditeur d'épreuve (crayon d'une matière) : le CC garde son épreuve mais n'a plus de date (ni de créneau d'EDT marqué CC).
    unlinkcc: async (t, e) => {
      const ev = D.cal.evenements.find((x) => x.id === t.dataset.id);
      if (!ev || !(await appConfirm("Dissocier la date de ce CC ? Il restera dans Notes & CC, sans date."))) return;
      // Dans la pop-up du calculateur, on met la ligne à jour sans la fermer.
      try { await detachCC(ev); toast("Date dissociée"); await loadData(); rerender(); const line = t.closest(".gr-date"); if (line) line.textContent = "Sans date"; } catch (err) { toast("Erreur : " + err.message); }
    },
    closegrading: async (t, e) => { closeGradingModal(); },
  },
};
