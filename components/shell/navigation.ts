import {
  Copy,
  FileClock,
  FolderSearch,
  LayoutDashboard,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Workspace overview",
    icon: LayoutDashboard,
  },
  {
    href: "/scan",
    label: "Folder scan",
    description: "Files and metadata",
    icon: FolderSearch,
  },
  {
    href: "/review",
    label: "Review",
    description: "Approve or reject",
    icon: ListChecks,
  },
  {
    href: "/duplicates",
    label: "Duplicates",
    description: "Exact matches",
    icon: Copy,
  },
  {
    href: "/history",
    label: "History",
    description: "Applied operations",
    icon: FileClock,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Local AI and privacy",
    icon: Settings,
  },
];
