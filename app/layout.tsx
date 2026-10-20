import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { DemoBar } from "@/components/shell/demo-bar";
import { MobileHeader } from "@/components/shell/mobile-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_INIT_SCRIPT } from "@/components/theme/use-theme";

export const metadata: Metadata = {
  title: {
    default: "SlothSort",
    template: "%s · SlothSort",
  },
  description: "Drop the clutter. Let the sloth handle it.",
  applicationName: "SlothSort",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          // Applies the saved theme before paint to avoid a light flash.
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <TooltipProvider>
          <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
            <AppSidebar />
            <div className="flex min-h-dvh flex-col">
              <MobileHeader />
              <DemoBar />
              <main id="main-content" className="app-canvas flex-1">
                <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
