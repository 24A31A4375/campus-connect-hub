-- Create storage bucket for bonafide certificates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for certificates bucket
-- Only admins can upload certificates
CREATE POLICY "Admins can upload certificates"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'certificates' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Only admins can update certificates
CREATE POLICY "Admins can update certificates"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'certificates' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Only admins can delete certificates
CREATE POLICY "Admins can delete certificates"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'certificates' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Students can only view their own certificates (path contains their user id)
-- Admins and faculty can view all certificates
CREATE POLICY "Users can view authorized certificates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'certificates' 
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'faculty')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Create storage bucket for request documents if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('request-documents', 'request-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for request-documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'request-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own documents or staff can view all"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'request-documents' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'faculty')
  )
);

-- Add approved_by column to requests table if not exists
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Add approval_timestamp column to requests table if not exists  
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS approval_timestamp TIMESTAMP WITH TIME ZONE;