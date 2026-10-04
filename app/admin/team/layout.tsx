/**
 * Squad + a `@modal` slot. Clicking a player on the Squad list soft-navigates to
 * /team/[id], which the slot intercepts to show the profile over the list (a
 * dialog on desktop). A direct visit or refresh renders the full [playerId] page.
 */
export default function TeamLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
