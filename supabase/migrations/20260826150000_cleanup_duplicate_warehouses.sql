-- Add is_main column to warehouses and enforce single main warehouse per company

-- 1. Add is_main column
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;

-- 2. Delete duplicate warehouses per company: keep only the oldest row with the same (company_id, LOWER(name))
DELETE FROM warehouses
WHERE id IN (
  SELECT w1.id
  FROM warehouses w1
  INNER JOIN warehouses w2
    ON w1.company_id = w2.company_id
    AND LOWER(TRIM(w1.name)) = LOWER(TRIM(w2.name))
    AND w1.created_at > w2.created_at
);

-- 3. Mark one warehouse per company as is_main (prefer name containing 'main', else oldest)
UPDATE warehouses SET is_main = true
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id
        ORDER BY
          CASE WHEN LOWER(name) LIKE '%main%' THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
    FROM warehouses
  ) sub
  WHERE rn = 1
);

-- 4. Ensure at most one is_main per company
UPDATE warehouses SET is_main = false
WHERE id IN (
  SELECT w1.id
  FROM warehouses w1
  INNER JOIN (
    SELECT DISTINCT ON (company_id) id
    FROM warehouses
    WHERE is_main = true
    ORDER BY company_id, created_at ASC
  ) keep ON w1.id != keep.id
  WHERE w1.is_main = true
);

-- 5. Verify result
SELECT company_id, name, is_main, id
FROM warehouses
ORDER BY company_id, created_at;
