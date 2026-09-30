import { TopBar } from "@/components/top-bar";

export default function ConsolePage() {
  return (
    <>
      <TopBar />
      <main className="page">
        <p className="eyebrow">Advertiser console</p>
        <h1>Buy airtime</h1>
        <p className="muted">Campaign upload and the live bid board are being wired up.</p>
      </main>
    </>
  );
}
