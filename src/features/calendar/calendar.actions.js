import { appConfirm } from "../../core/components/dialog.js";
import { toast } from "../../core/components/toast.js";
import { D } from "../../core/services/app-data.js";
import { loadData } from "../../core/services/data-loader.js";
import { icsExport } from "./calendar.page.js";
import { calState } from "./calendar.store.js";
import { closeCCModal, openCCInfoModal } from "./cc-modal.js";
import { deleteCCEvent } from "./cc.service.js";
import { rerender } from "../../routing/navigation.js";

// Actions déclenchées par les attributs data-a (clic, change, input) pour cette fonctionnalité.
export const calendarActions = {
  click: {
    calprev: async (t, e) => { calState.calMonth = new Date(calState.calMonth.getFullYear(), calState.calMonth.getMonth() - 1, 1); rerender(); },
    calnext: async (t, e) => { calState.calMonth = new Date(calState.calMonth.getFullYear(), calState.calMonth.getMonth() + 1, 1); rerender(); },
    caltoday: async (t, e) => { calState.calMonth = null; rerender(); },
    ics: async (t, e) => { icsExport(); },
    evt: async (t, e) => { const ev = D.cal.evenements.find((x) => x.id === t.dataset.id); if (ev) openCCInfoModal(ev); },
    cancelcc: async (t, e) => { closeCCModal(); },
    // Seules les échéances SANS épreuve du calculateur (restes d'avant) se suppriment ici ; les autres se retirent dans Notes & CC.
    delcc: async (t, e) => {
      const ev = D.cal.evenements.find((x) => x.id === t.dataset.id);
      if (!ev || ev.epreuve || !(await appConfirm("Supprimer cette échéance orpheline ?"))) return;
      try { await deleteCCEvent(ev.id); toast("Échéance supprimée"); closeCCModal(); await loadData(); rerender(); } catch (err) { toast("Erreur : " + err.message); }
    },
  },
  change: {
    calses: async (t, e) => { calState.calSeances = t.checked; rerender(); },
  },
};
