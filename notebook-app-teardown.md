# The Notebook App — Teardown & First Principles

*Discovery document, v0.1. Written to be marked up, argued with, and revised.*

---

## Why this document exists

Seven apps over many years, and every one of them eventually got closed and not reopened. That is a long enough pattern to be data rather than indecision. Before a single line of code, the job is to figure out **what each of these apps understood that the others didn't**, and **what specifically broke the relationship** — and then to write down what we take, what we refuse, and what we build instead.

The aesthetic is not the hard part. Dark green, warm amber, a serif that holds a long paragraph, margins that let a page breathe — that is a weekend of careful work. The hard parts are sync, the editor, and search. This document is mostly about making sure we don't spend a year on the easy part and then lose the app to the hard ones.

---

## Two decisions already settled

These came out of the first conversation and everything downstream depends on them. If either one changes, this document needs rewriting.

**1. There is one kind of thing in the app: a page.**

Not notes-and-journal-entries-and-tasks-and-clippings. One page type. The four uses — fleeting capture, long-form writing, journaling, reference you return to — are produced by lightweight attributes layered on top of a page, never by making you choose a category before you're allowed to start writing.

- A page with a date attached behaves like a journal entry.
- A page that is pinned behaves like reference.
- A page with a tag joins a thread.
- A page with none of these is just a page, and that is fine forever.

The reason: every app below picks a lane and then quietly punishes use outside that lane. Using one app for all four purposes wasn't a failure to commit — it was being evicted, repeatedly, by software with opinions about what a note is.

**2. The app never asks you to log in to write.**

Data lives on the device. Always writable, always offline-capable, instant. Sync happens silently in the background and is *allowed to fail* without ever blocking the page. No session expiry, no re-auth wall, no spinner between you and a blank page.

This one constraint eliminates most of the architectures that would otherwise be tempting, and it is non-negotiable. It is the single most common cause of death in the list below.

---

## The seven

### 1. Apple Notes — the one you keep coming back to

**What it gets right.** Zero friction. It is already there, already signed in, already synced, and it opens instantly on all three devices. Nothing else on this list can claim that. Capture is genuinely one tap from a lock screen. It never loses anything. It has earned its 4.8 across 626,000 ratings by being *reliable in a category where reliability is rare*.

**Where it fails you.** It has no point of view. It's a filing cabinet in a beige office — competent, characterless, unpleasant to sit in. There is no sense of a *page*: text floats in a white void with a system font and cramped margins. It gives you no reason to open it except need, and a notebook you open only out of need is a notebook you don't think in.

**What we take.** The reliability standard, and the instant-open standard. If our app takes more than a beat to be ready for typing, we have failed and should measure it as a bug.

**What we refuse.** Neutrality as a design philosophy. A notebook should feel like *somewhere*.

---

### 2. Moleskine Planner — the one you wanted to love

**What it gets right.** It is the only app in the stack that understands it is pretending to be a physical object. The cream ruled page, the cover, the band, the handwriting in the marketing — the whole thing is built around ink-on-paper rather than text-in-a-box. That is exactly the right metaphor, and it's why this one landed aesthetically when nothing else did.

**Where it fails you.** Constant logouts, and it did not cross from phone to iPad to MacBook. Fatal, and instructive: **nothing about the failure was aesthetic.** The design was right and the infrastructure killed it. It also over-commits to *planning* — a schedule-shaped app that resents a stray thought at 11pm.

**What we take.** The paper-object metaphor, wholesale — ruled or dot-grid page, warm paper ground, ink-colored text, a real sense of margin and edge. Translated out of Moleskine's black-and-magenta into Timber & Ink: dark green, dark teal, warm amber, aged-paper cream.

**What we refuse.** Accounts as a precondition for writing. This is the origin of Decision #2 and this app is the reason it's written in blood.

---

### 3. Bear — the writer's editor

