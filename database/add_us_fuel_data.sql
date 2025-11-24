-- Manual Addition of US Fuel Curve Data
-- Date: 2025-11-23
-- Description: Adding UPS and FedEx US fuel surcharge data for various service types

BEGIN TRANSACTION;

-- Create a new scrape session for this manual data entry
INSERT INTO scrape_sessions (timestamp, status, carriers_scraped, total_rows, notes)
VALUES (
    datetime('now'),
    'success',
    '["UPS", "FedEx"]',
    0, -- Will be updated at the end
    'Manual data entry for US fuel curves - UPS Domestic Air, UPS International Air (Export/Import), FedEx Domestic Air, FedEx International Air (Export/Import), FedEx Ground (current and pre-June 9 version)'
);

-- Get the session_id for use in subsequent inserts
-- SQLite will use last_insert_rowid() for this

-- ============================================================================
-- FUEL CURVE VERSIONS
-- ============================================================================

-- 1. UPS US Domestic Air
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'UPS',
    'Domestic Air',
    'US',
    'domestic_air_freight',
    'jet_fuel',
    datetime('now'),
    'Fuel curve (effective Nov 23, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    1
);

-- 2. UPS US International Air Export
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'UPS',
    'International Air Export',
    'US',
    'international_air_export',
    'jet_fuel',
    datetime('now'),
    'Fuel curve (effective Nov 23, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    1
);

-- 3. UPS US International Air Import
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'UPS',
    'International Air Import',
    'US',
    'international_air_import',
    'jet_fuel',
    datetime('now'),
    'Fuel curve (effective Nov 23, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    1
);

-- 4. FedEx US Domestic Air
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'FedEx',
    'Domestic Air',
    'US',
    'domestic_air_freight',
    'jet_fuel',
    datetime('now'),
    'Fuel curve (effective Nov 23, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    1
);

-- 5. FedEx US International Air Export
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'FedEx',
    'International Air Export',
    'US',
    'international_air_export',
    'jet_fuel',
    datetime('now'),
    'Fuel curve (effective Nov 23, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    1
);

-- 6. FedEx US International Air Import
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'FedEx',
    'International Air Import',
    'US',
    'international_air_import',
    'jet_fuel',
    datetime('now'),
    'Fuel curve (effective Nov 23, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    1
);

-- 7. FedEx US Ground Domestic - PRE JUNE 9 VERSION (Historical)
INSERT INTO fuel_curve_versions (carrier, service, market, fuel_category, fuel_type, effective_date, label, session_id, is_active)
VALUES (
    'FedEx',
    'Ground',
    'US',
    'ground_domestic',
    'general',
    '2025-02-10',
    'Pre-June 9 fuel curve (effective Feb 10, 2025)',
    (SELECT MAX(id) FROM scrape_sessions),
    0  -- Not active, historical version
);

-- ============================================================================
-- FUEL SURCHARGE DATA
-- ============================================================================

-- UPS DOMESTIC AIR (15 rows)
-- Based on USGC Jet Fuel Price
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 1.64, 1.85, 18.50, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 1.85, 2.06, 18.75, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.06, 2.11, 19.00, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.11, 2.16, 19.25, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.16, 2.21, 19.50, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.21, 2.26, 19.75, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.26, 2.31, 20.00, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.31, 2.36, 20.25, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.36, 2.41, 20.50, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.41, 2.46, 20.75, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.46, 2.51, 21.00, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.51, 2.56, 21.25, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.56, 2.61, 21.50, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.61, 2.66, 21.75, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'Domestic Air', 'US', 'USD', 2.66, 2.71, 22.00, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1));

-- UPS INTERNATIONAL AIR EXPORT (15 rows)
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.03, 2.07, 24.25, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.07, 2.11, 24.50, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.11, 2.15, 24.75, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.15, 2.19, 25.00, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.19, 2.23, 25.25, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.23, 2.27, 25.50, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.27, 2.31, 25.75, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.31, 2.35, 26.00, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.35, 2.39, 26.25, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.39, 2.43, 26.50, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.43, 2.47, 26.75, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.47, 2.51, 27.00, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.51, 2.55, 27.25, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.55, 2.59, 27.50, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Export', 'US', 'USD', 2.59, 2.63, 27.75, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1));

