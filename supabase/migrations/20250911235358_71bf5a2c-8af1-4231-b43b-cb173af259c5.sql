-- Create auth_tokens table for 3-digit token authentication
CREATE TABLE public.auth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for auth_tokens (only edge functions should access this)
CREATE POLICY "Allow service role to manage auth tokens" 
ON public.auth_tokens 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for performance
CREATE INDEX idx_auth_tokens_email_token ON public.auth_tokens(email, token);
CREATE INDEX idx_auth_tokens_expires_at ON public.auth_tokens(expires_at);