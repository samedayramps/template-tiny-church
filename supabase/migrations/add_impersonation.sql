-- Create impersonation sessions table
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  impersonated_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  CONSTRAINT valid_duration CHECK (expires_at > created_at)
);

-- Enable RLS
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can create impersonation sessions
CREATE POLICY "Admins can manage impersonation sessions"
  ON public.impersonation_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Function to check if current session is impersonating
CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS TABLE (
  admin_id UUID,
  impersonated_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.admin_id,
    i.impersonated_id
  FROM impersonation_sessions i
  WHERE 
    i.admin_id = auth.uid()
    AND i.expires_at > now();
END;
$$; 