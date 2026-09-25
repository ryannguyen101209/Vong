---
name: Vòng
description: A secondhand marketplace for Ho Chi Minh City, shown as a well-kept group thread.
colors:
  page: "#ffffff"
  thread: "#eef5ff"
  thread-strong: "#dcebff"
  bubble: "#f1f3f6"
  line: "#e3e7ed"
  line-strong: "#cdd4de"
  line-field: "#838e9d"
  ink: "#15202b"
  ink-soft: "#3e4a59"
  ink-faint: "#5e6b7b"
  blue: "#1463f3"
  blue-press: "#0f4fc4"
  blue-soft: "#e3eeff"
  blue-ink: "#1452c8"
  unread: "#db3226"
  ok: "#16703f"
  ok-soft: "#e6f5ec"
  wait: "#8a5a00"
  wait-soft: "#fff4db"
  bad: "#b42318"
  bad-soft: "#feedeb"
typography:
  display:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  post-title:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  lead:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.2
  tab:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.55
  meta:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  price:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.55
    fontFeature: "\"tnum\""
rounded:
  tail: "6px"
  sm: "8px"
  md: "12px"
  bubble: "20px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "20px"
  s-6: "24px"
  s-8: "32px"
  s-10: "40px"
  s-12: "48px"
  s-16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.page}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.blue-press}"
    textColor: "{colors.page}"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.page}"
    textColor: "{colors.bad}"
    rounded: "{rounded.pill}"
  button-danger-hover:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
  button-disabled:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.ink-faint}"
  button-small:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  chip:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.blue-ink}"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
    height: "48px"
  input-composer:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 46px"
    height: "48px"
  thread-tab:
    textColor: "{colors.ink-faint}"
    typography: "{typography.tab}"
    padding: "12px 0"
  thread-tab-active:
    textColor: "{colors.ink}"
  post-bubble:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
    padding: "6px"
    width: "min(100%, 460px)"
  message-received:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.bubble}"
    padding: "8px 12px 6px"
  message-sent:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.page}"
    typography: "{typography.body}"
    rounded: "{rounded.bubble}"
    padding: "8px 12px 6px"
  notice:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  notice-info:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.blue-ink}"
  notice-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
  notice-wait:
    backgroundColor: "{colors.wait-soft}"
    textColor: "{colors.wait}"
  notice-bad:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
  count-unread:
    backgroundColor: "{colors.unread}"
    textColor: "{colors.page}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
    height: "20px"
  avatar:
    backgroundColor: "{colors.thread-strong}"
    textColor: "{colors.ink}"
    size: "36px"
---

# Design System: Vòng

## Overview

**Creative North Star: "The Well-Kept Group Thread"**

Vòng looks like a tidy pass-đồ group chat, not a shop. Every listing is a post from a named person in a named district, and every next step (asking about an item, paying the fee, entering the key, saving with a reason) reads as a reply in that thread. The page is white where you orient yourself (header, page title, thread tabs) and turns a pale sky tint where content lives (feeds, conversations, forms written as posts, the admin queue). White speech bubbles sit on that tint. Depth comes from that one tonal step and nothing else.

The system is light, quiet and dense enough for a phone. There is one typeface, Be Vietnam Pro, chosen because it renders Vietnamese diacritics well at every weight. There is one action colour, a clear blue. There is one signal colour, a red that means unread and nothing else. Everything is grouped by hairlines and space. Bordered cards, shadows under content, uppercase labels and a grid of photo tiles are the marketplace defaults this world refuses. Listings form a single column of posts at reading width, with a quiet rail beside them on desktop.

