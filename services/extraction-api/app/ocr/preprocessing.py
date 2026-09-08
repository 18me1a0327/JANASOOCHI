from __future__ import annotations

import pymupdf

from app.core.exceptions import OcrPreprocessingError
from app.models.field_regions import FieldRegion
from app.models.ocr import OcrPreprocessingVariant


def _grayscale_samples(pixmap: pymupdf.Pixmap) -> bytearray:
    channels = pixmap.n
    alpha = bool(pixmap.alpha)
    source = pixmap.samples
    grayscale = bytearray(pixmap.width * pixmap.height)

    for pixel_index in range(pixmap.width * pixmap.height):
        offset = pixel_index * channels
        if channels in {1, 2}:
            value = source[offset]
        else:
            red, green, blue = source[offset : offset + 3]
            value = (77 * red + 150 * green + 29 * blue) >> 8
        if alpha:
            opacity = source[offset + channels - 1]
            value = (value * opacity + 255 * (255 - opacity) + 127) // 255
        grayscale[pixel_index] = value
    return grayscale


def _high_contrast(samples: bytearray) -> bytearray:
    return bytearray(
        max(0, min(255, ((value - 128) * 3) // 2 + 128))
        for value in samples
    )


def _otsu_threshold(samples: bytearray) -> int:
    histogram = [0] * 256
    for value in samples:
        histogram[value] += 1

    total = len(samples)
    weighted_total = sum(index * count for index, count in enumerate(histogram))
    background_weight = 0
    background_sum = 0
    best_threshold = 127
    best_variance = -1.0

    for threshold, count in enumerate(histogram):
        background_weight += count
        if background_weight == 0:
            continue
        foreground_weight = total - background_weight
        if foreground_weight == 0:
            break
        background_sum += threshold * count
        background_mean = background_sum / background_weight
        foreground_mean = (weighted_total - background_sum) / foreground_weight
        variance = (
            background_weight
            * foreground_weight
            * (background_mean - foreground_mean) ** 2
        )
        if variance > best_variance:
            best_variance = variance
            best_threshold = threshold
    return best_threshold


def _encode_grayscale(width: int, height: int, samples: bytearray) -> bytes:
    pixmap = pymupdf.Pixmap(
        pymupdf.csGRAY,
        width,
        height,
        bytes(samples),
        False,
    )
    return pixmap.tobytes("png")


def preprocess_field_region(
    field: FieldRegion,
    variant: OcrPreprocessingVariant,
) -> FieldRegion:
    """Return a derived field crop without mutating source bytes or geometry."""

    if variant == OcrPreprocessingVariant.ORIGINAL:
        return field

    try:
        source = pymupdf.Pixmap(field.crop_png_bytes)
        grayscale = _grayscale_samples(source)
        if variant == OcrPreprocessingVariant.GRAYSCALE_HIGH_CONTRAST:
            processed = _high_contrast(grayscale)
        elif variant == OcrPreprocessingVariant.BINARY_OTSU:
            threshold = _otsu_threshold(grayscale)
            processed = bytearray(
                255 if value > threshold else 0 for value in grayscale
            )
        else:
            raise OcrPreprocessingError(
                "The requested OCR preprocessing variant is unsupported."
            )
        png_bytes = _encode_grayscale(source.width, source.height, processed)
    except OcrPreprocessingError:
        raise
    except (pymupdf.mupdf.FzErrorBase, RuntimeError, ValueError) as exc:
        raise OcrPreprocessingError() from exc

    return field.model_copy(update={"crop_png_bytes": png_bytes})

