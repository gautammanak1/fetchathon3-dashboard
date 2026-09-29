"use client"

import Link from "next/link"

import { FetchathonLogo } from "@/components/fetchathon-logo"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  QrCodeIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react"

const navMain = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "Registrations",
    url: "/dashboard/registrations",
    icon: <UsersRoundIcon />,
  },
  {
    title: "Teams",
    url: "/dashboard/teams",
    icon: <UsersIcon />,
  },
  {
    title: "RSVP & QR",
    url: "/dashboard/actions",
    icon: <QrCodeIcon />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-10 data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <FetchathonLogo />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
    </Sidebar>
  )
}
