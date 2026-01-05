-- Fix tracking code generation to exclude ambiguous characters
-- This prevents confusion between O/0, I/1, l/1, etc.

CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  -- Exclude ambiguous characters: O, 0, I, 1, l (lowercase L)
  -- Keep: A-H, J-N, P-Z (uppercase), a-k, m-z (lowercase), 2-9 (numbers)
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  
  -- Ensure uniqueness (case-insensitive check)
  WHILE EXISTS (
    SELECT 1 FROM public.tracking_urls 
    WHERE LOWER(short_code) = LOWER(result)
  ) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Make short_code queries case-insensitive by default
-- This helps with existing codes that might have ambiguous characters

COMMENT ON FUNCTION public.generate_tracking_code() IS 
'Generates a unique 8-character tracking code excluding ambiguous characters (O, 0, I, 1, l)';

