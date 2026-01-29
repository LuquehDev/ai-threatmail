"use client";

import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type Crumb = { label: string; href?: string };

export function DashboardTopbar({ items }: { items: Crumb[] }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;

            return (
              <React.Fragment key={`${item.label}-${idx}`}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : item.href ? (
                    <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbLink href="#">{item.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>

                {!isLast ? <BreadcrumbSeparator /> : null}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between rounded-xl border bg-card p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>LP</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">Luiz</div>
            <div className="truncate text-xs text-muted-foreground">Plano: Student</div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-lg">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => toast.message("Definições", { description: "Vai para /settings" })}
            >
              <Settings className="mr-2 h-4 w-4" />
              Definições
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => toast.message("Logout", { description: "Liga ao signOut() depois." })}
            >
              Terminar sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
