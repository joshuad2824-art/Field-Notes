/* Key hygiene, for anything that goes into a request header.

   Three keys pass through this app now — a Supabase anon key, the vault key,
   and the model key the journal's prose pass uses — and all three are pasted
   by hand into a text field. They have nothing else in common and they all
   break the same way, which is why this lives beside the model rather than
   inside `src/sync/`: the sync engine is the only place that knows a mirror
   exists, but knowing what a header may hold is not knowledge about a mirror. */

/* A token that is going into an HTTP header, cleaned of the thing that gets
   into it. An anon key is a JWT and a vault key is base64url — neither has any
   business containing whitespace — but both are pasted by hand, and a key
   copied out of a display that wrapped it arrives with a newline in the middle.

   That newline never reaches the network. `fetch` refuses to build the headers
   and throws before it opens a socket, which looks from the outside exactly
   like a host that isn't there. `trim()` was not enough: it tidies the ends and
   leaves the middle alone. */
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff]/g

export function cleanToken(raw: string): string {
  /* Whitespace, and then the characters that are not whitespace as far as
     `\s` is concerned but are still nothing to look at: zero-width spaces,
     the joiners, the word joiner, a stray byte-order mark. A paste picks them
     up from all sorts of places and no eye will ever find them — which makes
     them the one class of damage a person genuinely cannot fix by hand. */
  return raw.replace(/\s+/g, '').replace(INVISIBLE, '')
}

/* An ellipsis is the opposite case and must never be stripped. It means the
   key was copied from a display that had shortened it, so what is held is not
   a damaged key but a *partial* one — and quietly removing the mark would
   turn an honest failure into a 401 nobody could explain. A JWT is three
   base64url segments and two dots, so three dots in a row is never one
   either. */
export function looksTruncated(value: string): boolean {
  return value.includes('…') || value.includes('...')
}

/* The first character that could not go in a header, named rather than
   described — because "there is a bad character in it" is not something you
   can act on when you cannot see it. */
export function firstUnsafe(value: string): string | null {
  for (const ch of value) {
    const n = ch.codePointAt(0) ?? 0
    if (n < 0x21 || n > 0x7e) {
      const hex = n.toString(16).toUpperCase().padStart(4, '0')
      return `U+${hex}${n === 0x20 ? ' (a space)' : ''}`
    }
  }
  return null
}

/* What a header value is allowed to be: visible ASCII, no spaces, no control
   characters. Worth checking rather than assuming, because the failure is
   invisible and blames the wrong thing. */
export function headerSafe(value: string): boolean {
  return value.length > 0 && /^[\x21-\x7e]+$/.test(value)
}
