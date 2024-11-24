import { resetPasswordAction } from "@/app/actions";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            Please enter your new password below.
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
        </div>
        <SubmitButton
          className="w-full"
          formAction={resetPasswordAction}
          pendingText="Resetting password..."
        >
          Reset password
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}
