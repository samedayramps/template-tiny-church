-- Allow authenticated users to read auth.users emails
CREATE POLICY "Allow authenticated users to read emails"
ON auth.users
FOR SELECT
USING (
  -- Only allow access to email field for authenticated users
  auth.role() = 'authenticated'
);

-- Enable RLS on auth.users
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON auth.users TO authenticated; 