-- Allow authenticated users to read auth.users emails
CREATE POLICY "Allow authenticated users to read user emails"
    ON auth.users
    FOR SELECT
    TO authenticated
    USING (true);

-- Verify RLS is enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY; 