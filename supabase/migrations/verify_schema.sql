-- Run this query in Supabase SQL editor to verify the schema
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name IN ('user_roles', 'auth.users')
ORDER BY 
  table_name, ordinal_position;

-- Check if there's any data
SELECT COUNT(*) as user_count FROM auth.users;
SELECT COUNT(*) as role_count FROM user_roles;

-- Check join
SELECT 
  ur.id,
  ur.role,
  ur.updated_at,
  au.email
FROM 
  user_roles ur
  LEFT JOIN auth.users au ON ur.id = au.id
LIMIT 5; 