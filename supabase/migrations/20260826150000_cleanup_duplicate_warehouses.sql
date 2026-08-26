-- Add is_main column to warehouses and enforce single main warehouse per company

-- 1. Add is_main column
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;

-- 2. Cleanup duplicate warehouses: keep only the oldest "Main Warehouse" per company
DELETE FROM warehouses
WHERE id IN (
  SELECT w1.id
  FROM warehouses w1
  INNER JOIN warehouses w2
    ON w1.company_id = w2.company_id
    AND LOWER(w1.name) = LOWER(w2.name)
    AND w1.created_at > w2.created_at
  WHERE LOWER(w1.name) = 'main warehouse'
);

-- 3. Mark surviving Main Warehouse as is_main
UPDATE warehouses SET is_main = true
WHERE LOWER(name) = 'main warehouse'
  AND id IN (
    SELECT DISTINCT ON (company_id) id
    FROM warehouses
    WHERE LOWER(name) = 'main warehouse'
    ORDER BY company_id, created_at ASC
  );

-- 4. Ensure only one is_main per company
UPDATE warehouses SET is_main = false
WHERE id IN (
  SELECT w1.id
  FROM warehouses w1
  INNER JOIN warehouses w2
    ON w1.company_id = w2.company_id
    AND w2.is_main = true
    AND w1.id != w2.id
  WHERE w1.is_main = true
);
