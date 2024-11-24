-- Add metadata columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;

-- Update the trigger to handle metadata
CREATE OR REPLACE FUNCTION public.handle_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    role,
    raw_user_meta_data,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((SELECT role FROM user_roles WHERE id = NEW.id), 'user'::user_role),
    NEW.raw_user_meta_data,
    jsonb_build_object(
      'email', NEW.email,
      'created_at', NEW.created_at
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    metadata = EXCLUDED.metadata,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Update policies to reflect metadata access
CREATE POLICY "Users can read their own metadata"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all metadata"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  ); 