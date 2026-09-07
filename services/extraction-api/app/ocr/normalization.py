from __future__ import annotations

import re
import unicodedata

from app.models.field_regions import FieldType


_NUMERIC_FIELDS = frozenset({FieldType.SERIAL_NUMBER, FieldType.AGE})


def _decimal_digits(value: str) -> str:
    digits: list[str] = []
    for character in value:
        try:
            digits.append(str(unicodedata.digit(character)))
        except (TypeError, ValueError):
            continue
    return "".join(digits)


def normalize_ocr_value(raw_value: str, field_type: FieldType) -> str | None:
    """Create a search/validation value without modifying the raw transcription."""

    value = unicodedata.normalize("NFC", raw_value)
    if field_type in _NUMERIC_FIELDS:
        normalized = _decimal_digits(value)
    elif field_type == FieldType.EPIC:
        normalized = "".join(character for character in value.upper() if character.isalnum())
    else:
        normalized = re.sub(r"\s+", " ", value).strip()
        if field_type in {FieldType.VOTER_NAME, FieldType.RELATION_NAME}:
            normalized = normalized.casefold()
        elif field_type in {FieldType.RELATION_TYPE, FieldType.GENDER}:
            normalized = normalized.casefold()
    return normalized or None
