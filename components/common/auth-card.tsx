import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AuthCardProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export function AuthCard({ children, headerContent }: AuthCardProps) {
  return (
    <Card className="w-full min-w-[320px] border-none shadow-none sm:border sm:shadow-sm">
      {headerContent && (
        <CardHeader className="space-y-2 px-6 pb-6">{headerContent}</CardHeader>
      )}
      <CardContent className="px-6 pb-6">{children}</CardContent>
    </Card>
  );
} 