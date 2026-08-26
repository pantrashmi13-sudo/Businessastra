import { Link, useRouterState, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Truck,
  Package,
  Landmark,
  FileText,
  LayoutDashboard,
  Receipt,
  BookOpen,
  LogOut,
  Calculator,
  Banknote,
  Wallet,
  PackageMinus,
  RotateCcw,
  Undo2,
  ListTree,
  ScrollText,
  ClipboardList,
  Network,
  MessageSquare,
  Settings,
  ChevronRight,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const navigationSections = [
  {
    title: "General",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", url: "/" }
    ]
  },
  {
    title: "Masters",
    icon: Building2,
    items: [
      { title: "Companies", url: "/masters/companies" },
      { title: "Warehouses", url: "/masters/warehouses" },
      { title: "Customers", url: "/masters/customers" },
      { title: "Vendors", url: "/masters/vendors" },
      { title: "Inventory", url: "/masters/items" },
      { title: "Fixed Assets", url: "/masters/fixed-assets" },
    ]
  },
  {
    title: "Bills & Purchase",
    icon: FileText,
    items: [
      { title: "All Bills", url: "/bills" },
      { title: "New Bill", url: "/bills/new" },
      { title: "Purchase Returns", url: "/purchase-returns" },
    ]
  },
  {
    title: "Sales & Delivery",
    icon: Truck,
    items: [
      { title: "Delivery Challans", url: "/challans" },
      { title: "Consumptions", url: "/consumptions" },
      { title: "Sales Invoices", url: "/sales-invoices" },
      { title: "Sales Returns", url: "/sales-returns" },
    ]
  },
  {
    title: "Receipt & Payment",
    icon: Banknote,
    items: [
      { title: "Receipt & Payment", url: "/receipt-payment" }
    ]
  },
  {
    title: "Cash & Bank",
    icon: Wallet,
    items: [
      { title: "Cash & Bank", url: "/cash-bank" }
    ]
  },
  {
    title: "Accounting",
    icon: Calculator,
    items: [
      { title: "Chart of Accounts", url: "/coa" },
      { title: "Journal Entries", url: "/journal-entries" },
      { title: "General Ledger", url: "/general-ledger" },
    ]
  },
  {
    title: "Reports",
    icon: BookOpen,
    items: [
      { title: "Assets Register", url: "/fixed-assets-register" },
      { title: "VAT Register", url: "/vat-register" },
    ]
  },
  {
    title: "System",
    icon: Settings,
    items: [
      { title: "Knowledge Graph", url: "/knowledge-graph" },
      { title: "AI Chat", url: "/chat" },
    ]
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open, setOpen, isMobile, setOpenMobile } = useSidebar();
  
  // Accordion state: store the title of the currently expanded section
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  const collapsed = !open;

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  // Auto-expand section based on current route on mount/navigation
  useEffect(() => {
    for (const section of navigationSections) {
      if (section.items.some(item => isActive(item.url))) {
        setExpandedSection(section.title);
        break;
      }
    }
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/login" });
  }

  // Called when user picks any child menu item → collapse sidebar (into rail mode)
  function handleNavSelect() {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  }

  // Expand sidebar when user hovers over the collapsed rail (desktop only)
  function handleMouseEnter() {
    if (!isMobile && !open) {
      setOpen(true);
    }
  }

  function handleSectionClick(sectionTitle: string) {
    if (collapsed && !isMobile) {
      // If we're clicking a section while sidebar is in icon mode, expand the sidebar and open that section
      setOpen(true);
      setExpandedSection(sectionTitle);
    } else {
      // Toggle accordion
      setExpandedSection(prev => prev === sectionTitle ? null : sectionTitle);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Sidebar
        collapsible="icon"
        onMouseEnter={handleMouseEnter}
      >
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center">
          <Link 
            to="/" 
            className="flex items-center gap-3 text-sidebar-foreground group-data-[collapsible=icon]:justify-center" 
            onClick={handleNavSelect}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
              <img
                src="/bizastra-logo.png"
                alt="Bizastra Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-base font-bold text-primary tracking-tight">BIZASTRA</span>
              <span className="text-[10px] text-sidebar-foreground/60 tracking-wider">
                STRATEGY. ELEVATION. GROWTH.
              </span>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-2">
          <SidebarMenu>
            {navigationSections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSection === section.title;
              const hasActiveChild = section.items.some(item => isActive(item.url));
              
              return (
                <Collapsible
                  key={section.title}
                  open={isExpanded}
                  onOpenChange={(isOpen) => setExpandedSection(isOpen ? section.title : null)}
                  asChild
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      tooltip={section.title}
                      className="w-full font-medium" 
                      isActive={hasActiveChild && !isExpanded}
                      onClick={() => handleSectionClick(section.title)}
                    >
                      <Icon />
                      <span>{section.title}</span>
                      <ChevronRight 
                        className={`ml-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden ${isExpanded ? "rotate-90" : ""}`} 
                      />
                    </SidebarMenuButton>
                    
                    <CollapsibleContent>
                      <SidebarMenuSub className="mr-0 pr-0">
                        {section.items.map((item) => (
                          <SidebarMenuSubItem key={item.url}>
                            <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                              <Link to={item.url} onClick={handleNavSelect}>
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold uppercase cursor-default">
                  {user?.email?.[0] ?? "U"}
                </div>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  {user?.email ?? "User"}
                </TooltipContent>
              )}
            </Tooltip>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-medium truncate text-sidebar-foreground">
                {user?.email ?? "User"}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  Sign out
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
