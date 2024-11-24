-- Verify current profiles structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles';

-- Add any missing columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user'::user_role;

-- Update RLS policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create secure policies
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Update trigger to sync role from user_roles
CREATE OR REPLACE FUNCTION public.handle_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(
      (SELECT role FROM user_roles WHERE id = NEW.id),
      'user'::user_role
    )
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to sync role changes
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    role = NEW.role,
    updated_at = timezone('utc'::text, now())
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role updates
DROP TRIGGER IF EXISTS on_user_role_updated ON user_roles;
CREATE TRIGGER on_user_role_updated
  AFTER UPDATE OF role ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role();

-- Ensure the auth.users trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW 
      EXECUTE FUNCTION public.handle_user_profile();
  END IF;
END
$$;

-- Sync existing data
INSERT INTO public.profiles (id, email, role, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(ur.role, 'user'::user_role),
  COALESCE(ur.updated_at, timezone('utc'::text, now()))
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.id
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = EXCLUDED.updated_at;
  