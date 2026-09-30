-- Orbis remains the sole video session. Host speech is pre-generated TTS aligned to scene beats.
ALTER TABLE public.campaigns
  ADD COLUMN host_lines jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (
    jsonb_typeof(host_lines) = 'array'
    AND jsonb_array_length(host_lines) <= 8
  );

-- This removes a now-unused prototype column if the first migration was already applied before
-- the design pivoted to one Orbis video session plus cached TTS.
ALTER TABLE public.channel_state
  DROP COLUMN IF EXISTS host_session_id;

-- Restore the channel publish trigger without the removed host-session field.
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
