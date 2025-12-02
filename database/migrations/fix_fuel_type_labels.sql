-- Migration: Fix fuel_type labels to include proper source names and units
-- Date: 2024-12-01
-- 
-- This updates the fuel_type column in fuel_curve_versions to have consistent,
-- descriptive labels that include the fuel source and unit of measurement.

-- DHL DE ground_domestic: US Gulf Coast Diesel (converted from USD/gallon)
UPDATE fuel_curve_versions 
SET fuel_type = 'US Gulf Coast Diesel (USD/Gallon)'
WHERE carrier = 'DHL' 
  AND market = 'DE' 
  AND fuel_category = 'ground_domestic'
  AND fuel_type = 'Road';

-- DHL DE international_air_export: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'DHL' 
  AND market = 'DE' 
  AND fuel_category = 'international_air_export'
  AND fuel_type = 'Air';

-- DHL DE international_air_import: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'DHL' 
  AND market = 'DE' 
  AND fuel_category = 'international_air_import'
  AND fuel_type = 'Air';

-- UPS DE ground_domestic: European Commission Diesel (ECDG)
UPDATE fuel_curve_versions 
SET fuel_type = 'ECDG Diesel Fuel Price (EUR/Liter)'
WHERE carrier = 'UPS' 
  AND market = 'DE' 
  AND fuel_category = 'ground_domestic'
  AND fuel_type = 'Diesel Fuel Price';

-- UPS US domestic_air: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'UPS' 
  AND market = 'US' 
  AND fuel_category = 'domestic_air'
  AND fuel_type = 'jet_fuel';

-- FedEx US domestic_air: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'FedEx' 
  AND market = 'US' 
  AND fuel_category = 'domestic_air'
  AND fuel_type = 'jet_fuel';

-- UPS US international_air_export: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'UPS' 
  AND market = 'US' 
  AND fuel_category = 'international_air_export'
  AND fuel_type = 'jet_fuel';

-- UPS US international_air_import: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'UPS' 
  AND market = 'US' 
  AND fuel_category = 'international_air_import'
  AND fuel_type = 'jet_fuel';

-- FedEx US international_air_export: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'FedEx' 
  AND market = 'US' 
  AND fuel_category = 'international_air_export'
  AND fuel_type = 'jet_fuel';

-- FedEx US international_air_import: USGC Jet Fuel
UPDATE fuel_curve_versions 
SET fuel_type = 'USGC Jet Fuel Price (USD/Gallon)'
WHERE carrier = 'FedEx' 
  AND market = 'US' 
  AND fuel_category = 'international_air_import'
  AND fuel_type = 'jet_fuel';

-- UPS US ground_domestic: EIA Diesel
UPDATE fuel_curve_versions 
SET fuel_type = 'EIA Diesel Fuel Price (USD/Gallon)'
WHERE carrier = 'UPS' 
  AND market = 'US' 
  AND fuel_category = 'ground_domestic'
  AND fuel_type = 'Ground Domestic';

-- FedEx US ground_domestic: EIA Diesel
UPDATE fuel_curve_versions 
SET fuel_type = 'EIA Diesel Fuel Price (USD/Gallon)'
WHERE carrier = 'FedEx' 
  AND market = 'US' 
  AND fuel_category = 'ground_domestic'
  AND fuel_type = 'Ground';


