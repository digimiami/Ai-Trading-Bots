-- Add forward_to column to mailboxes table for email forwarding
ALTER TABLE public.mailboxes 
ADD COLUMN IF NOT EXISTS forward_to TEXT;

-- Add comment
COMMENT ON COLUMN public.mailboxes.forward_to IS 'Email address to forward all inbound emails to (optional)';


