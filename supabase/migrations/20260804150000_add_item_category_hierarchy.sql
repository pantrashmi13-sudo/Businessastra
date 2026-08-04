-- Add category hierarchy columns to items
-- category: top-level classification
-- parent_category: parent group within category
-- sub_parent_category: sub-parent within parent
-- sub_category: leaf-level sub-classification
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS parent_category TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sub_parent_category TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- Add indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category);
CREATE INDEX IF NOT EXISTS idx_items_parent_category ON public.items (parent_category);
CREATE INDEX IF NOT EXISTS idx_items_sub_parent_category ON public.items (sub_parent_category);
CREATE INDEX IF NOT EXISTS idx_items_sub_category ON public.items (sub_category);
