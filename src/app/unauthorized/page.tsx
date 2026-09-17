import { StatusScreen } from "@/components/StatusScreen";

export default function Unauthorized() {
  return (
    <StatusScreen
      code="401"
      title="Please sign in to continue"
      message="This area needs an active session. Sign in with your institute account and we'll take you straight back."
      actionHref="/login"
      actionLabel="Go to sign in"
      secondaryHref={null}
    />
  );
}
