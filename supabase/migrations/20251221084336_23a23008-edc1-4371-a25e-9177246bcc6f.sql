-- Add fee_sub_category column to requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS fee_sub_category TEXT;

-- Create fee-receipts storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fee-receipts', 'fee-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for fee-receipts bucket
-- Students can upload their own receipts
CREATE POLICY "Students can upload fee receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fee-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Students can view their own receipts
CREATE POLICY "Students can view own fee receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fee-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Faculty can view receipts from their department students
CREATE POLICY "Faculty can view department fee receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fee-receipts'
  AND public.has_role(auth.uid(), 'faculty')
);

-- Admins have full access to fee receipts
CREATE POLICY "Admins have full access to fee receipts"
ON storage.objects FOR ALL
USING (
  bucket_id = 'fee-receipts'
  AND public.has_role(auth.uid(), 'admin')
);

-- Add receipt_url column for fee receipts (separate from general document_url)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS receipt_url TEXT;