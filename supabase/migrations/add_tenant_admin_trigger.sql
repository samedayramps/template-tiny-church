-- Create a function to update admin's tenant_id
CREATE OR REPLACE FUNCTION public.handle_tenant_admin_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the admin's profile with the tenant_id
    UPDATE public.profiles 
    SET 
        tenant_id = NEW.id,
        updated_at = NOW()
    WHERE id = NEW.admin_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new tenants
CREATE TRIGGER on_tenant_created_or_updated
    AFTER INSERT OR UPDATE OF admin_id ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_tenant_admin_update(); 