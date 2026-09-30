-- One host answer at a time: a short lock so concurrent chat posts don't all call the LLM.
ALTER TABLE public.channel_state ADD COLUMN host_lock_until timestamptz;

CREATE OR REPLACE FUNCTION public.claim_host_answer(p_seconds integer DEFAULT 12)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.channel_state
     SET host_lock_until = now() + make_interval(secs => LEAST(GREATEST(p_seconds, 2), 30))
   WHERE id = 'main' AND (host_lock_until IS NULL OR host_lock_until < now());
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_host_answer()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.channel_state SET host_lock_until = NULL WHERE id = 'main';
$$;

REVOKE ALL ON FUNCTION public.claim_host_answer(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_host_answer() FROM PUBLIC, anon, authenticated;
