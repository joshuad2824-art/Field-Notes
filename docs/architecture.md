# The Notebook App — Architecture Note

*v0.2. Companion to the teardown. This is the risk document.*

*August 2026: sync is built. The sections below are the plan as it was written, kept
because the reasoning still governs; what actually got built, and the three places it
differs, are at the bottom under **What sync turned out to be**.*

---

## What this has to accomplish

Everything in the teardown is downstream of four sentences:

1. Tap the icon on any of three devices and be typing in under a second, every time, forever.
2. Never sign in again after the first time on each device.
3. Nothing is ever lost, including when sync breaks — and sync will break.
4. One person maintains this, in spare hours, for years.

Point four is the one that quietly governs the rest. Every architectural choice below is weighed against *what happens when nobody touches this for eight months.*

---

## The fork: native or web

This is the real decision, and it's worth being honest that there's a genuine case on both sides.

**Native (Swift/SwiftUI + CloudKit).** All three of your devices are Apple. That makes CloudKit unusually attractive, because it answers the "never sign in" requirement *perfectly and for free* — the identity is your Apple ID, which is already signed in at the OS level and never expires. Apple runs the sync infrastructure, there's no server to maintain, no monthly cost, and no 2am outage that's yours to fix. It is, on the merits, the technically correct answer to your specific requirements.

The cost: three separate interface layouts, Xcode, a $99/year developer account, a Mac tied to the build process, and a language you don't currently ship in. Realistically that's the difference between an app you're using next spring and one you're still building.

**Web (installed PWA).** One codebase serving phone, tablet, and desktop. You already ship this way — Let It Book is live on Netlify — so the whole pipeline from idea to deployed change is a thing you can do on a weeknight. Iteration speed matters enormously on a project whose success depends on *how it feels*, because feel only comes from fifty small revisions.

The cost: you own the sync layer and the identity layer yourself, and iOS Safari imposes some real constraints (below).

**Recommendation: the web app.** Not because it's technically superior — CloudKit genuinely is, for your setup — but because the failure mode we're actually guarding against is *the app never getting finished or never getting good.* Seven apps died of not being pleasant enough to keep opening. Pleasantness comes from iteration. Choose the stack that lets you revise the page fifty times.

If in a year the app is something you live in and the web constraints are chafing, a native rewrite against a proven design is a much easier project than a native build against an unproven one.

---

## The data model

Deliberately boring, because boring survives.

**A page is a markdown file plus a small envelope.**

```
id            stable uuid, never changes
notebook      church | work | quick | personal
title         first heading, or first line, derived not required
body          markdown text
tags          derived from inline #tags in the body
created       timestamp
updated       timestamp
pinned        bool
entryDate     optional — the date this page is "about"
deleted       tombstone, not a hard delete
```

That's the whole thing. No blocks, no rich-text tree, no proprietary document format. The consequences are worth stating plainly:

- **Export is trivial** because the storage format *is* the export format. A notebook downloads as a folder of `.md` files. There is no conversion step to get wrong.
- **Search is easy** because it's all text.
- **Conflict resolution is tractable** because a page is one small string, not a tree of nodes.
- **The app cannot lock you in** even if you wanted it to.

Tags being *derived* rather than stored is a small but important choice: it means the body text is the single source of truth and there's no metadata to drift out of sync with what you actually wrote.

---

## Where data lives

**On the device: IndexedDB, via Dexie.** Every page, always, on every device. This is the primary store — not a cache. The app reads and writes here and never waits on a network call to render or save. That's what makes it open instantly.

Two things to do deliberately:

- Request `navigator.storage.persist()` on first launch, which asks the browser not to evict the data under storage pressure. Installed PWAs are generally granted it.
- Treat local storage as *fast but not durable*. Durability comes from the two layers below.

**On the server: a sync mirror.** Not the source of truth — a mirror the devices reconcile against.

**In your file system: exports.** The real backup. More on this below.

---

## Sync, and how you never sign in again

Because there is exactly one user, the entire authentication problem collapses. There's no need for accounts, emails, passwords, or password resets. There's one vault and a handful of devices allowed to talk to it.

**Device pairing instead of login.** First device generates a long random key. Every additional device gets paired by scanning a QR code or pasting a recovery phrase, once. That key is stored on the device and **has no expiry**. There is no session to time out, no refresh token to fail, no email to re-verify. This is the direct structural answer to what killed Moleskine — not a longer session, but *no session concept at all*.

