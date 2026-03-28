// Minimal layout for print pages — no sidebar, no navigation.
// Used by: (print)/schedules/[id]/print/page.tsx.

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
