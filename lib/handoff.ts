/**
 * The on-air product handoff. Orbis only takes a new start frame after `reset` + `start`, so a
 * product change is a new run. To make it read as one continuous show, the director has the host
 * put the current product down before the segment ends, every viewer tab holds the last live
 * frame while the next run warms up, and the new run opens with the host picking the product up.
 *
 * Every start frame is the same studio plate (Max behind the counter, both hands resting on it,
 * the product standing on the black display pedestal on the right), so a segment that ends with
 * the pedestal empty and the hands on the counter matches the next segment's first frame.
 */

/** How long before `segment_ends_at` the put-down shot is sent (ahead of the 4 s no-prompt cutoff). */
export const HANDOFF_LEAD_MS = 8_000;
/** No new scripted beat this long before the put-down, so the picture is settled when it lands. */
export const HANDOFF_QUIET_MS = 2_000;
/**
 * `channel_state.beat_index` value that marks the handoff. The host strip speaks HANDOFF_LINE
 * instead of a script line; a campaign never has this many beats (<= 8).
 */
export const HANDOFF_BEAT_INDEX = 99;
/** One fixed line, so the cached TTS is generated exactly once for the whole channel. */
export const HANDOFF_LINE = "Let me set this one down, because you are not going to believe what's up next.";
/**
 * After `next_segment` flips the channel to `bumper`, viewers freeze on the frame that is showing
 * when the realtime event lands. Keep the old run alive this long before `reset` so that frame is
 * the empty-handed host, not a stalled stream.
 */
export const RESET_SETTLE_MS = 700;

/** Viewer-side seam cover: crossfade length back to the live picture. */
export const SEAM_FADE_MS = 600;
/** Without `requestVideoFrameCallback`, wait this long after `live` for the new run's frames. */
export const SEAM_SETTLE_MS = 500;
/** Longest a held frame stays up before the honest full-screen bumper takes over (director lost). */
export const SEAM_MAX_MS = 20_000;

export const putDownPrompt = (product: string) =>
  `The host places the ${product} down behind the counter, out of view, then rests both empty hands on the counter and smiles at the camera.`;

/**
 * Continuous handoff: the same Orbis run keeps going and the next product is brought into the
 * scene by an action (the prompt guide's way to introduce a new subject), so there is no reset,
 * no stall and no cut. `look` is the campaign's one-line visual description.
 */
export const bringUpPrompt = (product: string, look?: string | null) => {
  const described = (look ?? "").trim().replace(/[.\s]+$/, "");
  const detail = described ? ` The ${product} is a ${described.charAt(0).toLowerCase()}${described.slice(1)}.` : "";
  return `The host lifts the ${product} up from behind the counter and holds it toward the camera with a big closed-mouth grin.${detail}`;
};

/**
 * A run is refreshed (reset + new start frame, behind the seam cover) once it is this old, because
 * Orbis holds a scene best over its first few minutes. Product changes inside a run are continuous.
 */
export const RUN_REFRESH_MS = 5 * 60_000;

export const pickUpPrompt = (product: string) =>
  `The host reaches over to the black display pedestal on the right, picks up the ${product} and holds it up toward the camera with a big closed-mouth grin.`;

export const isHandoffBeat = (beatIndex: number | null | undefined) => beatIndex === HANDOFF_BEAT_INDEX;