**Sync never blocks the page.** The rule to enforce in code: the editor has no awareness that a network exists. Writes go to IndexedDB and return immediately. A background worker pushes and pulls on its own schedule. If the server is down, the key is wrong, the wifi is out, or the whole backend has been deleted — the app opens and writes exactly as fast as it always does. Sync status is a small, quiet indicator, never a modal, never a blocker.

**Conflict handling: last-write-wins, but never silently.** Single-user conflicts are rare — you're seldom editing the same page on two devices in the same minute — but they happen after offline stretches. When two versions of a page diverge, the newer one wins *and the older one is preserved as a conflict copy in the same notebook.* Never a merge dialog, never a lost paragraph. A stray duplicate page is a mild annoyance; a silently discarded evening of writing is how an app loses your trust permanently.

**Backend options**, in order of how much I'd recommend them:

1. **Supabase.** Postgres, generous free tier, straightforward client, and a paid tier around the price of a couple of coffees if you outgrow it. Note that free-tier projects pause after inactivity — for a personal app that's a nuisance to check on, though the never-blocking design means it's a nuisance and not an outage. This is the pragmatic pick.
2. **CouchDB + PouchDB.** The old, unglamorous, purpose-built answer to exactly this problem — offline-first replication with conflict handling as a native concept, not something you hand-roll. Self-hosted on a small VPS for a few dollars a month. More setup, less code you have to write and later debug.
3. **A tiny custom sync endpoint.** Tempting because the data model is so simple. Avoid it. Sync is the one place where "how hard could it be" reliably costs six months.

---

## Search

**Entirely local.** A full-text index built on-device (MiniSearch or FlexSearch) over the same IndexedDB store. Instant, works offline, never touches the network, no server-side indexing to pay for or maintain, no privacy question to answer.

At the scale of one person's lifetime of notes — call it tens of thousands of pages at the outer edge — this is comfortably within what a browser handles well.

---

## Backup, which matters more than security

Worth stating in the document rather than only in conversation: **the realistic threat to this archive is loss, not intrusion.** A sync bug written by one tired person on a Tuesday will destroy more of your writing than any attacker ever will. So the safety budget goes here.

- **Server-side encryption at rest.** Standard, free, included with any of the backends above.
- **No end-to-end encryption.** It would cost server-side capability, complicate every future feature, and make a lost key an unrecoverable catastrophe — in exchange for protecting notes you've already decided won't contain anything harmful if exposed. Wrong trade.
- **Manual export, any time.** One button, whole notebook or whole shelf, downloads a folder of markdown.
- **Automatic scheduled export.** Monthly, unprompted, into iCloud Drive. This is the single highest-value safety feature in the project. It means that even total catastrophic failure of everything we build costs you *at most one month*, and leaves you holding readable files rather than a corrupted database.
- **Tombstones, not deletions.** Deleted pages linger invisibly for 30 days so a sync bug can't propagate a deletion you didn't intend.

---

## Honest risks

**iOS Safari storage eviction.** Historically Safari has purged site data after periods of disuse. Installed PWAs with persistent storage granted are largely exempt, but the guarantee is weaker than a native app's. Mitigated by server sync and monthly exports — worst case is a re-download, not a loss. This is the strongest single argument for the native path and it should be recorded as such.

**PWA polish ceiling.** An installed web app on iOS is very good now and still not indistinguishable from native — some keyboard and scroll behaviors, share-sheet integration, and widgets are either constrained or unavailable. If lock-screen capture or a home-screen widget turns out to matter to you, that pressure will build over time.

**Sole maintainer.** Dependencies rot, browsers change, backends deprecate APIs. Budget a few hours a year, and keep the dependency list short enough that a year of neglect doesn't require an archaeology dig. The markdown-files data model is the insurance policy: even if the app dies entirely, the writing is fine.

**Cost.** Domain around $12/year. Netlify free at this scale. Backend $0–$25/month depending on the choice and tier. Call it under $100 a year, plausibly under $30.

---

## Build order

The sequencing here is the actual recommendation, more than any individual technology above.

**Phase 0 — the editor spike (a weekend).** One page, no notebooks, no sync, no storage. Just the writing surface: dot grid, Timber & Ink palette, the serif, the margins, live markdown, cursor and list behavior. The single question it answers is *do I want to write in this?* If the answer is no, nothing else matters and we revise until it's yes.