-- UPS INTERNATIONAL AIR IMPORT (15 rows)
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.03, 2.07, 28.00, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.07, 2.11, 28.25, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.11, 2.15, 28.50, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.15, 2.19, 28.75, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.19, 2.23, 29.00, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.23, 2.27, 29.25, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.27, 2.31, 29.50, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.31, 2.35, 29.75, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.35, 2.39, 30.00, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.39, 2.43, 30.25, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.43, 2.47, 30.50, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.47, 2.51, 30.75, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.51, 2.55, 31.00, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.55, 2.59, 31.25, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'UPS', 'International Air Import', 'US', 'USD', 2.59, 2.63, 31.50, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='UPS' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1));

-- FEDEX DOMESTIC AIR (7 rows)
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.11, 2.16, 19.25, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.16, 2.21, 19.50, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.21, 2.26, 19.75, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.26, 2.31, 20.00, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.31, 2.36, 20.25, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.36, 2.41, 20.50, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Domestic Air', 'US', 'USD', 2.41, 2.46, 20.75, datetime('now'), 'jet_fuel', 'domestic_air_freight', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='domestic_air_freight' ORDER BY id DESC LIMIT 1));

-- FEDEX INTERNATIONAL AIR EXPORT (7 rows)
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.15, 2.19, 25.00, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.19, 2.23, 25.25, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.23, 2.27, 25.50, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.27, 2.31, 25.75, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.31, 2.35, 26.00, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.35, 2.39, 26.25, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Export', 'US', 'USD', 2.39, 2.43, 26.50, datetime('now'), 'jet_fuel', 'international_air_export', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_export' ORDER BY id DESC LIMIT 1));

-- FEDEX INTERNATIONAL AIR IMPORT (7 rows)
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.15, 2.19, 28.75, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.19, 2.23, 29.00, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.23, 2.27, 29.25, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.27, 2.31, 29.50, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.31, 2.35, 29.75, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.35, 2.39, 30.00, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'International Air Import', 'US', 'USD', 2.39, 2.43, 30.25, datetime('now'), 'jet_fuel', 'international_air_import', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='international_air_import' ORDER BY id DESC LIMIT 1));

-- FEDEX GROUND DOMESTIC - PRE JUNE 9 VERSION (13 rows)
-- Effective from February 10, 2025 (Historical Version)
-- Note: This version has an inflection point around $3.55
INSERT INTO fuel_surcharges (session_id, carrier, service, market, currency, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at, fuel_type, fuel_category, curve_version_id)
VALUES
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 2.29, 2.47, 16.25, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 2.47, 2.65, 16.50, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 2.65, 2.83, 16.75, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 2.83, 3.01, 17.00, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.01, 3.19, 17.25, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.19, 3.37, 17.50, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.37, 3.55, 17.75, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.55, 3.64, 18.00, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.64, 3.73, 18.25, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.73, 3.82, 18.50, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.82, 3.91, 18.75, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 3.91, 4.00, 19.00, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1)),
((SELECT MAX(id) FROM scrape_sessions), 'FedEx', 'Ground', 'US', 'USD', 4.00, 4.09, 19.25, datetime('now'), 'general', 'ground_domestic', (SELECT id FROM fuel_curve_versions WHERE carrier='FedEx' AND market='US' AND fuel_category='ground_domestic' AND label LIKE '%Pre-June 9%' ORDER BY id DESC LIMIT 1));

-- Update the session with the total row count
UPDATE scrape_sessions 
SET total_rows = (
    SELECT COUNT(*) 
    FROM fuel_surcharges 
    WHERE session_id = (SELECT MAX(id) FROM scrape_sessions)
)
WHERE id = (SELECT MAX(id) FROM scrape_sessions);

COMMIT;

-- Verification queries
SELECT 'Session created:' as info, id, timestamp, status, total_rows FROM scrape_sessions WHERE id = (SELECT MAX(id) FROM scrape_sessions);
SELECT 'Fuel curve versions created:' as info, COUNT(*) as count FROM fuel_curve_versions WHERE session_id = (SELECT MAX(id) FROM scrape_sessions);
SELECT 'Fuel surcharges inserted:' as info, COUNT(*) as count FROM fuel_surcharges WHERE session_id = (SELECT MAX(id) FROM scrape_sessions);
SELECT 'Breakdown by carrier and fuel_category:' as info;
SELECT carrier, fuel_category, COUNT(*) as count 
FROM fuel_surcharges 
WHERE session_id = (SELECT MAX(id) FROM scrape_sessions)
GROUP BY carrier, fuel_category
ORDER BY carrier, fuel_category;


