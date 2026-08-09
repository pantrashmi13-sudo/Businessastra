-- Migration: Add opening stock columns to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS opening_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_value NUMERIC(14,2) NOT NULL DEFAULT 0;
