import AppShell from "@/components/AppShell";
import CaseLoading from "@/components/CaseLoading";

/** Shown the moment the page is asked for, while the server answers. */
export default function Loading() {
  return (
    <AppShell>
      <CaseLoading what="Reading the wallet" />
    </AppShell>
  );
}
