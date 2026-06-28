-- Follow-up fixes after migration review.
-- This migration is safe for databases that already applied 202606280001-004.

do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'admin_audit_log'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) like '%admin_user_id%'
  limit 1;

  if v_constraint_name is not null then
    execute 'alter table admin_audit_log drop constraint ' || quote_ident(v_constraint_name);
  end if;
end $$;

alter table admin_audit_log
  add constraint admin_audit_log_admin_user_id_fkey
  foreign key (admin_user_id) references sys_user(id) on delete set null;

update article
set audit_status = 'pending_review'
where status = 'draft';

update article
set audit_status = 'approved'
where status in ('published', 'offline');

comment on column article.content is 'Article canonical body. For Markdown articles this stores Markdown text; content_html may cache rendered HTML.';
comment on column article.content_md is 'Deprecated compatibility alias for Markdown body. Prefer article.content.';
comment on column article.content_html is 'Optional rendered HTML cache generated from article.content.';

comment on column doctor.online_status is 'Deprecated display online flag kept for compatibility. Prefer doctor.consult_status for consultation availability.';
comment on column doctor.consult_status is 'Consultation availability: online, offline, or paused.';
comment on column doctor.display_status is 'User-facing publication state: published or hidden.';
comment on column doctor.audit_status is 'Back-office review state: pending_review, approved, or rejected.';

comment on column system_message.type is 'Business message type. Frontend message group is derived separately: archive/risk/system -> service, plan/consultation -> reminder, assistant -> assistant.';

do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'home_operation_config'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%slot_code%'
  limit 1;

  if v_constraint_name is not null then
    execute 'alter table home_operation_config drop constraint ' || quote_ident(v_constraint_name);
  end if;
end $$;

alter table home_operation_config
  add constraint home_operation_config_slot_code_check
  check (slot_code in ('home_banner', 'hot_articles', 'recommended_doctors'));

do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'home_operation_config'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%target_type%'
  limit 1;

  if v_constraint_name is not null then
    execute 'alter table home_operation_config drop constraint ' || quote_ident(v_constraint_name);
  end if;
end $$;

alter table home_operation_config
  add constraint home_operation_config_target_type_check
  check (target_type in ('article', 'doctor', 'diabetes_type'));
