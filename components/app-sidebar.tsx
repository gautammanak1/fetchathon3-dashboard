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
import { useAuth } from "@/hooks/use-auth"
import {
  AwardIcon,
  LayoutDashboardIcon,
  MailCheckIcon,
  MailIcon,
  MessageSquareTextIcon,
  FolderKanbanIcon,
  QrCodeIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react"

const publicNav = [
  {
    title: "Projects",
    url: "/dashboard/projects",
    icon: <FolderKanbanIcon />,
  },
]

const adminNav = [
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
  ...publicNav,
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
  {
    title: "Feedback",
    url: "/dashboard/feedback",
    icon: <MessageSquareTextIcon />,
  },
  {
    title: "Certificates",
    url: "/dashboard/certificates",
    icon: <AwardIcon />,
  },
  {
    title: "Mail log",
    url: "/dashboard/mail-log",
    icon: <MailCheckIcon />,
  },
  {
    title: "Mail",
    url: "/dashboard/mail",
    icon: <MailIcon />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isAdmin } = useAuth()
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-10 data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href={isAdmin ? "/dashboard" : "/dashboard/projects"}>
                <FetchathonLogo />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isAdmin ? adminNav : publicNav} />
      </SidebarContent>
    </Sidebar>
  )
}
