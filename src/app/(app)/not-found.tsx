import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/States";
export default function NotFound() {
  return (
    <>
      <PageHeader title="Content not found" back />
      <EmptyState
        glyph="layers"
        statement="This item isn't available."
        guidance="The link may be incorrect."
        action={{ label: "See the calendar", href: "/calendar" }}
      />
    </>
  );
}
