import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.models.database import db
from backend.scraper.core.utils import (
    usd_per_gallon_to_eur_per_liter,
    _round_currency,
    GALLON_TO_LITER,
)


async def migrate_dhl_data():
    print("Fetching DHL Germany rows stored in USD...")
    rows = await db.execute_query(
        """
        SELECT id, at_least_usd, but_less_than_usd, currency
        FROM fuel_surcharges
        WHERE carrier = 'DHL' AND market = 'DE' AND fuel_category = 'ground_domestic'
        """
    )
    if not rows:
        print("No DHL Germany rows found.")
        return

    print(f"Updating {len(rows)} rows to EUR/Liter with 2-decimal precision...")
    for row in rows:
        new_currency = "EUR"
        if row["currency"] == "USD":
            converted_min = usd_per_gallon_to_eur_per_liter(row["at_least_usd"])
            converted_max = usd_per_gallon_to_eur_per_liter(row["but_less_than_usd"])
        elif row["at_least_usd"] >= 1.0:
            # Existing EUR-per-gallon => convert to EUR-per-liter
            converted_min = _round_currency(row["at_least_usd"] / GALLON_TO_LITER)
            converted_max = _round_currency(row["but_less_than_usd"] / GALLON_TO_LITER)
        else:
            converted_min = _round_currency(row["at_least_usd"])
            converted_max = _round_currency(row["but_less_than_usd"])
            new_currency = row["currency"]
        await db.execute_write(
            """
            UPDATE fuel_surcharges
            SET at_least_usd = ?, but_less_than_usd = ?, currency = ?
            WHERE id = ?
            """,
            (converted_min, converted_max, new_currency, row["id"]),
        )

    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate_dhl_data())