**What it gets right.** The best pure writing surface on the list. Markdown that renders as you type rather than making you flip between edit and preview modes; a cursor that behaves; lists that don't fight you; typography chosen by someone who reads. Its tag system is genuinely clever — tags are typed inline (`#field-notes`) rather than assigned through a panel, so organizing happens *while* writing instead of as a chore afterward. Nested tags give hierarchy without folders. 4.7 stars and an Editors' Choice from a small team, which tells you the editor is doing the work.

**Where it fails you.** Sync is paywalled and historically its weakest limb; it is Apple-only in practice; and the tag system, for all its elegance, eventually asks you to become an archivist. There is also no journaling affordance at all — no dated view, no on-this-day, no sense of time passing.

**What we take.** Inline tagging while writing. Markdown that renders live. And the general principle that *the editor is the product* — most notes apps treat the text field as a solved commodity and it absolutely is not.

**What we refuse.** Sync as a premium tier. Sync isn't a feature, it's the floor.

---

### 4. Day One — the one that understands time

**What it gets right.** It knows that a journal's value compounds, and that the compounding only pays out if the app *brings the past back to you*. On-this-day resurfacing, calendar and map views, streaks, photos bound to entries. Fifteen million users and an App of the Year because it solved a real problem: people want to have journaled more than they want to journal, and resurfacing is what closes that gap.

**Where it fails you.** Everything must be an entry, and every entry is stamped and filed into a chronology. There is no good home for a page that isn't *about a day* — a grocery list, a sermon outline, a running list of book quotes. It also leans on prompts and gratitude framing, which is a specific spiritual register that may not be yours.

**What we take.** Resurfacing. This may be the single most valuable idea in the entire stack for someone who keeps a commonplace book — a quiet "one year ago today" or "a quote you saved in March" surfaced on open, no notification, no pressure. It turns an archive into a companion.

**What we refuse.** Mandatory chronology. Time is an attribute of a page, not the identity of one.

---

### 5. Google Keep — capture at the speed of thought

**What it gets right.** The lowest-friction capture on the list. Open, type, gone — no title required, no save button, no decision about where it goes. The board of colored cards makes short things *visible* in a way a list of filenames never does, and it's honest about what it is: a place for scraps.

**Where it fails you.** It collapses under anything longer than a paragraph. No real formatting, no writing surface, no sense of a document. And the board becomes visual noise past about forty cards.

**What we take.** Titleless, saveless capture. You should be able to open the app and be typing in under a second, with no field to fill in first. Also worth stealing: short pages *look* different from long ones, so the eye can sort them without reading.

**What we refuse.** The card board as the primary organizing view. It doesn't scale and it makes everything feel disposable.

---

### 6. Evernote — the cautionary tale

**What it gets right.** Genuine range. It will hold a PDF, a scanned receipt, a web clipping, a table, and a 4,000-word draft in the same place, and its search reaches inside all of them — including text inside images. Nothing else here is that omnivorous.

**Where it fails you.** It became software about managing software. Notebooks inside stacks inside spaces, sync conflicts, upsells, an interface that grew a decade of features and shed none. The most important lesson on this list: **an app that can do everything eventually costs more attention than it saves.** You didn't leave because it lacked features.

**What we take.** Search that actually reaches — full-text, instant, across everything, as a first-class citizen rather than a magnifying glass in a corner. And attachments that live *inside* a page rather than in a separate files area.

**What we refuse.** Feature accretion, nested organizational hierarchies, and any structure that requires maintenance. If a feature needs a tutorial, it's the wrong feature.

---

### 7. Timepage — typography as interface

**What it gets right.** The most confident visual design in the stack. It treats typography, spacing, and motion as the entire interface rather than decoration on top of one — type hierarchy carries the information, color is used sparingly and meaningfully, animation explains structure rather than showing off. It proves a utility app can have a *voice*.

**Where it fails you.** It is a calendar, not a notebook, and its beauty is partly bought with density — it's gorgeous at a glance and slower to actually operate.

**What we take.** The conviction. Type-led hierarchy, restraint with color, motion that clarifies. This is the closest reference on the list for how our app should *feel* to move through.

**What we refuse.** Beauty that costs speed. When they conflict, the page wins.

---

## The pattern underneath

