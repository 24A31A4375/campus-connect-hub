-- =========================================
-- Fix: SUPA_anon/authenticated_security_definer_function_executable
-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- Trigger functions don't need PUBLIC/anon/authenticated grants (they run as trigger owner).
-- has_role and get_user_role are used inside RLS policies (also SECURITY DEFINER context), so
-- revoking direct EXECUTE from clients does not break RLS evaluation.
-- =========================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_request_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_timeline_entry() FROM PUBLIC, anon, authenticated;

-- Helper: get current user's department (SECURITY DEFINER to avoid RLS recursion on profiles)
CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_department_id() FROM PUBLIC, anon, authenticated;

-- =========================================
-- Fix: SUPA_pg_graphql_anon_table_exposed
-- Revoke SELECT from anon on all tables except `departments`, which the
-- signup form legitimately needs before authentication.
-- =========================================
REVOKE SELECT ON public.profiles          FROM anon;
REVOKE SELECT ON public.user_roles        FROM anon;
REVOKE SELECT ON public.requests          FROM anon;
REVOKE SELECT ON public.request_timeline  FROM anon;
REVOKE SELECT ON public.announcements     FROM anon;
REVOKE SELECT ON public.notifications     FROM anon;
-- keep: GRANT SELECT ON public.departments TO anon (needed by signup dropdown)

-- =========================================
-- Fix: SUPA_pg_graphql_authenticated_table_exposed
-- user_roles is only read internally via has_role() (SECURITY DEFINER).
-- Revoke direct authenticated access to hide it from the client/GraphQL surface.
-- =========================================
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
-- Drop the client-facing SELECT/INSERT policies since authenticated no longer has table privileges
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- =========================================
-- Fix: user_roles_self_insert_escalation
-- Even though authenticated no longer has direct INSERT, we ALSO harden RLS so any
-- future re-grant cannot be abused. Signup uses the SECURITY DEFINER handle_new_user
-- trigger which bypasses RLS, so this does not break registration.
-- =========================================
CREATE POLICY "Only admins can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- Fix: profiles_public_email_exposure
-- Drop the "view all profiles" policy that exposed every user's email/roll_no.
-- Replace with: self, admin (all), faculty (same department only).
-- =========================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Faculty can view department profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'faculty'::app_role)
  AND department_id = public.get_my_department_id()
);

-- =========================================
-- Fix: SUPA_rls_policy_always_true  +  notifications_open_insert
-- Replace "System can create notifications" (WITH CHECK true) with a scoped policy:
-- users may create notifications targeting themselves, and faculty/admin may create
-- notifications for anyone (needed for status-change + announcement fan-out).
-- =========================================
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Users can create own notifications, staff can create any"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'faculty'::app_role)
);

-- =========================================
-- Fix: request_documents_missing_delete_update
-- Add explicit UPDATE + DELETE policies for the 'request-documents' storage bucket
-- so only the owning uploader or an admin can modify/remove files.
-- =========================================
CREATE POLICY "Owners or admins can update request documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-documents'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'request-documents'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Owners or admins can delete request documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'request-documents'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);