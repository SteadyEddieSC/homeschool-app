begin;

create function public.submit_knowledge_attempt_v2(
  target_check uuid,
  submitted_answers jsonb,
  operation_id uuid,
  target_attempt uuid
)
returns public.knowledge_attempts
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_check public.knowledge_checks%rowtype;
  prior_receipt public.learning_studio_operation_receipts%rowtype;
  created_attempt public.knowledge_attempts%rowtype;
  answer_count integer;
  correct_count integer;
  result_rows jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if operation_id is null then raise exception 'Operation ID is required'; end if;
  if target_attempt is null then raise exception 'Target attempt ID is required'; end if;

  select * into prior_receipt
  from public.learning_studio_operation_receipts
  where learning_studio_operation_receipts.operation_id = submit_knowledge_attempt_v2.operation_id;

  if found then
    if prior_receipt.operation_kind <> 'submit-knowledge-attempt' then
      raise exception 'Operation ID was already used for a different action';
    end if;
    select * into created_attempt from public.knowledge_attempts where id = prior_receipt.record_id;
    return created_attempt;
  end if;

  select * into current_check from public.knowledge_checks where id = target_check for update;
  if not found then raise exception 'Knowledge check was not found'; end if;
  if not public.can_view_family(current_check.household_id) then raise exception 'Knowledge check is not authorized'; end if;
  if jsonb_typeof(submitted_answers) <> 'array' then raise exception 'Answers must be an array'; end if;

  answer_count := jsonb_array_length(submitted_answers);
  if answer_count <> jsonb_array_length(current_check.questions) then
    raise exception 'Answer every question before submitting the check';
  end if;

  select
    count(*) filter (
      where (submitted_answers ->> ((question.ordinality - 1)::integer))::integer = (question.value ->> 'correctOption')::integer
    )::integer,
    jsonb_agg(jsonb_build_object(
      'questionId', question.value ->> 'id',
      'selectedOption', (submitted_answers ->> ((question.ordinality - 1)::integer))::integer,
      'correctOption', (question.value ->> 'correctOption')::integer,
      'correct', (submitted_answers ->> ((question.ordinality - 1)::integer))::integer = (question.value ->> 'correctOption')::integer
    ) order by question.ordinality)
  into correct_count, result_rows
  from jsonb_array_elements(current_check.questions) with ordinality as question(value, ordinality);

  insert into public.knowledge_attempts (
    id, organization_id, household_id, learner_id, today_item_id, check_id,
    answers, correct_count, total_questions, percentage, results,
    client_operation_id, submitted_by
  ) values (
    target_attempt,
    current_check.organization_id,
    current_check.household_id,
    current_check.learner_id,
    current_check.today_item_id,
    current_check.id,
    submitted_answers,
    correct_count,
    answer_count,
    round((correct_count::numeric / answer_count::numeric) * 100)::integer,
    result_rows,
    operation_id,
    auth.uid()
  ) returning * into created_attempt;

  insert into public.learning_studio_operation_receipts(
    operation_id, organization_id, household_id, operation_kind, record_id, actor_id
  ) values (
    operation_id,
    current_check.organization_id,
    current_check.household_id,
    'submit-knowledge-attempt',
    created_attempt.id,
    auth.uid()
  );

  insert into public.audit_events(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    current_check.organization_id,
    auth.uid(),
    'knowledge_attempt.submit',
    'knowledge_attempt',
    created_attempt.id,
    jsonb_build_object(
      'check_id', current_check.id,
      'correct_count', correct_count,
      'total_questions', answer_count,
      'operation_id', operation_id,
      'client_record_id_preserved', true
    )
  );

  return created_attempt;
end;
$$;

create function public.hosted_pilot_schema_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  return jsonb_build_object(
    'release', '11.0.0-beta.4',
    'migration', '202608040008',
    'identity_tables', true,
    'household_learning_tables', true,
    'studio_tables', true,
    'idempotent_today_rpc', true,
    'idempotent_studio_rpc', true,
    'subjective_proof_review_rpc', true,
    'production_data_enabled', false
  );
end;
$$;

revoke all on function public.submit_knowledge_attempt_v2(uuid, jsonb, uuid, uuid) from public;
revoke all on function public.hosted_pilot_schema_status() from public;
grant execute on function public.submit_knowledge_attempt_v2(uuid, jsonb, uuid, uuid) to authenticated;
grant execute on function public.hosted_pilot_schema_status() to authenticated;

comment on function public.submit_knowledge_attempt_v2(uuid, jsonb, uuid, uuid)
is 'Scores an objective knowledge attempt while preserving the local client record ID and idempotent operation receipt.';
comment on function public.hosted_pilot_schema_status()
is 'Returns non-sensitive schema capability metadata for the protected hosted-pilot readiness check.';

commit;
