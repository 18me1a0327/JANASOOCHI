-- The extraction worker is the only caller allowed to execute the privileged
-- atomic persistence function. Admin users initiate processing through the
-- protected job workflow; the browser never submits arbitrary source rows.

revoke execute on function public.persist_extracted_page_v1(
  uuid, uuid, jsonb, jsonb, jsonb
) from authenticated;

grant execute on function public.persist_extracted_page_v1(
  uuid, uuid, jsonb, jsonb, jsonb
) to service_role;

