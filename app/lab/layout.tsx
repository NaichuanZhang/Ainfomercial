import type { ReactNode } from "react";

import "./lab.css";

/** The original Orbis starter playground, kept for prompt tuning. */
export default function LabLayout({ children }: { children: ReactNode }) {
  return <div className="lab-root">{children}</div>;
}
