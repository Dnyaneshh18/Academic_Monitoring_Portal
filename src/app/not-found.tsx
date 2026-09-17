import { StatusScreen } from "@/components/StatusScreen";

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="We couldn't find that page"
      message="The page may have been moved, renamed, or never existed. Check the address or head back to your dashboard."
      secondaryHref={null}
    />
  );
}
