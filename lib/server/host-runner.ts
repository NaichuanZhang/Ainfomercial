import { answerQuestion, pickQuestion } from "@/lib/server/host-answer";
import { getAdminClient } from "@/lib/server/insforge-admin";
import { type Campaign, CAMPAIGN_PUBLIC_COLUMNS, type ChatMessage, HOST_NAME } from "@/lib/station-types";

/** Questions older than this are left alone: the moment has passed. */
const FRESH_MS = 60_000;

/**
 * Answer the best unanswered viewer question about the product on air, then check once more
 * for questions that arrived while the model was thinking. One runner at a time (DB lock).
 */
export async function runHostAnswers() {
  const db = getAdminClient().database;
  const claimed = await db.rpc("claim_host_answer", { p_seconds: 15 });
  if (claimed.error || claimed.data !== true) return;

  try {
    for (let round = 0; round < 2; round += 1) {
      const channel = await db.from("channel_state").select("airing_campaign_id,status").eq("id", "main").single();
      const airingId = (channel.data as { airing_campaign_id: string | null } | null)?.airing_campaign_id;
      if (!airingId) return;
      const campaignResult = await db.from("campaigns").select(CAMPAIGN_PUBLIC_COLUMNS).eq("id", airingId).limit(1);
      const campaign = (campaignResult.data?.[0] as Campaign | undefined) ?? null;
      if (!campaign) return;

      const since = new Date(Date.now() - FRESH_MS).toISOString();
      const recent = await db
        .from("chat_messages")
        .select("*")
        .gte("created_at", since)
        .order("id", { ascending: true })
        .limit(40);
      const messages = (recent.data ?? []) as ChatMessage[];
      // Anything already replied to (a host answer, or a silent "handled" marker) is done.
      const handled = new Set(messages.filter((m) => m.reply_to !== null).map((m) => m.reply_to));
      const question = pickQuestion(
        messages.filter((m) => !handled.has(m.id)),
        campaign,
      );
      if (!question) return;

      const answer = await answerQuestion(campaign, question.body, question.author);
      if (answer.kind === "ignore" || !answer.answer) {
        // Silent marker (hidden in the chat UI) so it isn't picked again.
        await db.from("chat_messages").insert([
          { author: HOST_NAME, body: "handled", kind: "system", campaign_id: campaign.id, reply_to: question.id },
        ]);
        continue;
      }
      await db.from("chat_messages").insert([
        {
          author: HOST_NAME,
          body: answer.answer.slice(0, 280),
          kind: "host",
          campaign_id: campaign.id,
          reply_to: question.id,
          visual_prompt: answer.kind === "answer" && answer.model !== "fallback" ? answer.visualPrompt : null,
          fact_label: answer.factLabel,
        },
      ]);
    }
  } finally {
    await db.rpc("release_host_answer");
  }
}
