-- Add column to track if we have exact date or just month/year
ALTER TABLE fuel_curve_versions ADD COLUMN has_exact_date BOOLEAN DEFAULT 1;

-- Set has_exact_date = 0 for entries where we only know the month
-- DHL DE ground_domestic - we only know "June 2025"
UPDATE fuel_curve_versions 
SET has_exact_date = 0 
WHERE carrier = 'DHL' AND market = 'DE' AND fuel_category = 'ground_domestic' AND effective_date LIKE '2025-06%';

-- UPS DE ground_domestic - we only know "June 2025"  
UPDATE fuel_curve_versions 
SET has_exact_date = 0 
WHERE carrier = 'UPS' AND market = 'DE' AND fuel_category = 'ground_domestic' AND effective_date LIKE '2025-06%';

-- Verify the updates
SELECT id, carrier, market, fuel_category, effective_date, has_exact_date, label 
FROM fuel_curve_versions 
WHERE market = 'DE' AND fuel_category = 'ground_domestic';

