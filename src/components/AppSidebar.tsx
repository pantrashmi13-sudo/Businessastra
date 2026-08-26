import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

const masters = [
  { title: "Companies", url: "/masters/companies", icon: Building2 },
  { title: "Warehouses", url: "/masters/warehouses", icon: Building2 },
  { title: "Customers", url: "/masters/customers", icon: Users },
  { title: "Vendors", url: "/masters/vendors", icon: Truck },
  { title: "Inventory", url: "/masters/items", icon: Package },
  { title: "Fixed Assets", url: "/masters/fixed-assets", icon: Landmark },
  { title: "Assets Register", url: "/fixed-assets-register", icon: Calculator },
];

const bills = [
  { title: "All Bills", url: "/bills", icon: FileText },
  { title: "New Bill", url: "/bills/new", icon: Receipt },
  { title: "Purchase Returns", url: "/purchase-returns", icon: RotateCcw },
  { title: "Delivery Challans", url: "/challans", icon: Truck },
  { title: "Consumptions", url: "/consumptions", icon: PackageMinus },
  { title: "Sales Invoices", url: "/sales-invoices", icon: Receipt },
  { title: "Sales Returns", url: "/sales-returns", icon: Undo2 },
  { title: "VAT Register", url: "/vat-register", icon: Calculator },
];

const receiptPayment = [{ title: "Receipt & Payment", url: "/receipt-payment", icon: Banknote }];

const cashBank = [{ title: "Cash & Bank", url: "/cash-bank", icon: Wallet }];

const accounting = [
  { title: "Chart of Accounts", url: "/coa", icon: ListTree },
  { title: "Journal Entries", url: "/journal-entries", icon: ScrollText },
  { title: "General Ledger", url: "/general-ledger", icon: ClipboardList },
];

const system = [
  { title: "Knowledge Graph", url: "/knowledge-graph", icon: Network },
  { title: "AI Chat", url: "/chat", icon: MessageSquare },
];

// Nav item that collapses sidebar on click, shows tooltip when collapsed
function NavItem({
  item,
  isActive,
  onSelect,
  collapsed,
}: {
  item: { title: string; url: string; icon: React.ElementType };
  isActive: boolean;
  onSelect: () => void;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const btn = (
    <SidebarMenuButton asChild isActive={isActive}>
      <Link to={item.url} onClick={onSelect}>
        <Icon />
        <span>{item.title}</span>
      </Link>
    </SidebarMenuButton>
  );

  if (!collapsed) return <SidebarMenuItem>{btn}</SidebarMenuItem>;

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open, setOpen, isMobile, setOpenMobile } = useSidebar();

  const collapsed = !open;

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/login" });
  }

  // Called when user picks any menu item → collapse sidebar
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

  const navGroups = [
    { label: "Masters", items: masters },
    { label: "Bills & Purchase", items: bills },
    { label: "Receipt & Payment", items: receiptPayment },
    { label: "Cash & Bank", items: cashBank },
    { label: "Accounting", items: accounting },
    { label: "System", items: system },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <Sidebar
        collapsible="icon"
        onMouseEnter={handleMouseEnter}
      >
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
          <Link to="/" className="flex items-center gap-3 text-sidebar-foreground" onClick={handleNavSelect}>
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

        <SidebarContent>
          {/* Dashboard — always first */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem
                  item={{ title: "Dashboard", url: "/", icon: LayoutDashboard }}
                  isActive={pathname === "/"}
                  onSelect={handleNavSelect}
                  collapsed={collapsed}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((m) => (
                    <NavItem
                      key={m.url}
                      item={m}
                      isActive={isActive(m.url)}
                      onSelect={handleNavSelect}
                      collapsed={collapsed}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
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
