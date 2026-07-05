
-- 1) Announcements: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Users can view relevant announcements" ON public.announcements;
CREATE POLICY "Users can view relevant announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  is_global = true
  OR has_role(auth.uid(), 'admin'::app_role)
  OR department_id = (SELECT profiles.department_id FROM profiles WHERE profiles.id = auth.uid())
);

-- 2) user_roles: block self-insert/update/delete; only admin may modify
DROP POLICY IF EXISTS "Only admins can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;

CREATE POLICY "Only admins can assign roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) fee-receipts: allow faculty to view receipts for requests in their department
DROP POLICY IF EXISTS "Faculty can view department fee receipts" ON storage.objects;
CREATE POLICY "Faculty can view department fee receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fee-receipts'
  AND has_role(auth.uid(), 'faculty'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.receipt_url = storage.objects.name
      AND r.department_id = public.get_my_department_id()
  )
);

-- 4) Revoke discoverability from anon on sensitive tables; keep departments public for signup dropdown
REVOKE SELECT ON public.profiles, public.user_roles, public.requests, public.request_timeline, public.announcements, public.notifications FROM anon;

-- Revoke all authenticated privileges on user_roles (accessed only via has_role security definer)
REVOKE ALL ON public.user_roles FROM authenticated;
-- Re-grant minimal SELECT so admin policy still functions when queried directly by admins
GRANT SELECT ON public.user_roles TO authenticated;
