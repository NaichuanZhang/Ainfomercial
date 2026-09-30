-- The Orbis start frame: the product composited onto the studio set (falls back to image_url).
ALTER TABLE public.campaigns
  ADD COLUMN staged_image_url text,
  ADD COLUMN staged_image_key text;
