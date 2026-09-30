"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getBrowserClient, STATION_CHANNEL, VIEWERS_CHANNEL } from "@/lib/insforge";
import {
  type Campaign,
  CAMPAIGN_PUBLIC_COLUMNS,
  CHANNEL_PUBLIC_COLUMNS,
  type ChannelState,
  type ChatMessage,
} from "@/lib/station-types";

const CHAT_LIMIT = 80;

type CampaignEvent = Pick<
  Campaign,
  "id" | "brand" | "product_name" | "bid_per_min" | "budget" | "spent" | "status" | "image_url"
> & { op: string };

/**
 * Everything the channel page shows that is not video: channel state, the bid queue, chat and
 * the viewer count. Initial load over REST, then realtime deltas on `station:main`.
 */
export function useStation({ countViewers = false }: { countViewers?: boolean } = {}) {
  const [channel, setChannel] = useState<ChannelState | null>(null);
  const [campaigns, setCampaigns] = useState<Record<string, Campaign>>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const members = useRef(new Set<string>());

  useEffect(() => {
    const client = getBrowserClient();
    const db = client.database;
    const realtime = client.realtime;
    let cancelled = false;

    const loadCampaigns = async () => {
      const result = await db
        .from("campaigns")
        .select(CAMPAIGN_PUBLIC_COLUMNS)
        .order("bid_per_min", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (result.error) setError(result.error.message);
      else
        setCampaigns(
          Object.fromEntries(((result.data ?? []) as Campaign[]).map((c) => [c.id, c])),
        );
    };

    const load = async () => {
      const [state, messages] = await Promise.all([
        db.from("channel_state").select(CHANNEL_PUBLIC_COLUMNS).eq("id", "main").single(),
        db
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(CHAT_LIMIT),
      ]);
      if (cancelled) return;
      if (state.error) setError(state.error.message);
      else setChannel(state.data as ChannelState);
      if (!messages.error) setChat(((messages.data ?? []) as ChatMessage[]).reverse());
      await loadCampaigns();
    };

    const onChat = (payload: ChatMessage) => {
      setChat((current) =>
        current.some((m) => m.id === payload.id)
          ? current
          : [...current, payload].slice(-CHAT_LIMIT),
      );
    };
    const onState = (payload: ChannelState) => setChannel(payload);
    const onCampaign = (payload: CampaignEvent) => {
      setCampaigns((current) => {
        const existing = current[payload.id];
        // New campaigns arrive without their full row; fetch it once.
        if (!existing) {
          void loadCampaigns();
          return current;
        }
        return { ...current, [payload.id]: { ...existing, ...payload } };
      });
    };
    type Presence = { member: { presenceId: string }; meta: { channel: string } };
    const onJoin = ({ member, meta }: Presence) => {
      if (meta.channel !== VIEWERS_CHANNEL) return;
      members.current.add(member.presenceId);
      setViewers(members.current.size);
    };
    const onLeave = ({ member, meta }: Presence) => {
      if (meta.channel !== VIEWERS_CHANNEL) return;
      members.current.delete(member.presenceId);
      setViewers(members.current.size);
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    realtime.on("chat", onChat);
    realtime.on("state", onState);
    realtime.on("campaign", onCampaign);
    realtime.on("presence:join", onJoin);
    realtime.on("presence:leave", onLeave);
    realtime.on("connect", onConnect);
    realtime.on("disconnect", onDisconnect);

    void load();
    void (async () => {
      const response = await realtime.subscribe(STATION_CHANNEL);
      if (cancelled) return;
      if (!response.ok) {
        setError(response.error?.message ?? "Realtime subscribe failed");
        return;
      }
      setConnected(true);
      // Anything that changed between the REST load and the subscription.
      void load();
      // Only the channel page joins the viewers presence room, so console visitors don't count.
      if (countViewers) {
        const room = await realtime.subscribe(VIEWERS_CHANNEL);
        if (cancelled || !room.ok) return;
        members.current = new Set(room.presence.members.map((m) => m.presenceId));
        setViewers(members.current.size);
      }
    })();

    return () => {
      cancelled = true;
      realtime.off("chat", onChat);
      realtime.off("state", onState);
      realtime.off("campaign", onCampaign);
      realtime.off("presence:join", onJoin);
      realtime.off("presence:leave", onLeave);
      realtime.off("connect", onConnect);
      realtime.off("disconnect", onDisconnect);
      realtime.unsubscribe(STATION_CHANNEL);
      if (countViewers) realtime.unsubscribe(VIEWERS_CHANNEL);
    };
  }, [countViewers]);

  const airing = channel?.airing_campaign_id ? (campaigns[channel.airing_campaign_id] ?? null) : null;

  const queue = useMemo(
    () =>
      Object.values(campaigns)
        .filter((c) => c.status === "queued" && Number(c.spent) < Number(c.budget) && c.id !== airing?.id)
        .sort(
          (a, b) =>
            Number(b.bid_per_min) - Number(a.bid_per_min) ||
            a.created_at.localeCompare(b.created_at),
        ),
    [campaigns, airing?.id],
  );

  return { channel, campaigns, airing, queue, chat, viewers, connected, error };
}
