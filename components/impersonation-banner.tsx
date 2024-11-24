"use client";

import { Button } from "./ui/button";
import { stopImpersonation } from "@/app/actions";

export function ImpersonationBanner({ adminEmail, userEmail }: { 
  adminEmail: string;
  userEmail: string;
}) {
  console.log('[ImpersonationBanner] Rendering with:', { adminEmail, userEmail });
  
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 p-2 text-sm flex justify-between items-center">
      <span>
        Viewing as <strong>{userEmail}</strong> (Admin: {adminEmail})
      </span>
      <form action={stopImpersonation}>
        <Button type="submit" variant="outline" size="sm">
          Exit Impersonation
        </Button>
      </form>
    </div>
  );
} 