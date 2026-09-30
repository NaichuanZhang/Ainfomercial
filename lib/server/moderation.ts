/**
 * Light chat moderation for a public demo: no links, no walls of repeated characters, and a
 * short list of slurs/profanity masked out. The host LLM is a second line of defence (it
 * deflects off-topic and abusive questions), and nothing a viewer types reaches the video
 * model unmediated.
 */

// Deliberately short and obvious; masked rather than rejected so chat keeps flowing.
const BLOCKED = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
];

const BLOCKED_RE = new RegExp(`\\b(${BLOCKED.join("|")})\\w*`, "gi");
const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|ru|gg|ly|co)\b\S*/gi;

export type Moderated = { text: string; changed: boolean; rejected?: string };

export function moderateChat(input: string): Moderated {
  let text = input.replace(/(.)\1{5,}/g, "$1$1$1");
  if (LINK_RE.test(text)) {
    LINK_RE.lastIndex = 0;
    return { text: "", changed: true, rejected: "Links aren't allowed in chat." };
  }
  const masked = text.replace(BLOCKED_RE, (word) => `${word[0]}${"*".repeat(Math.max(2, word.length - 1))}`);
  const changed = masked !== input;
  text = masked.trim();
  if (!/\p{L}|\p{N}|\p{Extended_Pictographic}/u.test(text)) {
    return { text: "", changed, rejected: "Message is empty" };
  }
  return { text, changed };
}

export function moderateHandle(input: string) {
  const { text, rejected } = moderateChat(input);
  return rejected ? "viewer" : text.replace(/\s+/g, "_").slice(0, 32) || "viewer";
}
