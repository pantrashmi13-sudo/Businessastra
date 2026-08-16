-- Add is_inventory flag to items table to distinguish inventory items from other items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_inventory BOOLEAN NOT NULL DEFAULT true;

-- Existing items that are not services default to inventory items (is_inventory = true)
-- Services keep is_inventory = false conceptually, but the column defaults to true
-- The UI will filter by is_service first, then by is_inventory for non-service items
