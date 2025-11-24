"""
Rebuild DHL Germany Historical Data with Weekly Mapping

This script:
1. Deletes all existing DHL Germany historical rows (the incorrect 1st-of-month rows)
2. Queries UPS weekly dates from the database
3. Uses the DHL weekly mapper to compute proper weekly windows
4. Inserts new DHL Germany rows aligned with UPS weeks
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.models.database import db
from backend.services.dhl_germany_weekly_mapper import (
    compute_dhl_weekly_windows,
    DHL_GERMANY_MONTHLY,
)


async def rebuild_dhl_germany_data():
    """Main rebuild function"""
    
    print("=" * 80)
    print("DHL GERMANY WEEKLY DATA REBUILD")
    print("=" * 80)
    
    # Step 1: Delete existing DHL Germany historical rows
    print("\n[1/4] Deleting existing DHL Germany historical rows...")
    delete_result = await db.execute_write("""
        DELETE FROM fuel_surcharge_history
        WHERE carrier = 'DHL' AND market = 'DE'
    """)
    print(f"   ✓ Deleted existing DHL Germany rows")
    
    # Step 2: Query UPS weekly dates (using Germany UPS data as reference)
    print("\n[2/4] Querying UPS weekly dates...")
    ups_rows = await db.execute_query("""
        SELECT DISTINCT DATE(effective_start) as date
        FROM fuel_surcharge_history
        WHERE carrier = 'UPS' AND market = 'DE'
        ORDER BY date ASC
    """)
    
    if not ups_rows:
        # Fallback to US UPS data if no Germany UPS data
        print("   ⚠ No UPS Germany data found, using US UPS data as fallback...")
        ups_rows = await db.execute_query("""
            SELECT DISTINCT DATE(effective_start) as date
            FROM fuel_surcharge_history
            WHERE carrier = 'UPS' AND market = 'US'
            ORDER BY date ASC
        """)
    
    weekly_dates = [row["date"] for row in ups_rows]
    print(f"   ✓ Found {len(weekly_dates)} UPS weekly dates")
    print(f"   Date range: {weekly_dates[0]} to {weekly_dates[-1]}")
    
    # Step 3: Compute DHL windows for each fuel category
    print("\n[3/4] Computing DHL weekly windows...")
    
    all_rows_to_insert = []
    
    for fuel_category in ["ground_domestic", "international_air_export", "international_air_import"]:
        print(f"\n   Processing {fuel_category}...")
        
        windows = compute_dhl_weekly_windows(weekly_dates, fuel_category)
        print(f"   ✓ Generated {len(windows)} weekly rows for {fuel_category}")
        
        # Show sample of windows for this category
        if windows:
            print(f"   Sample mappings:")
            # Group by DHL month to show summary
            by_month = {}
            for w in windows:
                month = w["dhl_month"]
                if month not in by_month:
                    by_month[month] = []
                by_month[month].append(w["date"])
            
            for month in sorted(by_month.keys()):
                dates = by_month[month]
                monthly_data = DHL_GERMANY_MONTHLY[fuel_category][month]
                print(f"      DHL {month} ({monthly_data['text']}): {len(dates)} weeks")
                print(f"         Dates: {dates[0]} to {dates[-1]}")
        
        # Determine service name based on category
        if fuel_category == "ground_domestic":
            service_name = "Express Road (Germany)"
            fuel_type = "Diesel"
            currency = "EUR"
        else:
            # Air services
            if fuel_category == "international_air_export":
                service_name = "International Air Export Surcharge"
            else:
                service_name = "International Air Import Surcharge"
            fuel_type = "USGC Jet Fuel"
            currency = "USD"
        
        # Prepare rows for insertion
        scraped_at = datetime.utcnow().isoformat()
        
        for window in windows:
            # Create effective_start as ISO datetime (using the date at midnight)
            effective_start = f"{window['date']}T00:00:00"
            
            row = {
                "carrier": "DHL",
                "service": service_name,
                "market": "DE",
                "currency": currency,
                "fuel_type": fuel_type,
                "fuel_category": fuel_category,
                "effective_start": effective_start,
                "effective_end": None,
                "value_text": window["value_text"],
                "value_numeric": window["surcharge"],
                "value_unit": "percent",
                "scraped_at": scraped_at,
            }
            all_rows_to_insert.append(row)
    
    # Step 4: Insert new rows
    print(f"\n[4/4] Inserting {len(all_rows_to_insert)} new DHL Germany weekly rows...")
    
    insert_query = """
        INSERT INTO fuel_surcharge_history
        (carrier, service, market, currency, fuel_type, fuel_category,
         effective_start, effective_end, value_text, value_numeric, value_unit, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    insert_params = [
        (
            row["carrier"],
            row["service"],
            row["market"],
            row["currency"],
            row["fuel_type"],
            row["fuel_category"],
            row["effective_start"],
            row["effective_end"],
            row["value_text"],
            row["value_numeric"],
            row["value_unit"],
            row["scraped_at"],
        )
        for row in all_rows_to_insert
    ]
    
    await db.execute_many(insert_query, insert_params)
    print(f"   ✓ Successfully inserted {len(all_rows_to_insert)} rows")
    
    # Verification: Show sample of what was inserted
    print("\n" + "=" * 80)
    print("VERIFICATION - Sample of inserted data:")
    print("=" * 80)
    
    verify_rows = await db.execute_query("""
        SELECT 
            DATE(effective_start) as date,
            fuel_category,
            value_text
        FROM fuel_surcharge_history
        WHERE carrier = 'DHL' AND market = 'DE'
        ORDER BY effective_start ASC, fuel_category
        LIMIT 20
    """)
    
    print(f"\nShowing first 20 rows (out of {len(all_rows_to_insert)} total):\n")
    current_category = None
    for row in verify_rows:
        if row["fuel_category"] != current_category:
            current_category = row["fuel_category"]
            print(f"\n{current_category}:")
        print(f"  {row['date']} | {row['value_text']}")
    
    print("\n" + "=" * 80)
    print("✅ DHL Germany weekly data rebuild complete!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(rebuild_dhl_germany_data())


