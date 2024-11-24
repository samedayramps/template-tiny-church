-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to read user emails" ON auth.users;

-- Create new policy with correct schema reference
CREATE POLICY "Allow authenticated users to read user emails"
    ON auth.users
    FOR SELECT
    TO authenticated
    USING (true);

-- Ensure RLS is enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated; 