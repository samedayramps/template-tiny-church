-- Check RLS policies for user_roles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'user_roles';

-- Add RLS policy if needed
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read user_roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (true);

-- Enable RLS if not already enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY; 