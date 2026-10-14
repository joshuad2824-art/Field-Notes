// October 14: the pill is ← · the room you are in, by name · + at every
// width, and the room's mark raises one sheet holding the five rooms and the
// six back rooms. These helpers reach a room or the back rooms at any width.
export async function raiseRooms(page) {
  const mark = page.locator('.floating-nav .pill-room')
  if (!(await mark.isVisible().catch(() => false))) return page.locator('.floating-nav')
  if (!(await page.locator('.pill-sheet').isVisible().catch(() => false))) await mark.click()
  await page.locator('.pill-sheet').waitFor()
  return page.locator('.pill-sheet-rooms')
}
/* Opens the back rooms and returns where they are: the phone sheet's rows,
   or the app menu above the pill. */
export async function openAppMenu(page) {
  const mark = page.locator('.floating-nav .pill-room')
  if (await mark.isVisible().catch(() => false)) {
    await raiseRooms(page)
    return page.locator('.pill-sheet-back')
  }
  await page.locator('.floating-nav').getByRole('button', { name: 'App menu' }).click()
  await page.locator('.pill-menu').waitFor()
  return page.locator('.pill-menu')
}
/* The back rooms, wherever they are drawn at this width. */
export const backRooms = (page) => page.locator('.pill-menu, .pill-sheet-back')
