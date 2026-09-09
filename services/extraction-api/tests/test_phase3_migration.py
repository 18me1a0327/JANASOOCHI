from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
ATOMIC_MIGRATION = (
    ROOT / "supabase" / "migrations" / "013_phase3_atomic_page_ingestion.sql"
)
SECURITY_MIGRATION = (
    ROOT / "supabase" / "migrations" / "014_phase3_persistence_security.sql"
)
PAGE_INTEGRITY_MIGRATION = (
    ROOT / "supabase" / "migrations" / "015_page_processing_integrity.sql"
)


def test_atomic_page_rpc_has_transaction_and_source_safety_guards() -> None:
    sql = ATOMIC_MIGRATION.read_text(encoding="utf-8").lower()

    assert "security definer" in sql
    assert "set search_path = ''" in sql
    assert "pg_advisory_xact_lock" in sql
    assert "jsonb_array_length(p_records) > 30" in sql
    assert "v_record ? 'logical_voter_id'" in sql
    assert "v_record ? 'verified_by'" in sql
    assert "v_record ? 'verified_at'" in sql
    assert "a retry attempted to overwrite preserved source evidence" in sql
    assert "update public.voter_records" not in sql


def test_privileged_rpc_is_backend_service_only_after_security_migration() -> None:
    sql = SECURITY_MIGRATION.read_text(encoding="utf-8").lower()

    assert "revoke execute" in sql
    assert "from authenticated" in sql
    assert "grant execute" in sql
    assert "to service_role" in sql


def test_page_integrity_trigger_bounds_pages_and_card_counts() -> None:
    sql = PAGE_INTEGRITY_MIGRATION.read_text(encoding="utf-8").lower()

    assert "new.pdf_page_number > v_total_pages" in sql
    assert "r.document_id = new.pdf_id" in sql
    assert "new.records_detected > 30" in sql
    assert "new.records_extracted > new.records_detected" in sql
    assert "new.review_records > new.records_extracted" in sql

