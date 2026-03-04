import { ThemeToggle } from "@/components/theme-toggle";
import { AppTopNav } from "@/components/app-top-nav";
import { usePageHeader } from "@/components/page-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UpdateAction } from "@/components/update-action";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { CommandMenu } from "@/components/command-menu";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { header } = usePageHeader();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <AppTopNav />
          </div>
          
          <div className="flex flex-1 items-center justify-center max-w-md mx-auto">
            <CommandMenu />
          </div>

          <div className="flex items-center gap-2">
            <UpdateAction />
            {header ? <div className="hidden lg:block">{header}</div> : null}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden relative">
          <div className="h-full w-full p-4 md:p-6 lg:p-8 overflow-hidden flex flex-col">
            {children}
          </div>
        </main>

      </SidebarInset>
    </SidebarProvider>
  );
}