The signature is the bubble with one tight corner. Received bubbles (a listing, an FAQ answer, the seller's chat message) keep a 6px corner pointing at their author. Sent bubbles (your chat message, your reason for saving) are blue and point back at you. Those corners carry the grammar: you can tell who is speaking from the shape alone.

**Key Characteristics:**
- White heads over a pale thread tint; white bubbles on the tint for content.
- One family (Be Vietnam Pro 400/500/600/700), sentence case everywhere, negative tracking on headings.
- One action blue for fills, sent bubbles, active underlines and focus; one unread red.
- Pills for everything you press; 20px bubbles with a single 6px tail corner for everything that speaks.
- Hairlines and space instead of boxes; the only shadow belongs to things that float.
- Phone first at 390px, with 44px touch targets; desktop keeps the feed at 640px with a rail.

## Colors

A white page and a pale sky thread, cool slate inks, one saturated blue for action, one red kept for unread.

### Primary
- **Action Blue** (#1463f3): the only fill that means "do this". Primary buttons, the send button, sent chat bubbles and saved-reason bubbles, the active thread-tab underline, the focus outline and field focus stroke, the V mark in the header. White text on it measures 5.11:1.
- **Pressed Blue** (#0f4fc4): hover and active fill for primary buttons and the send button, and the hover colour for text links.
- **Blue Wash** (#e3eeff): the selected chip fill, the info notice fill, and the 3px focus halo around fields.
- **Link Blue** (#1452c8): blue as text. Links, the "Reply to seller" line, link buttons, selected chip text, info notices, the required-field asterisk. It holds 5.84:1 on Blue Wash and 6.23:1 on the thread tint, where Action Blue as text would not.

### Secondary
- **Unread Red** (#db3226): unread counts in the nav and inbox (white numerals, 4.67:1) and the dot on the phone menu button. The direction contract named coral #FF5A4E; it measured 3.08:1 with white numerals and was replaced in the build. This red is the recorded value.

### Tertiary
- **Done Green** (#16703f) on **Done Wash** (#e6f5ec): approved, live, copied, sent.
- **Waiting Amber** (#8a5a00) on **Waiting Wash** (#fff4db): waiting on you (pay, enter your key).
- **Problem Red** (#b42318) on **Problem Wash** (#feedeb): errors, rejected listings, danger buttons, invalid fields. It is deliberately a different red from Unread Red.

Each ink passes AA on its own wash (5.4 to 5.8:1). They appear as status dots with a word, or as notice fills. They are never used as decoration.

### Neutral
- **Page White** (#ffffff): the page, the header, page heads, bubbles on the thread, dialogs, the text colour on blue and red fills.
- **Thread Tint** (#eef5ff): the surface behind feeds, conversations, the sell form, payment, personal lists and admin work areas. Ink Faint still reads at 4.95:1 on it.
- **Thread Deep** (#dcebff): text selection and the default avatar fill.
- **Received Grey** (#f1f3f6): the composer-shaped search and chat fields, photo placeholders, readonly fields, disabled buttons, hover fill for ghost controls.
- **Hairline** (#e3e7ed): rules between rows, under the header, under thread tabs, between inbox and chat.
- **Hairline Strong** (#cdd4de): button and chip strokes, and the rule that separates a rail or a detail list from the column above it.
- **Field Stroke** (#838e9d): the resting border of text fields, selects and the key field. It is the only edge a field has, so it holds 3.32:1 on white and 3.03:1 on Thread Tint.
- **Ink** (#15202b): headings, titles, prices, body on white.
- **Ink Soft** (#3e4a59): leads, secondary paragraphs, nav links at rest.
- **Ink Faint** (#5e6b7b): meta lines (district, time), hints, placeholders, inactive tabs. 5.43:1 on white, 4.89:1 on Received Grey; nothing lighter is used for text.

### Named Rules
**The One Blue Rule.** Blue is the only colour that asks for a tap. If a control is not blue, it is a quiet pill or text link in ink; there is never a second accent.

**The Unread-Only Rule.** Unread Red marks unread messages and nothing else: not errors, not prices, not sales, not decoration.

**The Tint-Below Rule.** White is for orienting (header, title, tabs); the thread tint is for content. A surface places its content on the tint and its head on white, so the step between them does the work a divider would.

## Typography

**Display Font:** Be Vietnam Pro (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Be Vietnam Pro, the same family
**Label/Mono Font:** none; numbers use the same family with tabular figures

**Character:** A single contemporary Vietnamese-designed grotesque in four weights. Hierarchy comes from size and weight. Headings are tightened slightly, and the text reads like a well-set messaging app rather than a storefront.

### Hierarchy
- **Display** (700, 2.25rem / 36px, 1.2, -0.025em): the home and browse title on desktop only; it steps down to Headline below 720px.
- **Headline** (700, 1.75rem / 28px, 1.2, -0.015em): page titles, the opened listing title, the inbox title.
- **Title** (700, 1.375rem / 22px, 1.2, -0.015em): section headings in prose, dialog titles, the listing price.
- **Post Title** (600, 1.125rem / 18px, 1.35): listing titles inside bubbles, empty-state headings, the key-area title, FAQ questions on desktop.
- **Lead** (400, 1.0625rem / 17px, 1.55): the sentence under a page title, in Ink Soft, limited to about 56ch. It drops to Body on phones.
- **Body** (400, 1rem / 16px, 1.55): everything else. Long-form reading (About, FAQ answers, listing description) opens up to line-height 1.7 at 17px on desktop and stays within 65ch.
- **Button** (600, 0.9375rem / 15px, 1.2): button text. **Tab** (500 at rest, 600 when current; 15px): thread tabs, nav links, rail links.
- **Label** (600, 0.875rem / 14px): field labels, small buttons, the reply line, save, selected chips. Chips at rest use 14px 500.
- **Meta** (400, 0.8125rem / 13px): author district and time, hints, field errors (500), table headers (600), legal text. Chat timestamps and counts go down to 12px.
- **Price** (700, tabular figures): every price, amount, count, reference and key. It is 16px in a feed post, 22px on the opened listing, and 18px as an input on the sell form.

### Named Rules
**The One Family Rule.** Be Vietnam Pro for everything, numbers included. A new surface never adds a display face, a mono face or a script; it reaches for weight 600 or 700 instead.

**The Sentence Case Rule.** No uppercase labels, no tracked small caps, no eyebrow line above a heading. Tracking is negative on headings and zero on text. Codes people read aloud are the only exception: the publish key field is uppercased and tracked at 0.2em (0.14em on phones), and the admin key at 0.04em.

**The Tabular Price Rule.** Prices and money are always tabular figures at weight 700. The direction contract said 600; the build settled on 700 so a price outranks the title's 600 in a glance.

## Layout

The page is a centred shell, at most 1120px wide, with a 20px gutter (16px at 720px and below). The header is sticky: 64px tall, 56px on phones, white, with a Hairline under it. Most surfaces are built the same way: a white head block (padding 32px top, 20 to 24px on phones) holding the title, lead and thread tabs, then a thread-tinted band that fills the rest of the page with padding 32px top and 64px bottom (24/48 on phones).

The market feed is a two-column grid: the feed at up to 640px and a quiet rail at 240 to 280px, pushed apart (`space-between`) with a 48px gap. The rail is sticky, 24px below the header, and holds plain headings, links and one note, separated by Hairline Strong rules. At 960px and below the rail moves under the feed, behind a Hairline Strong rule. Admin uses the same split with a 680px column.

Reading surfaces use one column: 680px for About, FAQ, contact and sell; 720px for your listings and saved; 760px for the opened listing; 880px for payment. The inbox is a 320px list beside the chat; on phones it becomes one pane at a time and the chat fills the viewport height (`100dvh` minus the header).

A post is a two-column grid: a 36px avatar column and the body, with a 12px gap. Posts sit 24px apart in the feed. Spacing runs on a 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). The 6px and 2px values that show up in meta lines and inside bubbles are optical adjustments, not scale steps. Breakpoints are 960px (rail drops, nav moves into the menu), 720px (phone gutter and header, search moves into the page, single-pane messages), 640px (dialogs become bottom sheets, form grids go single-column) and 1024px (listing actions move from the sticky bottom bar to under the price). Touch targets stay at least 44px on phones. When a control is drawn at 36px, a pseudo-element extends its hit area.

## Elevation & Depth

The system is flat and tonal. Content separates from the page by the step from white to Thread Tint and back to a white bubble, never by a shadow or a border. One shadow exists, for layers that actually float above the page: the account menu and dialogs. Focus is shown by colour, not lift: a 2px Action Blue outline at 2px offset on anything focusable, and on fields a blue stroke plus a 3px Blue Wash halo. The phone listing view has a sticky reply bar at the bottom. It separates with a Hairline and a white fill, not a shadow.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px rgb(21 32 43 / 12%), 0 2px 6px rgb(21 32 43 / 8%)`): the account menu and dialog/bottom sheet only.
- **Field halo** (`box-shadow: 0 0 0 3px #e3eeff`): focused inputs, the key field, the composer search and chat fields.

### Named Rules
**The Float-Only Shadow Rule.** A shadow means "this is above the page and will go away". Posts, bubbles, buttons, rails and notices never carry one.

## Shapes

There are two families of shape. Anything you press is a full pill (999px): buttons, chips, nav links, the language toggle, the account chip, counts, the composer-shaped search and chat fields, and the system-message lozenges. Anything that speaks is a 20px bubble with one corner cut down to 6px, and that tight corner points at the speaker. A post's tail is top-left, toward the avatar above it. A received chat message's tail is bottom-left. A sent message or saved-reason bubble is bottom-right. The FAQ answer and the key area use the post shape. Photos inside a bubble follow its curve: the top corners are the bubble radius minus its padding (14px inside a 6px pad, 12px inside the 8px listing pad), and the bottom corners are 8px.

Fields, notices, inbox rows, menus and the admin table take a 12px corner. Thumbnails and menu items take 8px. Avatars and the send button are circles, and status marks are 8px dots. Dialogs are bottom sheets on phones (20px top corners, square bottom) and fully rounded 20px sheets from 640px up. Structure between rows is a 1px hairline, never an enclosing box. Where a bubble holds several fields, hairlines split the rows and a vertical hairline splits side-by-side fields.

### Named Rules
**The One Tight Corner Rule.** A bubble has exactly one 6px corner, and it faces whoever is speaking. A rectangle with four equal corners is a field or a notice, never a post.

## Components

### Buttons
Round, firm and few: one blue pill per view, and quiet outlined pills for everything else.
- **Shape:** full pill (999px), 44px tall, 20px side padding; small variant 36px tall with 16px padding and 14px text.
- **Primary:** Action Blue fill and stroke, white 15px/600 text. Used for Sell, Send to review, Reply to seller on desktop, and the key submit (52px tall there).
- **Hover / Focus:** Primary fills Pressed Blue; secondary fills Received Grey and presses to Hairline. Transitions are 150ms on the system ease. Focus is the global 2px blue outline.
- **Secondary:** Page White with a 1px Hairline Strong stroke and Ink text.
- **Danger:** Page White with a soft red stroke (#efc2bd) and Problem Red text, filling Problem Wash on hover.
- **Disabled:** stays legible: Received Grey fill, Hairline stroke, Ink Faint text, `not-allowed` cursor. It never uses faded opacity.
- **Text actions:** "Reply to seller", Save and link buttons are unboxed Label-weight text in Link Blue (Save sits in Ink Faint until saved), with an 18px stroke icon, at least 32px tall in feeds and 44px on phones where they stand alone.

### Chips
- **Style:** 36px pill, Page White, 1px Hairline Strong stroke, Ink Soft 14px/500 text. Used as quick-reply choices (save reasons, reject reasons) and filters.
- **State:** hover turns the stroke Action Blue. Selected (`aria-pressed`) is Blue Wash fill, blue stroke, Link Blue text at 600. On phones the hit area reaches 44px, either through a pseudo-element or a taller chip.

### Cards / Containers
There are no cards. The containers are:
- **Post bubble:** Page White on the thread tint, 20px with the 6px tail, 6px inner padding, up to 460px wide. It holds a 4:3 photo, then title, price and condition with 12px padding. Hovering lifts it to a near-white (#fbfdff). It has no border and no shadow.
- **Compact post:** the same bubble as a row, with a 96px square photo (84px on phones) on the left and title and price on the right. Used in your listings and saved.
- **Notice:** a 12px-radius wash with 12px by 16px padding at 14px. It is neutral grey by default and tinted by state (info, ok, wait, bad), with a 600 title line in the same ink.
- **System message:** a centred pill of 13px Ink Faint on translucent white (72%), 6px by 14px padding, up to 42ch. Used for day separators, loading, result counts, and quiet rules pinned in a thread.
- **Internal padding:** 6 to 8px around media inside a bubble, 12 to 20px around text.

### Inputs / Fields
- **Style:** 48px tall, 12px radius, Page White, 1px Hairline Strong stroke, 11px by 14px padding. The label sits above in 14px/600 and the hint below in 13px Ink Faint. Selects use the same box with a drawn chevron. Textareas start at 160px.
- **Composer fields:** search and chat entry are pills filled Received Grey with no visible stroke, a 16px search icon inset at the left, and 42px (header), 44px (chat) or 48px (in-page search) height. On focus they turn Page White with a blue stroke and halo.
- **Fields inside a post:** on the sell form the fields lose their box and sit on the white bubble between hairlines. The label is 13px Ink Faint, the focused row gets a 2px blue underline and a Link Blue label, and title and price are typed at Post Title and Price weight.
- **Focus:** Action Blue stroke plus a 3px Blue Wash halo; the hover stroke is Ink Faint.
- **Error / Disabled:** invalid fields take a Problem Red stroke (or underline in a bubble) with a 13px/500 Problem Red message. Readonly fields fill Received Grey.

### Navigation
- **Header:** white, sticky, with a Hairline under it. It holds the V mark and "Vòng" wordmark (22px/700, -0.03em), the composer search (to 420px), nav links as 15px/500 Ink Soft pills that fill Received Grey on hover and go Ink 600 when current, counts as 20px pills, a two-letter language toggle, the account chip, and the Sell primary button. At 960px and below the links move into a drop-down panel behind a menu button, which carries a 9px Unread Red dot when there are unread messages. At 720px and below the search moves into the page.
- **Thread tabs:** districts, categories and admin sections are text tabs on a Hairline, 24px apart, 15px/500 Ink Faint. The current tab turns Ink 600 with a 2px Action Blue underline. They scroll sideways with no visible scrollbar.
- **Footer:** white with a Hairline top, a short about line in 14px Ink Faint, and plain links in Ink Soft.

### Chat Messages
The conversation is the reference the rest of the system borrows from. The body sits on the thread tint with 8px between messages. Received messages are Page White, sent messages are Action Blue with white text, and both are 20px bubbles with the tail toward their speaker, up to 75% of the width (85% on phones) and at most 520px. Timestamps sit right-aligned under the text at 12px; on a received bubble they are Ink Faint. The listing being discussed is quoted at the top as a centred 12px-radius strip (56px photo, "About this item" meta line, title and price). New messages slide up 8px into place over 180ms on the system ease. The composer bar is white with a Hairline top, a grey pill textarea that grows to 140px, and a 44px round blue send button that turns Hairline Strong when empty.

### Post (signature)
The unit of the whole product. A 36px avatar sits in the left column: initials at 13px/700 on one of six pale tints (#dcebff, #e6f5ec, #fff1d6, #fde6ee, #ebe7fd, #dff3f6), or the person's photo. The meta line is name in 14px/600 Ink, then district and time in 13px Ink Faint separated by a middle dot. Under it is the post bubble, and under that the reply line ("Reply to seller" in Link Blue with a reply-arrow icon) and Save. Your listings put a status (8px dot and word) in the meta line and the next step under the bubble as a reply. Once approved, the key form hangs off a 1px Hairline Strong rule on the left instead of sitting in a box.

### Status
- **Style:** an 8px dot in the state colour followed by the word in 13px/600 in the same ink. It is never a filled badge or a box. Neutral stages ("waiting on Vòng") use Ink Soft; stages waiting on you use Waiting Amber.

### Dialogs
- **Style:** a bottom sheet on phones and a centred 460px sheet from 640px up, Page White, 24px padding, the Float shadow, over a 40% Ink backdrop. It rises 12px over 220ms. The close button is a 40px round ghost icon button in the corner.

## Do's and Don'ts

### Do:
- **Do** put the head of a surface (title, lead, thread tabs) on Page White (#ffffff) and its content on Thread Tint (#eef5ff), with white bubbles on the tint.
- **Do** show every listing as a post: a 36px avatar, a meta line with name, district and time, then a white bubble with the 6px tail corner toward the avatar, then the reply line.
- **Do** make every pressable control a pill (999px) at least 44px tall on phones, with Action Blue (#1463f3) filling only the one primary action in view.
- **Do** show state as an 8px dot plus a word in the state ink (Done Green, Waiting Amber, Problem Red).
- **Do** set every price and amount in tabular figures at weight 700.
- **Do** keep text at Ink Faint (#5e6b7b) or darker; use Link Blue (#1452c8), not Action Blue, for blue text on tinted surfaces.
- **Do** move things with the system ease `cubic-bezier(0.16, 1, 0.3, 1)`: 150ms for state changes, 160 to 220ms for menus, messages and sheets, and nothing longer than 220ms except the skeleton pulse. Always honour reduced motion.

### Don't:
- **Don't** put uppercase or letter-spaced labels, eyebrows or kickers above headings; the only tracked caps are key codes people read aloud.
- **Don't** wrap content in bordered cards or boxes; group with 1px hairlines (#e3e7ed, #cdd4de) and space.
- **Don't** put a shadow on a post, bubble, button, rail or notice; the Float shadow is for menus and dialogs only.
- **Don't** use Unread Red (#db3226) for anything but unread; errors and danger use Problem Red (#b42318).
- **Don't** add a second typeface, a display face or a monospace; Be Vietnam Pro carries every role and must render Vietnamese diacritics.
- **Don't** lay listings out as a multi-column grid of photo tiles; the feed is one column of posts at reading width, with a rail beside it on desktop.
- **Don't** give a bubble four equal corners or more than one tight corner.
- **Don't** add a dark theme or dark surfaces; Vòng is light only.