Reading the seven together, three things stand out:

**Nothing died of ugliness.** Moleskine was the prettiest and it still died — of logouts. Apple Notes is the plainest and it survived — on reliability. Aesthetic is why you'd *choose* an app; infrastructure is why you'd *keep* it. We need both, and if we only get one this year, we should get infrastructure and make it plain.

**Every app failed at the seams.** Not at its core competence — at the edges where you used it for something adjacent. The fix isn't more features, it's a data model with no seams in it. One page type.

**The past is an unused asset.** Only Day One does anything with what you already wrote. For someone keeping a commonplace book with a hundred quotes and forty original aphorisms, an app that quietly hands one back at the right moment is worth more than any organizational feature.

---

## What this implies for our feature set

*Draft — this is the part to argue with.*

**The floor (v1, non-negotiable)**
- One page type; instant open, instant write, no title required
- Local-first storage; works fully offline; sync in the background, never blocking
- Live-rendered markdown editor with genuinely good cursor and list behavior
- Full-text search across everything, fast, reachable from anywhere
- Inline tagging while writing
- Notebooks: a small, fixed set of top-level notebooks (Church, Work, Quick, Personal), exactly one level deep, no sub-notebooks ever. Every page lives in exactly one. Tags cut across them.
- Timber & Ink page: paper ground, ink text, real margins, one good serif for body and one companion face for structure
- Responsive across phone / tablet / desktop from a single codebase — same content, layout appropriate to the hand or the desk

**Earns its place (v2)**
- Resurfacing: a quiet "from your archive" on open, no notifications
- Pinning for reference pages
- Date attachment for journaling, with a calendar view that is a *lens*, not a container
- Image and file attachment inside a page
- Export: markdown files out, always, no lock-in

**Explicitly out of scope**
- Collaboration, sharing, comments
- Tasks, reminders, scheduling (that's a different app and Moleskine already showed how it distorts this one)
- Nesting of any kind — no sub-notebooks, no folders inside notebooks, no stacks. One level, permanently.
- AI features, at least until the notebook itself is good
- Accounts, in the traditional sense

---

## Answered

1. **Page:** dot-grid. Quiet, unmistakably paper, doesn't force a baseline.
2. **Handwriting:** not needed. No Pencil input, no canvas layer. Large amount of risk and work removed.
3. **Commonplace book:** part of this app. The existing quotes and aphorisms get imported, which gives the archive something real in it on day one.
4. **Audience:** you alone. No sharing, no collaboration, no permissions, no conflict resolution between people — only between your own devices, which is a far smaller problem.
5. **Notebooks:** yes — Church, Work, Quick, Personal. One level deep, no nesting. See below.
6. **Name:** deferred. It should come out of the thing once it has a shape.

## The notebooks decision

This is the one place the original draft was wrong. "No hierarchy" was too blunt: a small set of top-level notebooks isn't hierarchy, it's a shelf. Four notebooks on a shelf is exactly the physical metaphor we're already committed to, and it's the one organizational feature that has actually survived years of use in Apple Notes.

The rule that keeps it from becoming Evernote:

- **One level. Permanently.** No sub-notebooks, no folders, no stacks. The moment nesting exists, maintenance exists.
- **Every page lives in exactly one notebook**, and it's chosen at capture — but with a default, so capture stays instant. Quick is the default; moving a page later is one tap.
- **Tags cut across notebooks.** Notebooks answer *where does this live*; tags answer *what is this about*. A `#sermon-prep` page can exist in both Church and Personal without duplication.
- **Still one page type.** A notebook can carry its own accent color and cover, but the page inside is the same page everywhere. The commonplace book is a notebook, not a different kind of document.

The design gift here: four notebooks means four covers. Dark green, dark teal, warm amber, and something like oxblood or deep walnut — one Timber & Ink palette, four distinct objects on a shelf. The home screen is the shelf. That's the first thing worth sketching.

---

*Next step after this doc: the architecture note — how local-first sync actually works, what it costs, and what we're signing up to maintain. That's where the real risk lives.*
