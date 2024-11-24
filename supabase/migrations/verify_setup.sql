-- Function to verify database setup and permissions
CREATE OR REPLACE FUNCTION verify_user_roles_setup()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    result = jsonb_build_object(
        'tables', (
            SELECT jsonb_agg(jsonb_build_object(
                'table_name', table_name,
                'exists', true
            ))
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('user_roles')
        ),
        'foreign_keys', (
            SELECT jsonb_agg(jsonb_build_object(
                'constraint_name', tc.constraint_name,
                'column_name', kcu.column_name,
                'foreign_table', ccu.table_schema || '.' || ccu.table_name,
                'foreign_column', ccu.column_name
            ))
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'user_roles'
            AND tc.constraint_type = 'FOREIGN KEY'
        ),
        'policies', (
            SELECT jsonb_agg(jsonb_build_object(
                'table_name', tablename,
                'policy_name', policyname,
                'roles', roles,
                'cmd', cmd,
                'using_expr', qual
            ))
            FROM pg_policies
            WHERE tablename = 'user_roles'
        )
    );
    
    RETURN result;
END;
$$;

-- Call the function to check setup
SELECT verify_user_roles_setup(); 