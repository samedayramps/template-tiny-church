-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_active_impersonation();

-- Create the fixed function
CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  impersonated_id uuid,
  admin_email text,
  impersonated_email text,
  expires_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.admin_id,
    i.impersonated_id,
    admin.email as admin_email,
    impersonated.email as impersonated_email,
    i.expires_at
  FROM impersonation_sessions i
  JOIN profiles admin ON admin.id = i.admin_id
  JOIN profiles impersonated ON impersonated.id = i.impersonated_id
  WHERE i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1;
END;
$$; 