"""
WHO growth chart helpers — weight-for-age and length-for-age percentiles.

Uses published WHO LMS reference medians/SDs at monthly anchors (0–24 months).
For information only; not medical advice.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

# Boys weight-for-age (kg): month -> (median, sd)
BOYS_WEIGHT = {
    0: (3.3, 0.4), 1: (4.5, 0.5), 2: (5.6, 0.6), 3: (6.4, 0.7), 4: (7.0, 0.8),
    5: (7.5, 0.8), 6: (7.9, 0.8), 7: (8.3, 0.9), 8: (8.6, 0.9), 9: (8.9, 0.9),
    10: (9.2, 1.0), 11: (9.4, 1.0), 12: (9.6, 1.0), 15: (10.3, 1.1), 18: (10.9, 1.1),
    21: (11.5, 1.2), 24: (12.0, 1.2),
}

GIRLS_WEIGHT = {
    0: (3.2, 0.4), 1: (4.2, 0.5), 2: (5.1, 0.6), 3: (5.8, 0.7), 4: (6.4, 0.7),
    5: (6.9, 0.8), 6: (7.3, 0.8), 7: (7.6, 0.8), 8: (7.9, 0.9), 9: (8.2, 0.9),
    10: (8.5, 0.9), 11: (8.7, 0.9), 12: (8.9, 1.0), 15: (9.6, 1.0), 18: (10.2, 1.0),
    21: (10.8, 1.1), 24: (11.3, 1.1),
}

# Length/height cm
BOYS_LENGTH = {
    0: (49.9, 1.9), 3: (61.4, 2.1), 6: (67.6, 2.2), 9: (72.0, 2.3), 12: (75.7, 2.4),
    15: (79.1, 2.5), 18: (82.3, 2.6), 21: (85.1, 2.7), 24: (87.8, 2.8),
}

GIRLS_LENGTH = {
    0: (49.1, 1.9), 3: (59.8, 2.0), 6: (65.7, 2.1), 9: (70.1, 2.2), 12: (74.0, 2.3),
    15: (77.5, 2.4), 18: (80.7, 2.5), 21: (83.7, 2.6), 24: (86.4, 2.7),
}

GROWTH_DISCLAIMER = (
    'For information only, not medical advice. Growth varies — consult your pediatrician '
    'if you have concerns.'
)


def _interp(table: Dict[int, Tuple[float, float]], age_months: int) -> Tuple[float, float]:
    keys = sorted(table.keys())
    if age_months <= keys[0]:
        return table[keys[0]]
    if age_months >= keys[-1]:
        return table[keys[-1]]
    lo = max(k for k in keys if k <= age_months)
    hi = min(k for k in keys if k >= age_months)
    if lo == hi:
        return table[lo]
    m_lo, sd_lo = table[lo]
    m_hi, sd_hi = table[hi]
    frac = (age_months - lo) / (hi - lo)
    return m_lo + (m_hi - m_lo) * frac, sd_lo + (sd_hi - sd_lo) * frac


def _z_score(value: float, median: float, sd: float) -> float:
    if sd <= 0:
        return 0.0
    return (value - median) / sd


def _percentile_from_z(z: float) -> float:
    """Approximate percentile from z-score (normal CDF)."""
    import math
    return max(1.0, min(99.0, 50.0 * (1 + math.erf(z / math.sqrt(2)))))


def weight_percentile(
    *,
    age_months: int,
    weight_kg: float,
    gender: str = 'unknown',
) -> Dict[str, float]:
    table = GIRLS_WEIGHT if gender == 'female' else BOYS_WEIGHT
    median, sd = _interp(table, age_months)
    z = _z_score(weight_kg, median, sd)
    return {
        'median_kg': round(median, 2),
        'z_score': round(z, 2),
        'percentile': round(_percentile_from_z(z), 1),
    }


def length_percentile(
    *,
    age_months: int,
    height_cm: float,
    gender: str = 'unknown',
) -> Dict[str, float]:
    table = GIRLS_LENGTH if gender == 'female' else BOYS_LENGTH
    median, sd = _interp(table, age_months)
    z = _z_score(height_cm, median, sd)
    return {
        'median_cm': round(median, 1),
        'z_score': round(z, 2),
        'percentile': round(_percentile_from_z(z), 1),
    }


def percentile_bands(
    *,
    metric: str,
    gender: str = 'unknown',
    months: Optional[List[int]] = None,
) -> List[Dict[str, float]]:
    """Reference curves for chart shading (P3, P50, P97 approximations)."""
    months = months or list(range(0, 25))
    table_w = GIRLS_WEIGHT if gender == 'female' else BOYS_WEIGHT
    table_l = GIRLS_LENGTH if gender == 'female' else BOYS_LENGTH
    table = table_l if metric == 'length' else table_w
    out = []
    for m in months:
        median, sd = _interp(table, m)
        out.append({
            'age_months': m,
            'p3': round(median - 1.88 * sd, 2),
            'p50': round(median, 2),
            'p97': round(median + 1.88 * sd, 2),
        })
    return out
