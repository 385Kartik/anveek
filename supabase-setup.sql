-- ================================================================
-- Supabase Schema for Anveek Groundnut Oil Order App
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- ================================================================

-- 1. Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone1 text NOT NULL,
  phone2 text,
  address text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Grant table permissions to roles
GRANT ALL ON public.orders TO postgres, anon, authenticated, service_role;

-- 4. Drop existing policies if any to avoid duplicate policy errors
DROP POLICY IF EXISTS "Allow public insert" ON public.orders;
DROP POLICY IF EXISTS "Allow service_role full access" ON public.orders;
DROP POLICY IF EXISTS "Allow anon read and update" ON public.orders;

-- 5. Policies
-- Allow anyone to place an order (Insert)
CREATE POLICY "Allow public insert" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow service_role complete access (Admin)
CREATE POLICY "Allow service_role full access" ON public.orders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon read & update (allows local admin access even before service_role key is added)
CREATE POLICY "Allow anon read and update" ON public.orders
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Optional: Enable realtime for orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
