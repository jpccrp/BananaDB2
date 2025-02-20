/*
  # Add full name to users

  1. Changes
    - Add full_name column to auth.users table
    - Create trigger to sync full_name from user metadata
    - Update existing users to populate full_name from metadata

  2. Notes
    - Preserves existing data
    - Maintains sync between metadata and column
    - Handles NULL values gracefully
*/

-- Add full_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'full_name'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN full_name text;
  END IF;
END $$;

-- Create function to extract full_name from raw_user_meta_data
CREATE OR REPLACE FUNCTION auth.sync_user_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Extract full_name from metadata and update the column
  NEW.full_name := (NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger to sync full_name on insert or update
DROP TRIGGER IF EXISTS sync_user_name ON auth.users;
CREATE TRIGGER sync_user_name
  BEFORE INSERT OR UPDATE OF raw_user_meta_data
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.sync_user_name();

-- Update existing users to populate full_name from metadata
UPDATE auth.users
SET full_name = raw_user_meta_data->>'full_name'
WHERE raw_user_meta_data->>'full_name' IS NOT NULL
  AND (full_name IS NULL OR full_name != raw_user_meta_data->>'full_name');