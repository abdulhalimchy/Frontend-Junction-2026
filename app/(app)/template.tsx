// Re-mounts on every navigation inside the app, so each page fades up as it arrives (see .page-enter).
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
