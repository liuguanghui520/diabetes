do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'ai_conversation'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%app_type%'
  limit 1;

  if v_constraint_name is not null then
    execute 'alter table ai_conversation drop constraint ' || quote_ident(v_constraint_name);
  end if;
end $$;

alter table ai_conversation
  add constraint ai_conversation_app_type_check
  check (app_type in ('assistant', 'doctor', 'admin'));
