import { StatusScreen } from "@/components/StatusScreen";

export default function Forbidden() {
  return (
    <StatusScreen
      code="403"
      title="You don't have access to this area"
      message="Your role doesn't include this page. If you believe this is a mistake, ask your college administrator to review your permissions."
      secondaryHref={null}
    />
  );
}
