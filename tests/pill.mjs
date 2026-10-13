// October 13, second pass: a phone's pill is ← · the room you are in · +,
// and the room's mark raises the five rooms and the app menu above it.
// These two helpers reach a room or the app menu at any width.
export async function raiseRooms(page) {
  const mark = page.locator('.floating-nav .pill-room')
  if (!(await mark.isVisible().catch(() => false))) return page.locator('.floating-nav')
  if (!(await page.locator('.pill-rooms').isVisible().catch(() => false))) await mark.click()
  await page.locator('.pill-rooms').waitFor()
  return page.locator('.pill-rooms')
}
export async function openAppMenu(page) {
  const rooms = await raiseRooms(page)
  await rooms.getByRole('button', { name: 'App menu' }).click()
}
