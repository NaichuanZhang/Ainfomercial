// Reset the stage before recording the demo: clear chat, remove the seeded Diet Coke (so it
// can be created live in the console), requeue the rivals, and put the channel off air.
// Usage: node --env-file=.env.local scripts/reset-demo.mjs [--keep-diet-coke]
import { createAdminClient } from "@insforge/sdk";

const admin = createAdminClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  apiKey: process.env.INSFORGE_API_KEY,
});
const db = admin.database;
const keepDietCoke = process.argv.includes("--keep-diet-coke");

const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};

must(await db.from("chat_messages").delete().gte("id", 0), "clear chat");
must(
  await db
    .from("channel_state")
    .update({ airing_campaign_id: null, status: "offline", beat_index: 0, current_prompt: null, segment_started_at: null, segment_ends_at: null })
    .eq("id", "main"),
  "reset channel",
);
if (!keepDietCoke) {
  must(await db.from("campaigns").delete().eq("product_name", "Diet Coke"), "remove Diet Coke");
}
must(
  await db.from("campaigns").update({ status: "queued", spent: 0, airtime_seconds: 0 }).in("product_name", ["CloudStep Runner", "Glow Ramen", "Diet Coke"]),
  "requeue",
);
must(await db.from("campaigns").update({ bid_per_min: 22 }).eq("product_name", "CloudStep Runner"), "bid CloudStep");
must(await db.from("campaigns").update({ bid_per_min: 18 }).eq("product_name", "Glow Ramen"), "bid Glow");
console.log(
  "stage reset",
  must(await db.from("campaigns").select("product_name,bid_per_min,status").order("bid_per_min", { ascending: false }), "list"),
);
