-- A.Infomercial: campaigns (open-bid queue), live chat, singleton channel state.
-- Reads are public (anon); every write goes through the Next.js server routes with the admin key.

CREATE TABLE public.campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand            text NOT NULL CHECK (char_length(brand) BETWEEN 1 AND 60),
  product_name     text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 80),
  tagline          text CHECK (char_length(tagline) <= 140),
  image_url        text,
  image_key        text,
  price            text CHECK (char_length(price) <= 24),
  compare_at_price text CHECK (char_length(compare_at_price) <= 24),
  look             text CHECK (char_length(look) <= 400),
  taste            text CHECK (char_length(taste) <= 400),
  facts            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, value}], <= 12 items
  beats            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [scene prompt], <= 8 items
  audio_prompt     text CHECK (char_length(audio_prompt) <= 300),
  bid_per_min      numeric(10,2) NOT NULL DEFAULT 10 CHECK (bid_per_min > 0),
  budget           numeric(12,2) NOT NULL DEFAULT 500 CHECK (budget > 0),
  spent            numeric(12,2) NOT NULL DEFAULT 0 CHECK (spent >= 0),
  airtime_seconds  integer NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'airing', 'aired', 'paused')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX campaigns_queue_idx ON public.campaigns (status, bid_per_min DESC, created_at);

CREATE TABLE public.chat_messages (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author        text NOT NULL CHECK (char_length(author) BETWEEN 1 AND 32),
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  kind          text NOT NULL DEFAULT 'viewer' CHECK (kind IN ('viewer', 'host', 'system')),
  campaign_id   uuid REFERENCES public.campaigns (id) ON DELETE SET NULL,
  reply_to      bigint REFERENCES public.chat_messages (id) ON DELETE SET NULL,
  visual_prompt text CHECK (char_length(visual_prompt) <= 400),
  fact_label    text CHECK (char_length(fact_label) <= 60),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_recent_idx ON public.chat_messages (created_at DESC);

CREATE TABLE public.channel_state (
  id                  text PRIMARY KEY CHECK (id = 'main'),
  status              text NOT NULL DEFAULT 'offline'
                      CHECK (status IN ('offline', 'bumper', 'live')),
  session_id          text,
  director_id         text,
  lease_until         timestamptz,
  airing_campaign_id  uuid REFERENCES public.campaigns (id) ON DELETE SET NULL,
  segment_started_at  timestamptz,
  segment_ends_at     timestamptz,
  beat_index          integer NOT NULL DEFAULT 0,
  current_prompt      text,
  airtime_day         date NOT NULL DEFAULT current_date,
  airtime_seconds_day integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.channel_state (id) VALUES ('main');

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_touch BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER channel_state_touch BEFORE UPDATE ON public.channel_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Director lease: atomic claim/renew. Returns the row either way; caller compares director_id.
CREATE OR REPLACE FUNCTION public.claim_director(p_client text, p_ttl_seconds integer DEFAULT 15)
RETURNS public.channel_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.channel_state;
BEGIN
  UPDATE public.channel_state
     SET director_id = p_client,
         lease_until = now() + make_interval(secs => LEAST(GREATEST(p_ttl_seconds, 5), 60))
   WHERE id = 'main'
     AND (director_id = p_client OR lease_until IS NULL OR lease_until < now())
  RETURNING * INTO r;
  IF NOT FOUND THEN
    SELECT * INTO r FROM public.channel_state WHERE id = 'main';
  END IF;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_director(text, integer) FROM PUBLIC, anon, authenticated;

-- Access: public read, no client writes.
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_public_read ON public.campaigns
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY chat_public_read ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY channel_public_read ON public.channel_state
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.campaigns, public.chat_messages, public.channel_state
  FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.campaigns, public.chat_messages, public.channel_state TO anon, authenticated;

-- Realtime: one broadcast channel for the whole station.
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('station:%', 'A.Infomercial live channel: chat, channel state, queue', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description, enabled = EXCLUDED.enabled;

CREATE OR REPLACE FUNCTION public.publish_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM realtime.publish('station:main', 'chat', to_jsonb(NEW));
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_publish AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.publish_chat_message();

CREATE OR REPLACE FUNCTION public.publish_channel_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Lease heartbeats alone are not news.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
     AND NEW.airing_campaign_id IS NOT DISTINCT FROM OLD.airing_campaign_id
     AND NEW.beat_index IS NOT DISTINCT FROM OLD.beat_index
     AND NEW.current_prompt IS NOT DISTINCT FROM OLD.current_prompt
     AND NEW.segment_ends_at IS NOT DISTINCT FROM OLD.segment_ends_at THEN
    RETURN NEW;
  END IF;
  PERFORM realtime.publish('station:main', 'state', to_jsonb(NEW) - 'director_id');
  RETURN NEW;
END;
$$;

CREATE TRIGGER channel_state_publish AFTER UPDATE ON public.channel_state
  FOR EACH ROW EXECUTE FUNCTION public.publish_channel_state();

CREATE OR REPLACE FUNCTION public.publish_campaign_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM realtime.publish('station:main', 'campaign', jsonb_build_object(
    'id', NEW.id, 'brand', NEW.brand, 'product_name', NEW.product_name,
    'bid_per_min', NEW.bid_per_min, 'budget', NEW.budget, 'spent', NEW.spent,
    'status', NEW.status, 'image_url', NEW.image_url, 'op', TG_OP));
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_publish AFTER INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.publish_campaign_change();
