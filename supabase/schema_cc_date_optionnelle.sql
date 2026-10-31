-- Un CC naît dans Notes & CC ; l'emploi du temps ne fait que lui donner une date. Rejouable.
-- À exécuter après schema_edt_cc.sql et schema_cc_epreuve.sql.

-- Une échéance peut exister sans date (créneau d'EDT supprimé, ou pas encore placé).
alter table public.cc_events alter column date drop not null;

-- Quand un créneau d'EDT disparaît, l'échéance qui y était liée perd sa date et son lien, mais reste.
-- Exécuté avant la suppression : la clé étrangère edt_id n'a plus rien à traiter ensuite.
create or replace function public.cc_unlink_edt() returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.cc_events set date = null, edt_id = null
  where user_id = old.user_id and edt_id = old.id;
  return old;
end;
$$;

drop trigger if exists edt_events_unlink_cc on public.edt_events;
create trigger edt_events_unlink_cc before delete on public.edt_events
  for each row execute function public.cc_unlink_edt();
