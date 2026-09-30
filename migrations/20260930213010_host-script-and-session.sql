-- The on-air AI host: a spoken infomercial script per campaign.
ALTER TABLE public.campaigns
  ADD COLUMN host_script text CHECK (char_length(host_script) <= 1200);
