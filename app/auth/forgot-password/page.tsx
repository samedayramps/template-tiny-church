import { forgotPasswordAction } from "@/actions/auth";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-in">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>
        <SubmitButton
          className="w-full"
          formAction={forgotPasswordAction}
          pendingText="Sending reset link..."
        >
          Reset Password
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}
