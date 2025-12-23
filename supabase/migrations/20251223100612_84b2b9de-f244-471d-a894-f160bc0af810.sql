-- Add tuition_type column for Tuition Fees sub-category (Fee Reimbursement / Non-Fee Reimbursement)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS tuition_type TEXT;

-- Add receipt_required column to track if receipt is needed
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS receipt_required BOOLEAN DEFAULT true;

-- Add receipt_uploaded_by to track who uploaded the receipt (admin)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS receipt_uploaded_by UUID REFERENCES public.profiles(id);

-- Add receipt_uploaded_at timestamp
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for tuition_type values
ALTER TABLE public.requests ADD CONSTRAINT tuition_type_check 
  CHECK (tuition_type IS NULL OR tuition_type IN ('fee_reimbursement', 'non_fee_reimbursement'));

-- Update storage policies for fee-receipts bucket to allow admin uploads
-- First drop existing policies and recreate them

DROP POLICY IF EXISTS "Students can upload own fee receipts" ON storage.objects;
DROP POLICY IF EXISTS "Students can view own fee receipts" ON storage.objects;
DROP POLICY IF EXISTS "Faculty can view department fee receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view all fee receipts" ON storage.objects;

-- Admin can upload fee receipts
CREATE POLICY "Admin can upload fee receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fee-receipts' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admin can update fee receipts
CREATE POLICY "Admin can update fee receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fee-receipts' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Students can view their own fee receipts (from their requests)
CREATE POLICY "Students can view own fee receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fee-receipts'
  AND (
    -- Admin can view all
    public.has_role(auth.uid(), 'admin')
    OR
    -- Student can view if the path starts with their id or if they own the request
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.receipt_url = name
      AND r.student_id = auth.uid()
    )
  )
);

-- Admin can view all fee receipts
CREATE POLICY "Admin can view all fee receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fee-receipts' 
  AND public.has_role(auth.uid(), 'admin')
);