**Phase 1 — the single-device notebook (the bulk of the work).** Four notebooks, the shelf, capture, search, tags, pinning, export. Fully usable on one device, no sync at all. **Then live in it for a month before writing a line of sync code.** Every app on that list of seven failed at daily use, not at features — this is the phase that tells us whether ours will too, and it's much cheaper to learn it here.

**Phase 2 — sync and pairing.** Only once Phase 1 has survived a month of real use.

**Phase 3 — the compounding features.** Resurfacing, the commonplace book import, entry dates and the calendar lens, scheduled export.

The temptation will be to build sync early because it's the interesting problem. Resist it. Sync is what makes a good notebook usable on three devices; it does nothing whatsoever for a notebook you don't enjoy opening.

---

## What sync turned out to be

Built August 2026, against the plan above. It came out close, and the three places it
differs are worth stating plainly.

**The identity collapsed further than expected.** The plan said device pairing with a
non-expiring key. What that became is smaller: the vault has no row anywhere. Its id *is*
the SHA-256 of the key, so there is no vault to create before the first write, no table of
vaults, and no function to call to make one. Every row carries the hash; the row policy
computes the same hash from the request's own header and shows the caller what matches.
A request with no key hashes to something no row will ever carry and sees an empty
database. Three tables, one function, one policy written three times — that is the whole
server, and it is in `supabase/schema.sql`.

The consequence worth being clear-eyed about: the vault key is a bearer token in the most
literal sense. Anyone holding the pairing code has the archive. There is no account to
recover it with, because an account is the thing we refused to have.

**"Do not hand-roll a sync endpoint" held, but only just.** The reconciliation is entirely
on the device — `src/sync/reconcile.ts` is a pure function, and `npm run check` proves its
truth table on node with no server, no browser and no network. What the server does is
PostgREST and a row policy, which is to say nothing that was written for this app. The
temptation the note warned about was real and it arrived in the shape of "a small edge
function would make images easier". It didn't get built, and images ride as base64 in the
same table for exactly that reason: one transport and one policy rather than two.

**Conflict handling came out as specified**, and it is the part most worth keeping honest.
Last-write-wins decides which version keeps the page's id; the loser becomes its own page
in the same notebook, opening with a `> Conflicting copy · <date> #conflict` line. Never a
merge dialog. Two edits that happen to reach the same text are not treated as a conflict at
all, or every touch on two devices would spawn a duplicate.

Three smaller things the plan didn't anticipate:

- **Notebooks needed tombstones too.** A notebook row that merely vanished would be handed
  straight back by the next device to sync, which had no way to tell "deleted" from "not
  yet seen". They grew `updated` and `deleted`, the same two fields a page has.
- **The mirror keeps tombstones forever.** The device purges its own after thirty days as
  planned; the server's marker stays. That is what stops a device switched off for a month
  walking a deleted page back in — and it is a permanence the thirty-day rule alone
  couldn't give.
- **The cursor is a server-side stamp, not any clock a device owns**, and the trigger uses
  `clock_timestamp()` rather than `now()`. A first sync pushing four hundred pages in one
  transaction would otherwise give all four hundred the same stamp, and a cursor that can
  only advance to the last row's stamp would have nothing to advance to.

**It runs.** Three devices, one project, August 2026. Worth recording precisely what that
settles, because it is the one question this note could not answer when it was written: the
row policy reads the vault key out of `current_setting('request.headers')`, and PostgREST
does in fact put it there. So the identity design holds outside a test — no account, no
session, nothing that expires, and a server that never learned what any of this is for.

What it cost to get there is worth recording too, because none of it was the interesting
part. The first sync failed with a message saying the mirror could not be reached, and the
mirror was fine the whole time. A key pasted by hand had a character in it that cannot go in
an HTTP header, so `fetch` threw before opening a socket — and the error handling, written by
someone who assumed a thrown fetch meant a network, reported that as "offline, it will catch
up". Two days of looking at Supabase for a fault that was in our own catch block. The lesson
is not about whitespace. It is that a failure path invented in advance will describe the
failure you imagined rather than the one you get, and that "it will catch up" is the most
expensive thing a program can say when it won't.

**Scheduled export is still the actual backup**, and sync did not change that. It made the
case for it stronger, if anything: there is now a second system that can be wrong, and the
folder of markdown on disk is the only thing that doesn't depend on either of them.

---

*Next: the visual system — palette, type, the shelf, and what a page actually looks like. That's Phase 0's brief.*
