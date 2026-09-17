import { StatusScreen } from "@/components/StatusScreen";

export default function ServerError() {
  return (
    <StatusScreen
      code="500"
      title="Server error"
      message="The portal couldn't complete that request. Please try again in a moment — if it keeps happening, contact your administrator."
      secondaryHref={null}
    />
  );
}
