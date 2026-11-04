import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Studio } from "@/components/studio/Studio";
import { decodeTemplate } from "@/lib/idpress/share";
import { completeDoc } from "@/lib/idpress/starter";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (location.hash.length < 3) return;
    const doc = decodeTemplate(location.hash.slice(1));
    if (!doc) return;
    const raw = localStorage.getItem("idpress.v2");
    const prev = raw ? (JSON.parse(raw) as { templates?: unknown; archive?: unknown; service?: string; tone?: string }) : {};
    localStorage.setItem(
      "idpress.v2",
      JSON.stringify({
        current: completeDoc(doc),
        templates: prev.templates ?? [],
        archive: prev.archive ?? [],
        service: prev.service ?? "pd",
        tone: prev.tone ?? "dark",
        fillOnly: false,
      }),
    );
    history.replaceState(null, "", location.pathname);
    setShared(true);
  }, []);

  return <Studio key={shared ? "shared" : "local"} />;
}
