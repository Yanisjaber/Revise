-- Mode « cours annulé » : un drapeau sur le créneau EDT. Le créneau reste visible (barré) mais ne
-- compte plus comme un cours (pas de séance à rédiger, pas dans les heures, pas dans « prochains cours »).
-- Rejouable sans risque.
alter table public.edt_events add column if not exists cancelled boolean not null default false;
