from __future__ import annotations

USD_TO_EUR_RATE = 0.87
EUR_TO_USD_RATE = 1 / USD_TO_EUR_RATE
GALLON_TO_LITER = 3.78541


def _round_currency(value: float) -> float:
    return round(value, 2)


def convert_eur_1000l_to_l(price: float | int) -> float:
    return _round_currency(float(price) / 1000.0)


def usd_to_eur(amount: float | int) -> float:
    return _round_currency(float(amount) * USD_TO_EUR_RATE)


def eur_to_usd(amount: float | int) -> float:
    return _round_currency(float(amount) * EUR_TO_USD_RATE)


def usd_per_gallon_to_eur_per_liter(amount: float | int) -> float:
    return _round_currency((float(amount) * USD_TO_EUR_RATE) / GALLON_TO_LITER)

