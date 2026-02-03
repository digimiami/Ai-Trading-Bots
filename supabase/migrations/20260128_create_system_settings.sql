-- Optional: global system_settings for admin kill switch (emergency_stop)
-- bot-executor checks system_settings.key = 'emergency_stop' and value = true to stop all trading.
-- If this table does not exist, bot-executor treats as "no global stop".

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'false',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'Global key-value settings (e.g. emergency_stop). Optional; bot-executor works without it.';

-- RLS: allow service role / authenticated read; restrict write to admins if you add policies later
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated and service"
  ON public.system_settings FOR SELECT
  TO authenticated, service_role
  USING (true);

-- Optional: insert default so row exists (value false = no global emergency stop)
INSERT INTO public.system_settings (key, value)
VALUES ('emergency_stop', 'false')
ON CONFLICT (key) DO NOTHING;
