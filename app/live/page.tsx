import { TopBar } from "@/components/top-bar";

export default function LivePage() {
  return (
    <>
      <TopBar live={false} />
      <main className="page">
        <p className="eyebrow">Channel</p>
        <h1>Coming up next…</h1>
        <p className="muted">The live channel is being wired up.</p>
      </main>
    </>
  );
}
