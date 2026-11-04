import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const APP_NAME = "ID Press";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "Name tapes, pressed badges, and forum signatures for Eclipse roleplay." },
      { name: "theme-color", content: "#0a0c0e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: `${import.meta.env.BASE_URL}favicon.svg` },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Sans:wght@400;600;700&family=Libre+Baskerville:wght@700&family=Oswald:wght@500;700&family=Share+Tech+Mono&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
