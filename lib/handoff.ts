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

/*
 * Handoff prompts follow the Orbis prompt guide: after the first prompt, never restate the world;
 * one physical action per prompt, given 2-4 s to land; new subjects enter through an action, and
 * a subject leaves only when a prompt says so.
 */

/** A product's visible description as a noun phrase, e.g. "a white knit-mesh running shoe ...". */
const lookPhrase = (look?: string | null) => {
  const described = (look ?? "").trim().replace(/[.\s]+$/, "");
  return described ? `a ${described.charAt(0).toLowerCase()}${described.slice(1)}` : "";
};

/** Step 1 of the handoff: the current product leaves the scene. */
export const putDownPrompt = (product: string) =>
  `The host lowers the ${product} down behind the counter, out of view.`;

/** Step 2, one landing later: an empty-handed beat that the next product enters from. */
export const EMPTY_HANDS_PROMPT = "The host rests both empty hands on the counter and smiles at the camera.";

/** How long after the put-down the empty-hands step is sent (one morph lands in 2-4 s). */
export const EMPTY_HANDS_AFTER_MS = 3_500;

/**
 * Step 3, the next segment's first prompt: the next product enters the same continuous take
 * through an action, named by what the camera sees (the model renders nouns, not brands).
 */
export const bringUpPrompt = (product: string, look?: string | null) => {
  const noun = lookPhrase(look);
  return noun
    ? `The host lifts the ${product}, ${noun}, up from behind the counter and holds it toward the camera.`
    : `The host lifts the ${product} up from behind the counter and holds it toward the camera.`;
};

/** Used when a product stays on air after being put down (the queue changed late). */
export const pickUpPrompt = (product: string) =>
  `The host lifts the ${product} back up from behind the counter and holds it toward the camera.`;

/**
 * The first prompt of a run (with the start frame): WHO + WHAT + WHERE + camera, under 100 words.
 * The lips-closed direction lives here once; following prompts do not restate it.
 */
export const openingPrompt = (hostLook: string, product: string, look?: string | null) => {
  const noun = lookPhrase(look) || `the ${product}`;
  return (
    `${hostLook.charAt(0).toUpperCase()}${hostLook.slice(1)} stands behind a glossy black studio counter under a warm spotlight, his lips gently closed in a warm smile, ` +
    `with ${noun} standing on a black display pedestal to his right. He reaches over to the pedestal and picks up the ${product}. ` +
    "Medium shot, eye-level, static camera, shallow depth of field."
  );
};

/** Scripted beats were written to stand alone; inside a running take the host needs no re-introduction. */
export const followingPrompt = (prompt: string) =>
  prompt.replace(/^The smiling host in the teal suit and gold tie\b/i, "The host").replace(/\s+/g, " ").trim();

/**
 * A run is refreshed (reset + new start frame, behind the seam cover) once it is this old, because
 * Orbis holds a scene best over its first few minutes. Product changes inside a run are continuous.
 */
export const RUN_REFRESH_MS = 5 * 60_000;

export const isHandoffBeat = (beatIndex: number | null | undefined) => beatIndex === HANDOFF_BEAT_INDEX;
