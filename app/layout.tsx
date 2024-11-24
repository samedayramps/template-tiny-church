import { ThemeProvider } from "next-themes";
import { GeistSans } from "geist/font/sans";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import { ImpersonationWrapper } from "@/components/layouts/impersonation-wrapper";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Focus on your calling",
  description: "We provide small churches with a simple, all-in-one platform that handles their complete digital presence, so pastors can focus on ministry instead of managing technology.",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        href: "/favicon.png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ImpersonationWrapper>
            <div className="flex flex-col min-h-screen">
              <SiteHeader />
              <main className="flex-grow">
                {children}
              </main>
            </div>
          </ImpersonationWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
