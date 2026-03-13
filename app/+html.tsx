import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* iOS PWA icon — Safari reads this, not the web manifest */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* iOS PWA — black status bar so no white line */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Baliyo" />

        {/* Theme color for Android PWA chrome */}
        <meta name="theme-color" content="#0A0A0B" />

        <ScrollViewStyleReset />

        {/* Prevent white flash behind transparent iOS PWA status bar */}
        <style>{`html,body{background-color:#0A0A0B;}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
