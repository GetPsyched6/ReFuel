from fastapi import APIRouter, Depends

from models.database import Database, get_db
from config import INFLECTION_SKIP_LIST

router = APIRouter()


def _init_market_bucket(
    store: dict[str, dict[str, set[str]]], market: str
) -> dict[str, set[str]]:
    if market not in store:
        store[market] = {"carriers": set(), "services": set()}
    return store[market]


@router.get("/filters", summary="Available carriers and services by market")
async def get_filter_options(db: Database = Depends(get_db)):
    """
    Return the carriers and service categories that have either fuel-curve (session)
    data or historical data for each market. A carrier or service is considered
    available if it exists in *either* dataset.
    """

    carrier_rows = await db.execute_query(
        """
        SELECT DISTINCT market, carrier
        FROM fuel_surcharges
        WHERE market IS NOT NULL AND carrier IS NOT NULL
        UNION
        SELECT DISTINCT market, carrier
        FROM fuel_surcharge_history
        WHERE market IS NOT NULL AND carrier IS NOT NULL
        """
    )

    service_rows = await db.execute_query(
        """
        SELECT DISTINCT market, fuel_category
        FROM fuel_surcharges
        WHERE market IS NOT NULL AND fuel_category IS NOT NULL
        UNION
        SELECT DISTINCT market, fuel_category
        FROM fuel_surcharge_history
        WHERE market IS NOT NULL AND fuel_category IS NOT NULL
        """
    )

    markets: dict[str, dict[str, set[str]]] = {}

    for row in carrier_rows:
        bucket = _init_market_bucket(markets, row["market"])
        bucket["carriers"].add(row["carrier"])

    for row in service_rows:
        bucket = _init_market_bucket(markets, row["market"])
        bucket["services"].add(row["fuel_category"])

    response = {
        market: {
            "carriers": sorted(bucket["carriers"]),
            "services": sorted(bucket["services"]),
        }
        for market, bucket in markets.items()
    }

    return {"markets": response}


@router.get("/inflection-skip-list", summary="Get list of combinations to skip for inflection detection")
async def get_inflection_skip_list():
    """
    Returns combinations (market, carrier, fuel_category) that should skip inflection detection
    because they contain converted data (e.g., EUR to USD, L to gal)
    """
    skip_list = [
        {
            "market": market,
            "carrier": carrier,
            "fuel_category": fuel_category
        }
        for market, carrier, fuel_category in INFLECTION_SKIP_LIST
    ]
    return {"skip_list": skip_list}

