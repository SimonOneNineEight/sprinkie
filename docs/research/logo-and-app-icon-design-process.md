# Logo and App Icon Design — How Professionals Actually Run It

Research for [#58](https://github.com/SimonOneNineEight/daily-wlog/issues/58) (a real app icon replaces
the placeholder). Gathered 2026-10-01. Platform rules come from Apple's and Google's own current
documentation and WWDC sessions; process material comes from studios' and designers' own writing, with
canonical books cited as books. Secondary sources are labelled inline. AI-logo-tool blogs and SEO
listicles were excluded on purpose, and the one that appears below appears only as the thing being
debunked.

**Method note.** Three of the most important source families are JavaScript-rendered and return empty
shells to a plain fetch: `developer.apple.com` (HIG), `m3.material.io` / `m2.material.io`, and
`johnsonbanks.co.uk`. Apple's HIG was read through its underlying DocC JSON
(`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`); the
Material pages were read with a headless browser; Johnson Banks was read through its own
server-rendered template endpoints, with every public URL separately confirmed 200. `web.archive.org`
is **not** a workaround for Material — the snapshots are themselves SPA shells, so no archived URL for
the M2 pages is readable. Design Observer returns 403 to plain fetches and was verified via Wayback.

**Trust labels used below.** *primary* = the organisation's or author's own current page; *primary
(archived)* = theirs, but superseded or marked unmaintained; *practitioner* = a named working designer,
sometimes on a third-party publication; *secondary* = someone describing someone else's work. Every
unverified claim is flagged in §9 rather than smoothed over.

---

## TL;DR

The professional process is five or six phases, and **the first two have nothing to do with drawing**.
Across every primary source checked, the brief is an *output* of research, not an input to it. The
phase count varies (Wheeler 5, Bierut 4, Johnson 5½, Airey 6, Mozilla 4) and the most senior
practitioner in the set, Michael Bierut, has published an essay arguing the phase diagram is a fiction
designers put in proposals because clients demand one.

For an iOS app icon in 2026 the craft has moved. Since WWDC25 the icon is **source artwork for a
renderer**, not a finished picture: you supply unmasked square layers at 1024 × 1024 and the system
applies the mask, the Liquid Glass highlights, and six appearance variants. Apple now explicitly tells
you *not* to paint in the shadows and gloss that used to be the whole skill. The old "Apple wants a
flat opaque square, Google wants layered maskable art" contrast is dead — both platforms are layered
and system-masked now. The real asymmetry is that Android's mask is chosen by the OEM and Apple's is
known, which is why Android reserves 18 dp of margin and Apple does not.

Three claims in common circulation turned out to be wrong, and are corrected below: Paul Rand's
criteria are **nouns, not questions** (the famous question list is a 2015 blog post); **Bierut is the
opposite** of a one-recommended-direction designer (that was his former employer, Vignelli); and the
Android "72 × 72 dp safe zone" is **66 × 66 dp** in the current spec.

For a two-person team the compression is: keep the written brief, keep paper sketching, keep the
small-size/one-colour/in-context tests (Icon Composer does all three for free), and cut the
presentation theatre entirely — you are the client. The single most expensive mistake available is
shipping one icon when you meant to test two, because the icon lives in the binary and even Apple's own
A/B test requires the candidates to be compiled in.

---

## 1. The phases, as practitioners actually run them

### The canonical five: Alina Wheeler

[*Designing Brand Identity*](https://www.wiley.com/en-us/Designing+Brand+Identity%3A+A+Comprehensive+Guide+to+the+World+of+Brands+and+Branding%2C+6th+Edition-p-9781119984818)
(Alina Wheeler and Rob Meyerson, 6th edition, Wiley, March 2024, ISBN 978-1-119-98481-8) is the book
that standardised the five-phase model. The phase names are verified from
[Wiley's own table-of-contents PDF](https://catalogimages.wiley.com/images/db/pdf/9781119984818.toc.pdf)
(*primary*):

1. **Conducting research**
2. **Clarifying strategy**
3. **Designing identity**
4. **Creating touchpoints**
5. **Managing assets**

Wheeler, in her own voice on the [Logo Geek podcast](https://logogeek.uk/podcast/design-a-brand-identity-with-alina-wheeler/)
(episode 10, host Ian Paget — *primary speech, secondary venue*):

> There are five phases. Each phase has a set amount of tasks, and **you don't go onto the second phase
> until you finish the first phase.**

> I have developed a process that fits on one page. It has five phases, and I basically developed this
> process to build confidence in the solution, confidence in the people that are working on the brand,
> and also to just reduce what I call brand anxiety.

Her four framing questions, verified verbatim from
[Wiley's excerpt PDF](https://catalogimages.wiley.com/images/db/pdf/9781119984818.excerpt.pdf)
(*primary*) and independently from Airey quoting her: **"Who are you? Who needs to know? How will they
find out? Why should they care?"**

Wheeler (1948–2023) co-authored the sixth edition with Rob Meyerson; it was published in 2024, shortly
after her death. (The brief's "died 2021" is wrong, and later editions are not a posthumous rewrite by
strangers. The exact death date could not be verified from a primary source — see §9.)

### The five-and-a-half: Michael Johnson, Johnson Banks

[*Branding: In Five and a Half Steps*](https://thamesandhudson.com/branding-in-five-and-a-half-steps-9780500518960)
(Thames & Hudson, 2016, ISBN 9780500518960). The publisher's contents list (*primary*) reads:
**1. Investigate · 2. Strategy and Narrative · 2.5. Bridging the Gap · 3. Design · 4. Implement ·
5. Engage or Revive.**

Johnson's own description of why the half-step exists
([johnsonbanks.co.uk, 2016-09-27](https://www.johnsonbanks.co.uk/thoughts/branding-in-five-and-a-half-steps),
*primary*):

> That would identify the five key steps in the process (Investigation, Strategy and Narrative, Design,
> Implementation and Engagement) — but also acknowledge that **key half-step between Strategy and
> Design, where the translation of one into another is crucial.**

And the stripped-down version of discovery, same post:

> Many years ago we started stripping out all the jargon and just asking simple questions – 'what do
> you do?' 'what makes you different?' and 'why are you here?'

### The six, commercially: David Airey

Airey publishes his working process openly at [davidairey.com/process](https://www.davidairey.com/process)
(*primary*): **Introductions → Proposal → Research → Creative strategy → Design → Implementation.**

Note that his *commercial* brief (the Proposal: "scope, including the timeframe, deliverables,
fixed-fee pricing options, and standard working terms") precedes research, while his *creative* brief
follows it. Two different documents, routinely conflated — this is the cleanest resolution of the
apparent "does the brief come before or after research?" contradiction.

### The four that are also a confession: Michael Bierut, Pentagram

["This is My Process"](https://designobserver.com/this-is-my-process/) (Design Observer, 2006-09-09;
*primary*, verified via [Wayback](http://web.archive.org/web/20260216031213/https://designobserver.com/this-is-my-process/)
because the live URL 403s):

> For over twenty years, I've been writing proposals for projects. And almost every one of them has a
> passage somewhere that begins something like this: "This project will be divided in four phases:
> Orientation and Analysis, Conceptual Design, Design Development, and Implementation." All clients want
> this. Sometimes there are five phases, sometimes six. Sometimes they have different names. But it's
> always an attempt to answer a potential client's unavoidable question: can you describe the process you
> use to create a design solution that's right for us?

> But guess what? **The process I so reassuringly put forward at the outset had almost nothing to do with
> the way the project actually went.** What would happen, I wonder, if I actually told the truth about
> what happens in a design process?

> When I do a design project, I begin by listening carefully to you as you talk about your problem and
> read whatever background material I can find that relates to the issues you face… Somewhere along the
> way an idea for the design pops into my head from out of the blue. I can't really explain that part;
> it's like magic… Now, if it's a good idea, I try to figure out some strategic justification for the
> solution so I can explain it to you without relying on good taste you may or may not have.

The punchline is that he traced his own four-phase diagram to a manufacturing paper: "I've used a
version of it in hundreds of proposals over the years. I never really believed it was an accurate way
to describe the process. I simply never had the confidence to describe the process in any other way.
Like a lot of designers, I've considered my real process my little secret."

### The four, from the client's side: Mozilla's open rebrand

The only identity project in this research documented in real time from *both* sides. Mozilla published
its own four-phase plan at [blog.mozilla.org/opendesign](https://blog.mozilla.org/opendesign/about/)
(*primary*, client-authored): **IDEATION · CONCEPTING · REFINEMENT · GUIDANCE**, with Johnson Banks as
the partner. Refinement is explicitly the test phase: "Here's where we pressure test our concepts to
determine which ones will work best in a variety of situations."

The funnel, as it actually ran (all *primary*, Johnson Banks' own posts): seven strategic themes
([2016-06-21](https://www.johnsonbanks.co.uk/news/mozillas-creative-strategy)) → five
([2016-08-14](https://www.johnsonbanks.co.uk/news/and-then-there-were-five)) → seven design routes
([2016-08-17](https://www.johnsonbanks.co.uk/news/our-first-design-routes-for-mozilla)) → four
([2016-09-16](https://www.johnsonbanks.co.uk/news/mozilla-thedesign-development)) → one
([2017-01-18](https://www.johnsonbanks.co.uk/news/mozilla-the-chosen-route)). Ten months, "countless
design routes, thousands of blog comments, and hundreds of video conferences."

**The plan did not survive the work, and it is documented.** Mozilla's Tim Murray wrote on 2016-08-17
that they would "reduce these seven concepts to three… We're on track to have a final direction by the
end of September." It went to four, and the final route landed in January. That pairs exactly with
Bierut's essay, and it is the most useful single fact in this section.

### Other studios

- **Moving Brands** publishes a six-step *strategy* process — "1. Go Deep / 2. Ground in human needs /
  3. Uncover the core / 4. Determine the role / 5. Shape the story / 6. Action it"
  ([2024-08-19](https://movingbrands.com/news/six-steps-to-an-unshakeable-strategy/), *primary*), with
  the honest caveat: "That's not to say we apply a 'One Size Fits All' formula to every client
  challenge."
- **COLLINS** publishes *scope lists*, not phases — "Competitive Landscape Analysis Reports… Value
  Proposition Design… Naming… Brand Identity Design" on its
  [Brand Creation](https://wearecollins.com/programs/brand-creation/) page (*primary*). No sequence, no
  concept counts, no timeline.
- **Landor's** five steps exist only via a *Computer Arts* feature hosted on Landor's own asset server
  ([Feb 2012 PDF](https://s3-us-west-2.amazonaws.com/lndr-landorcom-assets-prd/app/uploads/2015/09/01171552/CA_Landor_Branding_Masterclass_Feb2012.pdf)) —
  the step names are the journalist's structure, so *secondary*. Landor's current site has no process
  page.
- **Pentagram** publishes no step-by-step process at all. Every `pentagram.com/work/<slug>/story` page
  uses the same shell: title → descriptor → tags → "About the project" → image captions → narrative →
  credits. No phases, no concept count, no timeline, no deliverables list. The nearest phase language
  found anywhere on the site is "An extensive and immersive cultural research phase was essential for
  the success of this project" ([Chiba Tech](https://www.pentagram.com/work/chiba-tech/story)).

### Where sources disagree

| Source | Count | Names |
|---|---|---|
| Wheeler, *Designing Brand Identity* 6e | 5 | Conducting research · Clarifying strategy · Designing identity · Creating touchpoints · Managing assets |
| Johnson, *Branding* (publisher's contents) | 5½ | Investigate · Strategy and Narrative · **2.5 Bridging the Gap** · Design · Implement · Engage or Revive |
| Airey, davidairey.com/process | 6 | Introductions · Proposal · Research · Creative strategy · Design · Implementation |
| Bierut, proposal boilerplate | 4 | Orientation and Analysis · Conceptual Design · Design Development · Implementation |
| Mozilla open-design plan (client-side) | 4 | Ideation · Concepting · Refinement · Guidance |
| Moving Brands (strategy only) | 6 | Go Deep · Ground in human needs · Uncover the core · Determine the role · Shape the story · Action it |
| Landor, via *Computer Arts* (secondary) | 5 | problem-solving · brand strategy · brand expressions · into practice · ongoing |

**Brief before or after research?** After, in every primary creative process checked. Wheeler puts the
*brand brief* in Phase 2 (p. 146), after Phase 1's findings report (p. 138). Airey's book runs
"Questions before ideas → Summarize the business → Summarize the project → Research with purpose →
Assembling the design brief". Johnson: "After the first meetings there's a longish stage of research,
then a stage working on the words and strategy behind a project. Then then design brief…" (the doubled
"Then then" is in the original). The only inversion is the commercial proposal, noted above.

**Is testing a named phase?** Usually no. Wheeler has no testing phase — *usability testing* sits inside
Phase 1 and *trial applications* at the end of Phase 3; validation is distributed, not staged. Mozilla
is the exception, naming REFINEMENT as the test phase. Johnson Banks describes testing as an activity:
"an extensive round of testing ensued, online, at conferences, and in global research". Bierut has no
testing phase and argues the sequence is fiction anyway.

**Linear or iterative?** The sharpest disagreement in the whole set. Wheeler is strictly gated. Johnson
Banks blurs on principle: "We don't see the branding process as a divide between strategy and design –
we're fluent in both and often blur the stages together"
([how we work](https://www.johnsonbanks.co.uk/about/how-we-work)), and reports having to "redo design
stages three or four times" ([2013-01-21](https://www.johnsonbanks.co.uk/thoughts/absolutionism-versus-more-ideas)).
Bierut says the diagram never matched reality. The empirical check is Mozilla's 7→3 plan becoming 7→4.

**How many concepts do you present?** Genuine, sharp disagreement, all *primary*:

- **Johnson, against one route** ([2012-10-29](https://www.johnsonbanks.co.uk/thoughts/an-insiders-guide-to-the-design-presentation)):
  "The truth is, 'one route' is a hugely risky strategy. You only need one naysayer on the board, and
  things can very quickly unravel… Little surprise then that '3 routes' is much more likely." He also
  catalogues the cynical version: "Another variant is the 'degrees of interesting' scale… where a dull
  grey route is followed with an entirely acceptable route (usually in blue). Then there's 'the crazy
  route' which is shown quickly with a few accompanying jokes and it's assumed the client will be just
  way too scared to go for that." In ~20 years, one idea presented and signed off happened "On about
  three occassions" (*sic*).
- **Airey, for narrowing early**: "three or four potential design directions are generally explained in
  words, often with a sketch or two for each", then "it's normal for just one or two refined ideas to
  be shown". And in his own comments: "too many options makes the decision much more difficult"
  ([2015-07-09](https://www.logodesignlove.com/how-many-options)).
- **Vignelli, one solution**, as reported by Bierut: "I prepare the presentation, I show it to the
  client and the client's job is to say 'I love it'."
- **Bierut, explicitly neither** ([Behance interview](https://www.behance.net/blog/michael-bierut-on-finding-your-voice),
  *primary speech, secondary venue*): "I could never go into a meeting and say, 'I have the one true
  perfect solution for this job.' With that method you've got your one arrow and they've got their one
  target and you close your eyes and you shoot it."

> **Correction to a common claim.** Bierut is often described as a single-recommended-direction
> designer. He is the opposite, in his own words, and he names Vignelli as the designer who worked that
> way. Do not attribute the one-option method to him.

**Timelines vary by an order of magnitude, and the parties to one project don't even agree.** Johnson:
"Sometimes it's a beautiful, breezy process that skips along in a matter of weeks… (Just last week we
finally had a route signed off by a global NGO twenty-six months after we wrote our first proposal)"
([2016-06-15](https://www.johnsonbanks.co.uk/thoughts/designing-in-the-open)). Airey: "a number of weeks
to fully prepare a presentation for review." And for the *same* Mozilla project, Johnson Banks says
"the last 10 months" while Mozilla's Tim Murray says "Seven months since setting out"
([blog.mozilla.org/opendesign/arrival/](https://blog.mozilla.org/opendesign/arrival/), 2017-01-18) —
both *primary*, both published the same week.

---

## 2. What each phase delivers

Wheeler's Phase sub-spreads are the most complete published deliverables list, and they are verifiable
line by line from the Wiley TOC:

| Phase | Deliverables (Wheeler's own sub-spread titles, with book page numbers) |
|---|---|
| 1 Conducting research | Defining the problem (126) · Market research (128) · Usability testing (130) · Marketing audit (132) · **Competitive audit (134)** · Verbal audit (136) · **Findings report (138)** |
| 2 Clarifying strategy | Narrowing the focus (142) · Positioning (144) · **Brand brief (146)** · Naming (148) |
| 3 Designing identity | Identity system design (152) · Look and feel (154) · Color (156) · Typography (158) · Iconography (160) · Sound (162) · Other senses (164) · **Trial applications (166)** · **Presentation (168)** |
| 4 Creating touchpoints | Content strategy · Website · Collateral · Stationery · Product design · Packaging · Advertising · Branded environments · Signage and wayfinding · Vehicles · Uniforms · Ephemera (172–194) |
| 5 Managing assets | Changing brand assets (198) · Launching (200) · Building brand champions (202) · **Online brand centers (204)** · **Guidelines (206)** · Guidelines content (208) · Brand books (210) |

Two things worth noticing. "Trial applications" sits *before* "Presentation" — the mark is tested in
context before anyone sees it formally. And Phase 5 has four separate guideline deliverables, which is
the honest measure of how much of a real identity project is documentation rather than drawing.

### What the brief document actually contains

Airey's is the most quotable, from the complete Chapter 4 of *Logo Design Love* 3rd ed.
([free sample PDF](https://www.davidairey.com/samples/logo_design_love_free.pdf), New Riders/Peachpit,
© 2026, ISBN 978-0-13-547675-8 — *primary*):

> Before you begin sketching ideas or refining letterforms, there's something more important to
> understand: your client. Who are they? Why have they come to you? What do they hope to achieve? The
> answers form the foundation for any successful identity project. **Design isn't decoration. It's a
> strategic response to a business need.**

> A good design brief is much more than paperwork. It's a contract of clarity and a written
> understanding of what success looks like.

> A strong brief doesn't constrain creativity. It channels it.

> Someone who knows exactly what they want doesn't need a designer. They need a technician.

His research-review questions, verbatim: "What are the client's concerns? What does the company want to
emphasize? What is it really selling? How does it want to be perceived in the market? Identities that
are stylish and nice to look at might win awards, but they don't always win market share."

Mozilla published its actual written design brief, which is rare and worth reading as a model
([2016-08-17](https://www.johnsonbanks.co.uk/news/our-first-design-routes-for-mozilla), *primary*):
"Explore a wide range of design solutions jumping off from ongoing narrative work / Chime with
'conscious choosers', more millennial, edgier and cooler design / Reflect the new core personality:
Gutsy, Independent, Buoyant, For Good / Search for a wide-ranging design system that links across all
Mozilla activities / Look for designs that will make people re-assess Mozilla, and attract new
audiences…"

### What the presentation delivers

Airey: "Presentations include a comprehensive demonstration of how your logo or identity works in
real-world applications, such as sample advertising, websites, uniforms, stationery, vehicle graphics,
or other items relevant to your brand." Johnson Banks' modern alternative is to show the journey:
"share the design journey you have been on, and the presentation becomes a workshop: two-way, not one"
([2018-01-08](https://www.johnsonbanks.co.uk/thoughts/transparency-starts-at-home)).

### What the final asset package contains

Six organisations' public guidelines were checked. The convergent pattern, stated once:

**vector master plus raster derivative, split by colour model · clear space expressed as a multiple of
an element of the mark itself · minimum size in both print and screen units, sometimes with a
separately drawn small-size variant below it · a one-colour black/white version as a first-class
deliverable · a numbered misuse list.**

- **[MIT Brand Guide](https://brand.mit.edu/downloads)** has the cleanest format breakdown (*primary*):
  "Each download includes three sub-folders: CMYK (process color for print): .ai and .jpg files / PMS
  (exact color matching for print): .ai files / RGB (digital use for screen viewing): .png and .svg
  files". Clear space is "equal to the width of the M in the MIT logo". And it is the clearest example
  of drawing a *second* mark for small sizes: "At very small sizes it requires adjustments to optimize
  its appearance and legibility, and we have designed a variation for use in small-scale
  applications" — standard logo above .25″/30 px, micro logo .125″–.25″/15–30 px
  ([MIT logo](https://brand.mit.edu/logos-marks/mit-logo)).
- **[ONS Service Manual](https://service-manual.ons.gov.uk/brand-guidelines/logo)** is the most granular
  (*primary*): clear space "equivalent to the width and depth of the ONS symbol"; minimum sizes given
  per lockup *and per language* (40 mm stacked / 50 mm landscape English; 43 mm / 53 mm Welsh and
  bilingual; 110/140 px and 120/150 px digital); and two download packs split print-CMYK/Pantone-AI from
  digital-RGB-PNG/SVG.
- **[GOV.UK Brand Guidelines](https://brand.design-system.service.gov.uk/logo-system/logo-elements)**
  (*primary*): "The clear space area is defined by the dot size within our wordmark"; "Wordmark minimum
  width: 50px / Crown minimum width: 16px / Use the small crown version for anything below the crown's
  minimum size, such as web favicons."
- **[City of Helsinki](https://www.hel.fi/en/decision-making/information-on-helsinki/design-and-digitalisation/helsinki-brand-and-visual-identity/visual-identity-guidelines/use-basic-elements)**
  (*primary*) changes the clear-space rule by size: "In the large version, the protected area is twice
  the height of the letter 'H'… In the small version, the absolute minimum protected area is the height
  of one letter 'H'."
- **[NASA Brand Center](https://www.nasa.gov/nasa-brand-center/brand-guidelines/)** (*primary*) supplies
  "four variations: a full-color Insignia, a one-color, one-color with a white rule and mono-color
  w/white rule", clear space as "1N height from the edge of the sphere", and the rule everyone gets
  wrong: "The insignia is not symmetrical and should be center aligned using its blue sphere
  (sphere-centered), not object-centered."
- **[NASA Graphics Standards Manual, NHB 1430.2, January 1976](https://www.nasa.gov/wp-content/uploads/2015/01/nasa_graphics_manual_nhb_1430-2_jan_1976.pdf)**
  (*primary, archived*) is the historical artefact, and shows what "delivery" meant before files: Section
  2 is camera-ready reproduction art, one page per NASA centre. "The logotype should never be altered or
  distorted in any way. It must not be re-drawn, but rather reproduced photographically from reproduction
  artwork included in Section 2 of this manual." The nine-item misuse list begins: "1. The letterforms in
  the logotype must never be broken by a superimposed pattern. 2. The logotype must never be placed
  within another solid shape, such as a circle…" (The PDF is a 1976 scan; its OCR artefacts are
  preserved in those quotes.)

Where the field is moving: Wheeler's 6th edition carries a From/To table credited to Monigle whose most
relevant row is "**Static PDF guidelines → Dynamic, evolving applications**", with the flat statement
"Traditional PDF or static guidelines can no longer keep up with changing needs."

---

## 3. The rules of thumb, and who actually said them

### Paul Rand — nouns, not questions

[*Logos, Flags, and Escutcheons*](https://www.paulrand.design/writing/articles/1991-logos-flags-and-escutcheons.html),
originally published in 1991 by AIGA; also in *Looking Closer: Critical Writings on Graphic Design*
(Allworth Press, 1994). The page is Rand's official estate site. Verified from raw HTML (*primary*):

> The effectiveness of a good logo depends on: a. distinctiveness b. visibility c. useability
> d. memorability e. universality f. durability g. timelessness

("useability" is the page's spelling.) And the one line that justifies two of the cheap tests in §6:

> Ultimately, the only thing mandatory, it seems, is that a logo be attractive, **reproducible in one
> color and in exceedingly small sizes.**

On what a logo is for:

> A logo is a flag, a signature, an escutcheon. A logo doesn't sell (directly), it identifies. **A logo
> is rarely a description of a business. A logo derives its meaning from the quality of the thing it
> symbolizes, not the other way around.** A logo is less important than the product it signifies; what
> it means is more important than what it looks like.

On simplicity:

> The role of the logo is to point, to designate — in as simple a manner as possible. A design that is
> complex, like a fussy illustration or an arcane abstraction, harbors a self-destruct mechanism. Simple
> ideas, as well as simple designs are, ironically, the products of circuitous mental purposes.
> Simplicity is difficult to achieve, yet worth the effort.

> **Correction to a widely repeated claim.** The question-form list — "Is it distinctive? Is it visible?
> Is it adaptable? Is it memorable? Is it universal? Is it timeless?" — is **not Rand's text**. It is a
> 2015 construction by Dave Schools, circulated as "the 7-step Paul Rand logo test" via Medium and The
> Next Web and from there into hundreds of SEO logo blogs. "Adaptable" does not appear in the 1991
> essay. If you need the criteria, quote the seven nouns above.
>
> Where "adaptable" probably comes from: Rand appears to have given **at least two non-identical
> lists**. The Schools post's stated basis is a *six*-noun version including "adaptability", attributed
> to *Design, Form, and Chaos* (Yale University Press, 1993). That book exists (Internet Archive
> identifier `designformchaos0000rand`) but is lending-only, and the quote **could not be verified
> against any readable source** — archive.org search-inside and the Google Books API both returned
> nothing, and `paulrand.design`'s page for that book carries only review blurbs. Two lists is the
> likeliest explanation, but only the 1991 seven-noun list is quotable.

Rand's "Don't try to be original, just try to be good" is attributed to a filmed interview, not his
writing. The written form is verified on [paulrand.design/writing/quotes](https://www.paulrand.design/writing/quotes.html)
(*primary*): "Mies van der Rohe once said that being good is more important than being original.
Originality is a product, not an intention."

### David Airey — the practical checklist

From ["Logo design tips from the field"](https://www.logodesignlove.com/logo-design-tips) (2009-05-27,
excerpted from the book — *primary*):

> **Work in black first** — By leaving colour to the end of the process, you focus on the idea. No amount
> of gradient or colour will rescue a poorly designed mark.

> **A simple logo aids recognition** — Keeping the design simple allows for flexibility in size. Ideally,
> your design should work at a minimum of around one inch without loss of detail.

> **A logo doesn't need to say what a company does** — Restaurant logos don't need to show food, dentist
> logos don't need to show teeth… The Mercedes logo isn't a car. The Virgin Atlantic logo isn't an
> aeroplane. The Apple logo isn't a computer.

> **One thing to remember** — That's it. Leave your client with just one thing to remember about the
> design. All strong logos have one single feature to help them stand out. Not two, three, or four. One.

> **Picasso started somewhere** — You don't need to be an artist to realise the benefits of sketching.
> Ideas can flow much faster between a pen and paper than they can a mouse and monitor.

Sketching gets a whole chapter. *Logo Design Love* 2nd ed.'s ch. 7, "From pencil to PDF", runs
"Mind mapping (80) · The necessity of the sketchpad (84) · Form before color (101) · The pen is mightier
than the mouse (106)" (verified as headings and page numbers from
[Pearson's sample PDF](https://ptgmedia.pearsoncmg.com/images/9780321985200/samplepages/9780321985200.pdf);
the index corroborates "thumbnail sketches, 47").

*Logo Design Love* 3rd ed.'s framing of the whole discipline, from the introduction: "Distilling the
essence of a brand into a mark that works at an inch in size — that's what logo design is really
about… to take something vast — vision, values, voice — and reduce it to something small enough to sit
on a pen cap or appear as a favicon."

Chapter 11's tip list (verified as headings and page numbers from
[Pearson's own sample PDF](https://ptgmedia.pearsoncmg.com/images/9780321985200/samplepages/9780321985200.pdf)
of the 2nd edition — *primary for the headings, body prose not seen*) is effectively a test battery:
"10. Work in black and white — 165 / 16. Offer a single-color version — 166 / 17. Pay attention to
contrast — 166 / 18. Test at a variety of sizes — 168 / 19. Reverse it — 168 / 20. Turn it upside down
— 168".

### Apple's version of "simple", as a rendering constraint

From the [HIG, App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
(*primary*, change log "June 8, 2026 — Refined guidance for Liquid Glass"):

> Embrace simplicity in your icon design. Simple icons tend to be easiest for people to understand and
> recognize. An icon with fine visual features might look busy when rendered with system-provided shadows
> and highlights, and details may be hard to discern at smaller sizes. Find a concept or element that
> captures the essence of your app or game, make it the core idea of your icon, and express it in a
> simple, unique way with **a minimal number of shapes**.

"A minimal number of shapes" and Icon Composer's hard cap of four layer groups are the same rule stated
twice. The session makes the reasoning explicit: four "provides the right bounds for how much visual
complexity an icon should have" ([WWDC25 361](https://developer.apple.com/videos/play/wwdc2025/361/),
Lyam, Apple Design Team).

Google's M2 phrasing of the same instinct, from the page it no longer maintains: "Don't add too many
layers", "Don't overlap more than two elements to avoid overcomplicating the icon", and "Icons
communicate the core idea and intent of a product in a simple, bold, and friendly way"
([M2 Product icons](https://m2.material.io/design/iconography/product-icons.html)).

### Distinctiveness against the category

The one criterion no platform vendor can give you, because it depends on what your competitors shipped.
The sharpest practitioner statement is Michael Flarup's, who specialises in app icons
([Smashing Magazine, 2017-01-17](https://www.smashingmagazine.com/2017/01/designing-better-app-icons/) —
*practitioner*): "Consider what everyone else is doing in your space and go in a different direction."
His four judging lenses are **scalability, recognizability, consistency, uniqueness**, and his stated
process is three steps, "researching, sketching and rendering" — the structure of the iOS volume of
[The App Icon Books](https://appiconbook.com/) (self-published; contents verified from the author's own
site only, I have not read the book).

On scale, he names the specific trap the 1024 canvas creates: "Working on a 1024 × 1024-pixel canvas can
be deceptive. Try out the design on the device and in multiple contexts and sizes." On text he is harder
than Apple: "Only on the rarest of occasions is it OK to use words in an app icon."

### Appropriateness has a legal floor

Worth treating as a rule of thumb rather than a footnote. Apple requires icons to "adhere to a 4+ age
rating even if your app is rated higher" ([App Review 2.3.8](https://developer.apple.com/app-store/review/guidelines/)).
Google's policy bans "Misleading symbols in app icons, for example: new message dot indicator when there
are no new messages and download/install symbols when the app is not related to downloading content"
([Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842)).

### What a studio's "testing" actually looks like

Pentagram's Mastercard case study is the best public example of reduction and context-testing as real
labour ([pentagram.com/work/mastercard/story](https://www.pentagram.com/work/mastercard/story),
*primary*; partners Michael Bierut and Luke Hayman):

> Getting the three colors in the mark right was a challenge for the designers, requiring **hundreds of
> tests** to find the perfect hues that would work successfully in every conceivable context.

> The logo needed to work on white backgrounds, black backgrounds, and different values in between.

And the Verizon study is the clearest statement of reproducibility as the whole rationale for a redesign
([pentagram.com/work/verizon/story](https://www.pentagram.com/work/verizon/story), *primary*):

> The complexity of the original Verizon logo — it incorporates a modified italic typeface, two colors, a
> stylized letter "z," a v-shaped form that sometimes appears above the name and sometimes next to it, and
> gradations in multiple locations — **has made it difficult to reliably reproduce in different media.**
> This inconsistency has only increased over time.

Johnson Banks on drawing size-specific versions, which is the professional answer to the small-size rule
(Michael Johnson quoted in [Creative Bloq, 2010-05-07](https://www.creativebloq.com/computer-arts/johnson-banks-5108856)
— *secondary venue, his own words*): "We actually drew it in three different versions — very large,
normal and small. We often do that with our logos."

---

## 4. Where an iOS app icon stops being a logo

A brand mark is drawn once and then adapted by a human to each place it appears. An iOS app icon is
drawn once and then *rendered* by the operating system into six appearances, an unknown number of sizes,
and a mask you do not control. The craft shifts from "make a mark" to "make source artwork a renderer can
treat well". Everything in this section is from Apple's current guidance unless marked otherwise.

### Canvas and mask

- **1024 × 1024 px, square, for iPhone, iPad and Mac.** From the HIG specifications table (watchOS
  1088 × 1088, tvOS 800 × 480, visionOS 1024 × 1024). Icon Composer uses the same numbers: "1024 x 1024
  pixels for iPhone, iPad, and Mac, and 1088 x 1088 pixels for Apple Watch"
  ([Icon Composer docs](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer)).
- **You do not draw the rounded corners.** "In iOS, iPadOS, and macOS, icons are square, and the system
  applies masking to produce rounded corners that precisely match the curvature of other rounded
  interface elements throughout the system and the bezel of the physical device itself." Pre-masking is
  actively harmful: "Providing layers with pre-defined masking negatively impacts specular highlight
  effects and makes edges look jagged." The archived Q&A is blunter: "Do not inset your icon artwork and
  make sure your icon has 90° corners so it looks good after the mask is applied"
  ([QA1686](https://developer.apple.com/library/archive/qa/qa1686/_index.html), 2016-12-20 — *primary,
  archived*).
- **Centre the content.** "Keep primary content centered to avoid truncation when the system adjusts
  corners or applies masking." There is no numeric reserved margin, because the mask is known per
  platform rather than chosen by an OEM.
- **The grid lives only in the template files** — "App Icon Template (iOS, iPadOS, and watchOS 27)" for
  Figma, Sketch, Photoshop and Illustrator
  ([Apple Design Resources](https://developer.apple.com/design/resources/)). WWDC25 describes the change
  qualitatively: "We've updated the design grid to a simpler and more evenly spaced structure. And the new
  grid also features a rounder corner radius, which makes the icons sit more concentric with our UI and
  even within our hardware" ([WWDC25 220](https://developer.apple.com/videos/play/wwdc2025/220/), Marie,
  Apple Design Team).

### Transparency — the claim splits in two

"No transparency" is true of one specific file and false of the rest.

- **The default (light) master must be opaque.** QA1686: "All icon images must be in PNG format. Icon
  images may include an alpha channel but should not include any transparent regions." The current HIG
  says the same of an imported background: "If you do import a background layer, make sure it's
  full-bleed and opaque." Upload validation enforces it — the exact rejection is
  `ERROR ITMS-90717: "Invalid App Store Icon. The App Store Icon in the asset catalog in 'Exponent.app'
  can't be transparent nor contain an alpha channel."` (verbatim Apple validator string, reproduced in
  [expo/expo#1086](https://github.com/expo/expo/issues/1086) — *secondary* for the wording, but it is a
  machine-generated message).
- **Foreground layers are meant to be translucent.** "Vary opacity in foreground layers to increase the
  sense of depth and liveliness."
- **The dark variant is supplied transparent on purpose.** "Provide your dark app icon with a transparent
  background so the system-provided background can show through. Provide your tinted app icon as a
  grayscale image"
  ([Configuring your app icon using an asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)).

### Layers and the six appearances

- iOS/iPadOS/macOS/watchOS icons "include a background layer and one or more foreground layers that
  coalesce to create dimensionality", taking on "Liquid Glass attributes like specular highlights,
  refraction, and translucency".
- **A flat PNG is still legal.** "Although you can provide a flattened image for your icon, layers give
  you the most control over how your icon design is represented." This matters enormously for a team
  without a designer.
- **Four groups, maximum.** "organize the layers that appear in the default group into a maximum of four
  groups to reduce complexity." The simplest shipping icons use two: "At its very simplest, icons have a
  background and one foreground layer, like in our Messages icon" (WWDC25 220).
- **Six appearances on iOS/iPadOS/macOS**: "Default, dark, clear light, clear dark, tinted light, tinted
  dark". You annotate three — "we renamed these to default, dark and mono, with the artwork producing all
  the appearances for clear and for tinted" (WWDC25 361) — and "the system automatically generates
  variants you don't provide."
- Consistency across appearances is a rule, not a preference: "Keep your icon's features consistent
  across appearances… Avoid creating custom icon variants that swap elements in and out." And: "A great
  app icon is visible, legible, and recognizable, regardless of its appearance variant."
- Backgrounds: "Use your light app icon as the basis for your dark icon… Color backgrounds generally
  offer the greatest contrast in dark icons." WWDC25 is more directive: "We've also developed a System
  Light and System Dark gradient that should be used instead of pure white or black backgrounds" and
  "With the success of dark mode, we actually recommend leaning more into colored backgrounds, so that
  there is a nicer distinction when switching between modes." Also: "Avoid using black for your icon's
  background."

### Do not bake in effects

> Let the system handle blurring and other visual effects… there's no need to include specular
> highlights, drop shadows between layers, beveled edges, blurs, glows, and other effects. In addition to
> interfering with system-provided effects, custom effects are static, whereas the system supplies
> dynamic ones.

Icon Composer's prep checklist is the operational version: "Remove blurs and shadows, and specular,
opacity, and translucency settings", "Remove background colors and gradients", and "Don't export the
canvas mask because the system applies that automatically to ensure a perfect crop."

This is the largest break from pre-2025 iOS icon practice, where hand-painted gloss and shadow *were*
the craft. WWDC25 220: "You can see a range of these baked-in effects in the previous Home icon, like
drop shadows or bevelled edges… the new artwork for Home is a simplified version of the previous design.
We've reduced the amount of layers, made the shapes rounder, and removed any additional material
effects." And on illustration style: "Realistic 3D objects and perspectives like in the previous Chess
icon can compete with the material qualities. The redesigned icon uses a frontal view and a more flat
appearance."

### The small-size rule

Expressed as a drawing constraint rather than a size table:

- "An icon with fine visual features might look busy when rendered with system-provided shadows and
  highlights, and details may be hard to discern at smaller sizes."
- "Make sure to avoid extremely thin line weights and sharp corners, because they tend to lose detail and
  crispness in smaller icon sizes at lower resolutions."
- WWDC25 220: "Ideally, sharp edges and thin lines should be avoided… for the ones that do [take the
  material treatment], it helps to use bolder line weights as it will preserve details at a smaller
  scale."
- "The system automatically scales your icon to produce smaller variants that appear in certain
  locations, such as Settings and notifications."

**The current HIG publishes no per-context point-size table.** The old 60pt/29pt/20pt inventory is gone;
the only numbers on the page are the 1024 layout size and the colour spaces (sRGB, Gray Gamma 2.2,
Display P3). Historical pixel sizes survive in QA1686 (120, 180, 76, 152, 167, 1024) — useful for
intuition about how small the icon really gets, not as a current spec.

### Text

Apple's rule is a strong discouragement, not a ban, and it is usually misquoted as absolute:

> Include text only when it's essential to your experience or brand. Text in icons doesn't support
> accessibility or localization, is often too small to read easily, and can make an icon appear
> cluttered… Although displaying a mnemonic like the first letter of your app's name can help people
> recognize your app or game, avoid including nonessential words that tell people what to do with it —
> like "Watch" or "Play" — or context-specific terms like "New" or "For visionOS."

Note the two separate reasons: localization and accessibility, not only legibility. Icon Composer forces
the issue anyway — "convert text to outlines… Because SVG format doesn't preserve fonts."

### The SF Symbols licence restriction — verified, and narrower than usually stated

The claim is **true**, and Apple states it in the HIG rather than only in the licence
([HIG, SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols), *primary*):

> Be sure to understand the terms and conditions for using SF Symbols, including the prohibition against
> using symbols — or images that are confusingly similar — in app icons, logos, or any other trademarked
> use.

Scope notes, because this is easy to over-read:

- It bans symbols **in app icons, logos and trademark use**. It does not ban using SF Symbols inside the
  app's interface — that is the entire point of the framework.
- Related but separate: "you can't customize a symbol that SF Symbols identifies as representing an Apple
  feature or product", and "Don't design replicas of Apple products."
- **The licence's verbatim text is not on any developer.apple.com page I could fetch.** It is not in the
  [Xcode and Apple SDKs Agreement PDF](https://www.apple.com/legal/sla/docs/xcode.pdf) — I extracted the
  text and searched it; zero occurrences of "Symbol". The commonly circulated wording ("You may not use SF
  Symbols — or glyphs that are substantially or confusingly similar — in your app icons, logos, or any
  other trademark-related use…") appears in a
  [developer-forum post by a community member, not Apple staff](https://developer.apple.com/forums/thread/724523).
  **Treat the exact wording as lower-trust; the restriction itself is primary via the HIG.**
- Apple's icon guidance also forbids hardware: "Don't use replicas of Apple hardware products. Apple
  products are copyrighted and can't be reproduced in your app icons."

### Review rules that touch the icon

From the [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):

- **2.3.8** — icons must suit a 4+ rating regardless of the app's rating, and "ensure your metadata,
  including app name and icons (small, large, Apple Watch app, alternate icons, etc.), are similar to
  avoid creating confusion."
- **4.1(c)** — "You cannot use another developer's icon, brand, or product name in your app's icon or
  name, without approval from the developer."
- **5.2.5** — don't look "confusingly similar to an existing Apple product, interface (e.g. Finder),
  app… or advertising theme."
- Alternate icons are not a loophole: "all alternate and variant icons are subject to app review and must
  adhere to the App Review Guidelines."

### Delivery, for real

One of two packages, not both:

1. **Layered** — an Icon Composer `.icon` file. "Use Icon Composer to create a single multilayer file
   that you can add to your Xcode project to represent your Liquid Glass app icon everywhere your app
   icon appears across iOS, iPadOS, macOS, watchOS, and the App Store." Adding it "replaces any existing
   icon asset catalog", and Xcode "automatically generates a similar-looking version of the Liquid Glass
   icon for previous releases." Icon Composer is macOS-only and ships inside Xcode.
2. **Flat** — a 1024 × 1024 opaque PNG in the asset catalog's "Any Appearance" well, optionally plus dark
   (transparent background) and tinted (grayscale) images.

Plus, from Icon Composer, "the option to export a flattened version of your icon for marketing and
communication needs" ([Apple Design Resources](https://developer.apple.com/design/resources/)) — a
separate deliverable from the `.icon` bundle, and the one that goes on a website or README.

**The icon ships in the binary.** There is no server-side swap. App Store Connect's own A/B-testing docs
state the constraint: "any app icons you wish to use must be part of the app binary for the current App
Store version"
([Configure test treatments](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/configure-test-treatments/)).

---

## 5. Google's side, and where the platforms actually diverge

### Material Design 3 deleted its product-icon guidance

`m3.material.io/sitemap.xml` contains exactly three icon pages — `/styles/icons/overview`,
`/styles/icons/designing-icons`, `/styles/icons/applying-icons` — and none mentions "product icon", "app
icon" or "launcher". M3's iconography guidance is entirely about *system* icons and Material Symbols. The
detailed product-icon construction rules survive only on
[Material 2's Product icons page](https://m2.material.io/design/iconography/product-icons.html), which
carries the banner "Material 2 is no longer maintained. Upgrade to Material 3, the latest version of
Material Design." Android Studio's own
[Image Asset Studio docs](https://developer.android.com/studio/write/create-app-icons) still link
designers to that archived page — good evidence this is a gap rather than a replacement.

What M2 says, for the record (*primary, unmaintained*):

- "Product icons are the visual expression of a brand's products, services, and tools."
- The paper metaphor: "Each icon is cut, folded, and lit as paper would be, but represented by simple
  graphic elements. The quality of Material is sturdy, with clean folds and crisp edges." Its parent
  statement is on [M2's introduction](https://m2.material.io/design/introduction) under the heading
  "Material is the metaphor": "Material surfaces reimagine the mediums of paper and ink."
- Working scale: "When creating an icon, view and edit it at 400% (192 x 192 dp), which will display edges
  at 4dp… which preserves sharp edges and correct alignment when the scale is returned to 100% (48dp)."
- Keyline shapes, quoted at the 192 dp working scale: "Square — Height: 152dp, Width: 152dp / Circle —
  Diameter: 176dp / Vertical rectangle — Height: 176dp, Width: 128dp / Horizontal rectangle — Height:
  128dp, Width: 176dp". At 1:1 that is square 38 dp, circle 44 dp, rectangles **44 × 32 dp** (the ÷4
  arithmetic is ours, not Google's text — and note it is *not* the 44 × 38 dp often quoted). The grid
  itself exists only as images.
- Shadow and light are specified down to Illustrator values — drop shadow "Opacity: 20% / X Offset: 4dp /
  Y Offset: 4dp / Blur: 4dp", a 1 dp white 20% tinted top edge, a 1 dp 20% shaded bottom edge — with the
  caveat "Note the values outlined in this article are referenced from Adobe Illustrator."

**Flagged**: the often-repeated "48 dp grid" and "2 dp padding / 2 dp stroke" figures are not on the
product-icon page. The 48 dp appears only as the 100%-scale parenthetical above. The 2 dp figures are
*system*-icon guidance, live in M3: "Icon content is limited to the 20dp x 20dp live area, with 2dp of
padding around the perimeter", "The recommended stroke weight for icons is 2dp or the regular weight
(400)", "Corner radii are 2dp by default"
([M3 Designing icons](https://m3.material.io/styles/icons/designing-icons)). Don't attribute them to app
icons.

### Android adaptive icons

From [Adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
(*primary*):

- "You must provide two layers for the color version of the icon: one for the foreground, and one for the
  background. The layers can be either vectors or bitmaps, though vectors are preferred."
- "Size all layers to 108x108 dp."
- "Use a logo that's at least 48x48 dp. It must not exceed 66x66 dp, because the inner 66x66 dp of the
  icon appears within the masked viewport."
- "The outer 18 dp on each of the four sides of the layers is reserved for masking and to create visual
  effects such as parallax or pulsing."
- "Use icons with clean edges. The layers must not have masks or background shadows around the outline of
  the icon."
- The mask is not yours: "Each device OEM must provide a mask, which the system uses to render all adaptive
  icons with the same shape" — circle, squircle or rounded square depending on the device.
- Themed icons: "starting with Android 13 (API level 33), users can theme their adaptive icons… the system
  uses the coloring of the user's chosen wallpaper and theme to determine the tint color of the app icons
  for apps that have a monochrome layer… **Starting with Android 16 QPR 2, Android automatically themes
  app icons for apps that don't provide their own.**"
- A `<monochrome>` layer is a hard requirement for Google's Android Excellence Program, guideline
  **AEP-TI-GAA**: "There are no exemptions for this guideline."
  ([AEP themed icons](https://developer.android.com/distribute/aep/aep-req-theme-app-icons))

**Numeric correction.** The commonly cited "72 × 72 dp safe zone" is not in the current doc; the current
spec states the never-clipped region as **66 × 66 dp**. The 72 dp figure is real but describes the
*masked section*, and appears only on the archived
[M2 Android icons page](https://m2.material.io/design/platform-guidance/android-icons.html): "Without
affecting icon layout, OEMs can apply their own custom masks to icons using a 72 x 72 dp masked area."
That page is also the clearest statement of the layer-opacity split: foreground "Transparency optional",
background "Must be Opaque".

### The Play Store's separate 512 × 512 asset

[Icon design specifications](https://developer.android.com/google-play/resources/icon-design-specifications)
(*primary*): "Final size: 512px x 512px / Format: 32-bit PNG / Color space: sRGB / Max file size: 1024KB /
Shape: Full square – Google Play dynamically handles masking. Radius will be equivalent to 30% of icon
size. / Shadow: None – Google Play dynamically handles shadows." And: "because Google Play dynamically
renders rounded corners and drop shadows for your app icons, you should omit them from your original
assets."

Two contradictions inside Google's own docs, reported rather than resolved:

1. **Corner radius.** The current spec says 30%. The
   [2019 announcement](https://android-developers.googleblog.com/2019/03/introducing-new-google-play-app-and.html)
   said "The corner radius will be 20% of the icon size". Treat 30% as current.
2. **Transparency.** That same 2019 post said "transparent backgrounds will no longer be allowed", but the
   live [Play Console help](https://support.google.com/googleplay/android-developer/answer/9866151) lists
   the format as "32-bit PNG (with alpha)" and the current spec page only advises against it:
   "Transparent assets will display the background color of Google Play UI." **Do not state "transparency
   is banned on Play" as current.**

### Google on what makes a good icon

There is **no blanket Google "no text in icons" rule** — the general advice is only "Minimize your use of
text" ([Store listing best practices](https://support.google.com/googleplay/android-developer/answer/13393723)).
The hard prohibitions are policy, and they are about *misleading* content:

- "Don't use text or graphic elements to indicate ranking" / "to promote deals or incentivize installs" /
  "to indicate participation in a Play program" / "that can mislead users" — prefaced by "These are
  examples of icon elements that mislead users and violate Play's Developer policies".
- "Don't use emojis, emoticons, or repeated special characters in these metadata elements. Avoid ALL CAPS
  unless it is part of your brand name."
  ([Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842))
- "Don't use icons that could mislead users or cause them to mistakenly download the wrong app, such as
  icons that are similar to those of existing products or services… Avoid any icons that falsely imply a
  relationship with another company, developer, entity, or organization."
- Composition: "Icon artwork can populate the entire asset space, or you can design and position artwork
  elements such as logos onto the keyline grid. When placing your artwork, use keylines as a guideline, not
  a hard rule." / "Don't force your logo or artwork to fit the full asset space."

### The real divergence, 2026 edition

The familiar contrast — "Apple wants a flat opaque square, Google wants layered maskable artwork" — **is
out of date.** Since WWDC25 both platforms say: ship unmasked square layers and let the OS mask. What
still differs:

| | Google | Apple |
|---|---|---|
| Canvas | 108 × 108 dp; 66 × 66 dp never-clipped; outer 18 dp reserved | 1024 × 1024 px; no reserved margin, just "keep primary content centered" |
| Mask | **Unknown at design time** — "Each device OEM must provide a mask" (circle / squircle / rounded square) | **Known and fixed per platform**, matched to "the bezel of the physical device itself" |
| Theming | OS tints a `<monochrome>` layer to the wallpaper palette; auto-generated from colour art in Android 16 QPR 2 | You annotate default / dark / mono; the system derives six appearances |
| Text | **Policy-enforceable** bans on ranking, price, promo, Play-program and misleading text; otherwise "minimize" | **Stylistic and accessibility** discouragement: "doesn't support accessibility or localization" |
| Fill the canvas? | "Icon artwork can populate the entire asset space" for illustrated artwork | "you don't need to fill the entire icon canvas with content" |
| Baked shadow | Forbidden in the launcher layers and in the Play asset; but "You can create shadows and lighting within the artwork" | Forbidden, with a technical reason: it fights the system's dynamic highlights |

The asymmetry that actually changes how you draw: **Android's mask is a variable you cannot see, so you
pay 18 dp of margin for it; Apple's mask is a constant, so you spend that area on the design.** The same
artwork needs two compositions, not one export at two sizes. The second asymmetry worth internalising:
Google's icon rules can get a submission rejected, whereas Apple's *text* rule is advice and Apple's
*review* rules about confusion and 4+ appropriateness are the enforceable ones.

---

## 6. Compressing it for two people with no designer

The phase names below are from §1; the keep/cut judgement is ours, with the supporting evidence cited.

**Keep, because it is cheap and it is where the leverage is**

1. **The written brief.** It costs an afternoon and it is the only artefact that lets you reject a design
   for a reason instead of a feeling. Every source in §1 puts it first, and it is the phase a small team
   is *most* able to do well, because the team is the client. Airey: "A good design brief is much more
   than paperwork. It's a contract of clarity."
2. **The competitive audit, narrowed to one screenshot.** Don't audit a category; audit the screen your
   icon will sit on. Screenshot your App Store category's top charts and drop candidates into that grid.
   It is the only test for "distinctive", and Flarup's instruction to "go in a different direction" is
   unanswerable without it.
3. **Sketching, on paper, in quantity.** The cheapest phase in the process and the one amateurs skip in
   favour of opening a vector tool. Airey: "Ideas can flow much faster between a pen and paper than they
   can a mouse and monitor."
4. **Reduction.** The platform rules do this work for you if you let them: a minimal number of shapes, no
   thin lines, no baked effects, at most four layer groups. Treat Apple's constraints as the art
   direction rather than as obstacles.
5. **Testing at size, in context, in mono.** Free, and built into Icon Composer. No excuse for skipping.
6. **A short usage note.** Not a 60-page manual — a paragraph in `DESIGN.md` saying what the icon is, what
   colour it is, what it must never sit next to, and where the source file lives.

**Cut, or radically shrink**

1. **Multiple presented directions with rationale decks.** Presentation exists to move a client. You are
   the client, and Johnson's whole argument for three routes ("You only need one naysayer on the board")
   is about board politics you do not have. Replace it with a decision record: what you picked, what you
   rejected, why. Keep Airey's *narrowing* discipline though — describe three or four directions in words
   before rendering any of them.
2. **Stakeholder research, interviews, workshops.** Two people in agreement do not need a workshop.
3. **The full brand system.** You need an app icon, a flattened PNG for marketing, and the Android layers.
   Wheeler's Phase 4 — stationery, vehicles, uniforms, packaging, signage — is speculative work before you
   have users.
4. **Trademark clearance — shrink, don't cut.** A full search is a lawyer's job, but the store rules bite
   for free: App Review 4.1(c) and Google's "falsely imply a relationship" line. A ten-minute search of
   the App Store and Play for your intended shape and name is the cheap version.
5. **Pixel-perfect optical refinement.** Real, and real designers spend days on it (Pentagram's "hundreds
   of tests" on three colours), but it has the lowest return for an unknown app. The small-size and mono
   tests catch the failures that actually matter.

### The cheap validation battery, in the order to run it

| Test | How | What it catches | Attribution |
|---|---|---|---|
| Squint / thumbnail | Shrink to ~40 px, or step back and squint until it blurs | An idea that depends on detail | Matt Charboneau, [GRAPHICS PRO, 2021-05-12](https://graphics-pro.com/education/checking-the-readability-of-a-sign-with-the-squint-test/): "squint hard enough that the image is blurry, and you only see the dominant elements of the design. These dominant elements should still be readable as if you were taking an eye test." (*practitioner, trade press*) |
| One colour | Flatten to a black silhouette; or use Icon Composer's Mono appearance | A shape that only reads through colour contrast | Paul Rand, 1991: "the only thing mandatory… is that a logo be attractive, reproducible in one color and in exceedingly small sizes." (*primary*) |
| Black first, colour last | Design the mark in black; add colour at the end | Colour propping up a weak idea | Airey: "No amount of gradient or colour will rescue a poorly designed mark." (*primary*) |
| Small size | One inch in print; 40 px on screen | Thin strokes, fine detail, sharp corners | Airey: "your design should work at a minimum of around one inch without loss of detail." Apple: "avoid extremely thin line weights and sharp corners." |
| Reverse / upside down | Invert the values; rotate 180° | Hidden imbalance and accidental shapes | Airey, *Logo Design Love* 2e, tips 19–20 (*primary*, heading-level) |
| In context | Your own home screen, next to real apps, on several wallpapers | Collisions, wrong value, a vanishing background | Expo's own aside: "testing your icon on different wallpapers" |
| Category grid | Drop it into a screenshot of your App Store category's top charts | "Distinctive" — the only test for it | Flarup (*practitioner*) |
| Effects off | Icon Composer toggle | Whether the idea or the material is doing the work | Apple (*primary*) |
| Stranger test | Show it to people who have never heard of the app | A metaphor that only makes sense to you | Mozilla, at scale: "Consumers not intimately familiar with Mozilla view the brand identity system with fresh eyes, helping illuminate any blind spots" (*primary*) |
| A/B, later | App Store Product Page Optimization | Which of two defensible icons actually converts | Apple (*primary*, below) |

Mozilla's stranger test is worth reading as the extreme case. Scale, from
[nearly-there](https://blog.mozilla.org/opendesign/nearly-there/) (2016-10-19, *primary*): "We asked
survey respondents to rate these design directions against seven brand attributes… For over 700
developers and 450 Mozillians, Protocol scored highest across 6 of 7 measures… We surveyed people making
up our target audience, 400 each in the U.S., U.K., Germany, France, India, Brazil, and Mexico." The
internal sessions had an explicit anti-consensus rule: they were "not driving toward consensus, but
instead invited critical examination and discussion of the work based on a very explicit set of
criteria."

And the result is the best argument for running it at all — **the insiders and the strangers disagreed**:
"Based on quantitative surveys, Mozillians and developers believe this direction does the best job… In
similar surveys, our target consumers evaluated our 'Burst' design direction as the better option."

### What the tooling gives you for free

Icon Composer is a test rig as much as an authoring tool, and its previewing features map one-to-one onto
the manual tests: a "Select preview size" pop-up ("look up close and down small", WWDC25 361), arbitrary
background colour or image including your own screenshot, the Mono appearance as a system-enforced
monochrome reduction, "To view the app icon with no Liquid Glass effects, toggle Effects off", and a
version comparison ("to compare macOS 26 with macOS 27 rendering, click 26 and then 27") which matters
because the HIG warns these effects "can appear differently between system versions". Apple's own
instruction is to "test carefully with Icon Composer, on a simulated device in Device Hub, or on a
physical device".

### A/B testing the icon on the App Store

- "You can edit the app icon, screenshots, and previews of each treatment" — up to **three treatments**
  against the baseline, with the caveat "the more treatments you add to a test, the longer the test may
  take to reach a conclusive result".
- Traffic split: "if a test has three treatments and you choose a 30% traffic proportion, each treatment
  will be shown to 10% of the total traffic."
- "A test runs for **90 days** or until you manually stop it within that time."
- Results report unique impressions, conversion rate, "improvement (the percentage lift compared to your
  baseline)" and "confidence (the statistical confidence level in the results, with 90%+ indicating
  reliable data)". "Tests require at least 90% confidence to mark a variant as Performing Better or
  Performing Worse."
- Preconditions: the app must be live on the App Store, and **every icon you want to test must already be
  in the shipped binary** as an alternate icon.

The sequencing consequence: if there is any chance you will A/B the icon, ship the runner-up as an
alternate icon in the first public build. Retrofitting costs a release.

---

## 7. Doing this in an Expo project

Verified against [Expo's splash screen and app icon docs](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
(raw Markdown at the same path with `.md`). This repo is on `expo ~57.0.14`.

- `icon` / `ios.icon` accepts a plain PNG path, and Expo's rules match Apple's: "1024x1024 is a good
  size… The largest size EAS Build generates is 1024x1024"; "The icon must be exactly square. For
  example, a 1023x1024 icon is not valid"; "Make sure the icon fills the whole square, with no rounded
  corners or other transparent pixels. The operating system will mask your icon when appropriate."
- `ios.icon` also accepts the three-variant object: `{ "dark": …, "light": …, "tinted": … }`.
- `ios.icon` accepts an **Icon Composer `.icon` directory**: "Providing an Icon Composer **.icon**
  directory via `ios.icon` is supported **in SDK 54** and later", e.g. `"icon": "./assets/app.icon"`, and
  "Adding support for dark mode is handled in Icon Composer, so you do not need to provide variants when
  using this approach."
- **Expo's docs do not mention the iOS 26+ "clear" appearance.** The `.icon` route gets it for free (the
  system derives clear and tinted from the mono annotation); the three-PNG route has no key for it, and
  the system generates what you omit.
- Android keys supported: `android.adaptiveIcon.foregroundImage`, `.backgroundImage`, `.backgroundColor`,
  `.monochromeImage`, plus `android.icon` for pre-adaptive devices — a complete match for the model in §5.
  Expo's own aside: "Provide an icon that's at least 512x512 pixels."
- **Alternate icons** (needed for App Store A/B tests) are not in Expo's config. A third-party config
  plugin such as [`expo-alternate-app-icons`](https://github.com/pchalupa/expo-alternate-app-icons)
  generates the `.appiconset` directories and sets
  `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`. *Third-party, not Expo-official.*
- Icon Composer is **macOS-only**.

---

## 8. Fit for Sprinkie specifically (#58)

[#58](https://github.com/SimonOneNineEight/daily-wlog/issues/58) is open, labelled `ready-for-human`, and
says the PM is drawing it. What this research changes about that ticket:

- **The brief is already written, and it is unusually good.** `GLOSSARY.md` and `DESIGN.md § Identity`
  supply the whole output of Phases 1–2 for free: the aesthetic family ("Apple Calendar's airiness × Apple
  Journal's warmth"), the rule that "colour belongs to the user's categories and nowhere else", the
  Wordmark decision (ratified 2026-09-29: "Sprinkie", the same Latin string in both App Languages), and
  the product metaphor ("a month filling with colored dots should feel like a life filling up"). A studio
  would charge for that document. Start at concepts.
- **Category colour is a trap.** The ten category colours belong to the user, not the brand. An icon built
  from that palette would make the brand look like one arbitrary category. The identity needs its own
  colour that does not collide with the ten — and Apple's "Color backgrounds generally offer the greatest
  contrast in dark icons" plus WWDC25's "lean more into colored backgrounds" both argue for one committed
  brand colour on the background layer rather than a white or near-white field.
- **No text, and the Wordmark rule makes the reasoning sharper.** Apple's stated objection is localization,
  and this app ships zh-TW and English from the same screens. Because the Wordmark is one Latin string in
  both languages, a letterform mnemonic ("S") is *technically* permitted by the HIG and would not break
  localization. It is still the weakest kind of icon idea by every criterion in §3 — Airey's "a logo
  doesn't need to say what a company does" cuts both ways — and `design/assets/icons.md` already bans
  emoji everywhere, so the drawn-glyph instinct is right.
- **Do not reach for Lucide or SF Symbols.** The in-app glyph family is Lucide (MIT) standing in for SF
  Symbols. Neither belongs in the app icon: SF Symbols are prohibited in app icons outright (§4), and an
  icon drawn from the same stroke-1.75 line family as the UI would read as a control rather than a brand —
  exactly what the HIG warns about ("don't just replicate standard UI components"). The app icon is the one
  asset in this repo that should *not* match the icon manifest. Worth noting the nuance against
  `design/assets/icons.md`'s current phrasing: SF Symbols are usable in the interface via the system; the
  problems are redistribution into a web artboard, and app-icon/logo use.
- **Two deliverables, not one.** The ticket's "an icon asset from the PM is in the repo at the sizes iOS
  requires" is satisfiable with a single 1024 × 1024 opaque PNG — still a legal, complete iOS app icon.
  `apps/mobile/assets/icon.png` is already 1024 × 1024 PNG colour-type 2 (RGB, no alpha), so the pipeline
  is compliant today. But the second criterion (Android layers) needs a different *composition*, not a
  resize: 108 dp with 18 dp of reserved margin plus a `<monochrome>` layer. `app.json` already declares
  all four Android keys against Expo-template placeholders.
- **Decide the flat-vs-layered question explicitly.** On SDK 57, `ios.icon` accepts a `.icon` directory.
  Flat costs nothing and the system generates dark/clear/tinted automatically; `.icon` costs a macOS-only
  tool and a layered redraw, and buys control over six appearances plus Liquid Glass. For a first external
  TestFlight, flat is defensible; layered is a follow-up. The decision deserves a line in the ticket
  rather than being discovered at build time.
- **The ticket is right that the icon "cannot change without cutting a new build"** — now verified, and
  sharper than stated: it lives in the binary, and even Apple's own A/B test requires the candidates to be
  compiled in. If there is any chance of testing two icons later, ship both as alternate icons in the
  first public build.

---

## 9. Flagged — could not verify

Reported rather than smoothed over.

**Corrections to claims in common circulation**

- Paul Rand's criteria are **seven nouns**, not questions. The "Is it distinctive? Is it visible?…" list is
  a 2015 construction by Dave Schools, widely misattributed. Its stated basis — a six-noun quote including
  "adaptability", attributed to *Design, Form, and Chaos* (Yale, 1993) — **could not be verified** against
  any readable source. `paulrand.design`'s page for that book is a blurb page and does not contain it.
- **Michael Bierut is not a single-recommended-direction designer.** That was Massimo Vignelli, his former
  employer, and Bierut says so explicitly.
- Alina Wheeler died in **2023**, not 2021, and worked on the 6th edition herself with Rob Meyerson. The
  years 1948–2023 are corroborated by two *secondary* sources ([PRINT's
  obituary](https://www.printmag.com/design-news/remembering-alina-wheeler-1948-2023/) and
  [Wikipedia](https://en.wikipedia.org/wiki/Alina_Wheeler)); the specific date (5 December 2023), her age
  at death, and the account of her seeing final proofs or having "a hand in every page" come from
  obituary and LinkedIn sources that were not opened directly — **unverified**. The safe formulation is
  "Wheeler (1948–2023) co-authored the sixth edition with Rob Meyerson; it was published in 2024, shortly
  after her death."
- Pentagram writes **"Roon Kang"** (usually credited "E Roon Kang" elsewhere), and the "**over 40,000
  permutations**" figure belongs to Richard The and Kang's **2011 25th-anniversary system**, not to the
  2014 Bierut/Fay identity that replaced it — a commonly conflated pair
  ([pentagram.com/news/mit-media-lab](https://www.pentagram.com/news/mit-media-lab), 2014-10-24). The 2014
  work took that system's seven-by-seven grid and derived an ML monogram plus marks for "each of the 23
  research groups".
- The AIGA citation for Rand's 1991 essay is **partly unverified**: the estate site confirms AIGA as the
  original publisher, but the commonly cited *"AIGA J. Graph. Des. 9(3) (1991)"* volume and issue come
  from a search snippet of a paywalled Springer reference list. Do not print the volume/issue.
- Android's current safe zone is **66 × 66 dp**, not 72 × 72 dp. The 72 dp figure describes the OEM masked
  section and lives only on the archived M2 page.
- Google Play's icon corner radius is **30%** in the current spec; 20% is superseded. And **transparency is
  not currently banned** on Play — the 2019 ban wording no longer matches the live pages.
- Chermayeff & Geismar & Haviv is at **cghnyc.com**; `cgh.design` does not resolve. The firm publishes no
  process account, and the commonly repeated "dozens of concepts for the 1960 Chase mark" claim appears
  only on third-party design editorial and was not verified.

**Not found / not readable**

- **Apple's icon template grid numbers.** The HIG page states no numeric grid or corner-radius value, and
  the Figma community template returns 403 to non-interactive fetches.
- **Apple's per-context icon point sizes.** No longer published in the current HIG; only QA1686's archived
  pixel table.
- **The SF Symbols licence verbatim.** Not on any developer.apple.com page I could fetch, and not in the
  Xcode and Apple SDKs Agreement PDF. The restriction itself is primary via the HIG.
- **Play's 512 px keyline grid dimensions** — image-only; the only figures in the page text are 512 px and
  the 384 px legacy scale.
- **A Google rule phrased "don't replicate the Play Store badge."** The
  [badge guidelines](https://play.google.com/intl/en_us/badges/) govern use of *Google's* marks. The nearest
  real prohibitions are the Play-program and false-relationship lines in §5.
- **Any Android 15-specific adaptive-icon change.** Android 13 (themed icons) and Android 16 QPR 2
  (auto-theming) are confirmed; Android 15 is not.
- **web.archive.org as a source for Material** — the snapshots are SPA shells. There is no usable archived
  URL for the M2 pages; the live, Google-labelled-unmaintained URL is the only readable source.
- **"Works on a billboard and on a pen."** No primary origin for the idiom; every hit for that exact
  phrasing sat on an excluded site. The two verified, attributable versions of the idea are Charboneau
  (sign ↔ pen/embroidery) and Michael Johnson (billboard ↔ 20 mm).
- **"Show it to non-designers" as a stated heuristic.** Mozilla is a verified primary account of *doing* it
  at scale with explicit reasoning, but no named designer was found stating it as a rule in a primary
  source.
- **NASA Brand Center's minimum size.** The figure lives inside page images; search snippets claim 5/8 inch
  — unverified.
- **Moving Brands and COLLINS** publish no timelines, concept counts or deliverable sequences. **Landor's**
  current site has no process page. **Brand New / UnderConsideration** is paywalled past the masthead and
  is editorial commentary, not a studio self-description.
- Bierut's "empty vessel that you pour meaning into" and any "I don't do sketches" claim — **unverified**;
  seen only in search summaries and a reader comment.

**Internal inconsistencies left as found**

- Johnson Banks' [Mozilla case study](https://www.johnsonbanks.co.uk/work/mozilla) says "gathered around
  five broad strategic directions" then names four.
- Mozilla's published plan said seven concepts → three; reality was seven → four.
- Johnson Banks dates the Mozilla project at "the last 10 months"; Mozilla dates the same project at
  "Seven months since setting out". Both are primary, published the same week.
- Michael Johnson's blog and his publisher's contents list disagree on three of the six step names
  (Investigation/Implementation/Engagement vs. Investigate/Implement/Engage or Revive).
- Wheeler's TOC prints "Creating touchpoints"; she says "creating touch points" aloud.

**Method reliability.** Where quotes mattered, raw HTML or PDF was parsed directly rather than trusting a
page-summarising fetch. That caught three real transcription errors: Rand's "useability" rendered as
"usefulness", Bierut's "I've considered" rendered as "We've considered", and a summariser asserting that
Rand's list was question-form. Treat any quote here sourced only through a summariser as medium
confidence; those are marked where they occur.

---

## Sources

**Apple — primary, current**

- HIG, App icons: https://developer.apple.com/design/human-interface-guidelines/app-icons (change log June 8, 2026)
- HIG, Icons: https://developer.apple.com/design/human-interface-guidelines/icons
- HIG, SF Symbols: https://developer.apple.com/design/human-interface-guidelines/sf-symbols
- HIG, Branding: https://developer.apple.com/design/human-interface-guidelines/branding (change log September 9, 2026)
- Creating your app icon using Icon Composer: https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer
- Configuring your app icon using an asset catalog: https://developer.apple.com/documentation/xcode/configuring-your-app-icon
- Apple Design Resources: https://developer.apple.com/design/resources/ · Icon Composer: https://developer.apple.com/icon-composer/ · SF Symbols: https://developer.apple.com/sf-symbols/
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- WWDC25 220, "Say hello to the new look of app icons": https://developer.apple.com/videos/play/wwdc2025/220/
- WWDC25 361, "Create icons with Icon Composer": https://developer.apple.com/videos/play/wwdc2025/361/
- Product Page Optimization — create a test: https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/create-a-test/ · configure treatments: https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/configure-test-treatments/ · analytics: https://developer.apple.com/help/app-store-connect-analytics/acquisition/product-page-optimization/

**Apple — archived / lower-trust**

- Technical Q&A QA1686 (2016-12-20): https://developer.apple.com/library/archive/qa/qa1686/_index.html
- Xcode and Apple SDKs Agreement (searched for the SF Symbols clause; not present): https://www.apple.com/legal/sla/docs/xcode.pdf
- SF Symbols licence text reproduced by a community member, not Apple staff: https://developer.apple.com/forums/thread/724523
- Exact `ITMS-90717` validator string: https://github.com/expo/expo/issues/1086

**Google — primary, current**

- Adaptive icons: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
- Create app icons (Image Asset Studio): https://developer.android.com/studio/write/create-app-icons
- Play icon design specifications: https://developer.android.com/google-play/resources/icon-design-specifications
- Android Excellence Program, themed icons (AEP-TI-GAA): https://developer.android.com/distribute/aep/aep-req-theme-app-icons
- Play Console Help, add preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Play metadata policy: https://support.google.com/googleplay/android-developer/answer/9898842
- Play store listing best practices: https://support.google.com/googleplay/android-developer/answer/13393723
- Material Design 3, Designing icons (system icons): https://m3.material.io/styles/icons/designing-icons · sitemap used to prove the product-icon pages are gone: https://m3.material.io/sitemap.xml
- Google Play badge guidelines: https://play.google.com/intl/en_us/badges/

**Google — unmaintained / superseded**

- Material 2, Product icons: https://m2.material.io/design/iconography/product-icons.html
- Material 2, Introduction ("Material is the metaphor"): https://m2.material.io/design/introduction
- Material 2, Android icons (72 dp masked section, 4 dp keyline radius): https://m2.material.io/design/platform-guidance/android-icons.html
- Android Developers Blog, 2019 Play icon change (20% radius, transparency ban — both superseded): https://android-developers.googleblog.com/2019/03/introducing-new-google-play-app-and.html

**Books, verified from publisher material**

- Alina Wheeler and Rob Meyerson, *Designing Brand Identity*, 6th ed., Wiley, March 2024, ISBN 978-1-119-98481-8 — https://www.wiley.com/en-us/Designing+Brand+Identity%3A+A+Comprehensive+Guide+to+the+World+of+Brands+and+Branding%2C+6th+Edition-p-9781119984818 · TOC PDF (phase names): https://catalogimages.wiley.com/images/db/pdf/9781119984818.toc.pdf · excerpt PDF: https://catalogimages.wiley.com/images/db/pdf/9781119984818.excerpt.pdf
- Michael Johnson, *Branding: In Five and a Half Steps*, Thames & Hudson, 2016, ISBN 9780500518960 — https://thamesandhudson.com/branding-in-five-and-a-half-steps-9780500518960
- David Airey, *Logo Design Love*, 3rd ed., New Riders/Peachpit, © 2026, ISBN 978-0-13-547675-8 — free sample containing all of ch. 4: https://www.davidairey.com/samples/logo_design_love_free.pdf · 2nd-ed. sample with the 31-tips TOC: https://ptgmedia.pearsoncmg.com/images/9780321985200/samplepages/9780321985200.pdf
- Michael Flarup, *The App Icon Books* (self-published; contents verified from the author's site only): https://appiconbook.com/

**Designers and studios — primary**

- Paul Rand, "Logos, Flags, and Escutcheons" (AIGA, 1991), on his estate's site: https://www.paulrand.design/writing/articles/1991-logos-flags-and-escutcheons.html · quotes page: https://www.paulrand.design/writing/quotes.html
- Michael Bierut, "This is My Process", Design Observer, 2006-09-09: https://designobserver.com/this-is-my-process/ (live URL 403s; verified via http://web.archive.org/web/20260216031213/https://designobserver.com/this-is-my-process/)
- Pentagram: Michael Bierut profile https://www.pentagram.com/about/michael-bierut · Mastercard https://www.pentagram.com/work/mastercard/story · Verizon https://www.pentagram.com/work/verizon/story · Saks Fifth Avenue https://www.pentagram.com/work/saks-fifth-avenue/story · MIT Media Lab https://www.pentagram.com/news/mit-media-lab
- David Airey: process https://www.davidairey.com/process · logo design tips https://www.logodesignlove.com/logo-design-tips · how many options https://www.logodesignlove.com/how-many-options · "The ideal design process?" (quoting Michael Johnson) https://archive.davidairey.com/branding/the-ideal-design-process/
- Johnson Banks: how we work https://www.johnsonbanks.co.uk/about/how-we-work · five and a half steps https://www.johnsonbanks.co.uk/thoughts/branding-in-five-and-a-half-steps · insider's guide to the design presentation https://www.johnsonbanks.co.uk/thoughts/an-insiders-guide-to-the-design-presentation · designing in the open https://www.johnsonbanks.co.uk/thoughts/designing-in-the-open · absolutionism versus more ideas https://www.johnsonbanks.co.uk/thoughts/absolutionism-versus-more-ideas · transparency starts at home https://www.johnsonbanks.co.uk/thoughts/transparency-starts-at-home · Mozilla posts https://www.johnsonbanks.co.uk/news/mozillas-creative-strategy · /and-then-there-were-five · /our-first-design-routes-for-mozilla · /mozilla-thedesign-development · /mozilla-the-chosen-route · case study https://www.johnsonbanks.co.uk/work/mozilla
- Mozilla Open Design (client side): https://blog.mozilla.org/opendesign/about/ · https://blog.mozilla.org/opendesign/now-for-the-fun-part/ · https://blog.mozilla.org/opendesign/nearly-there/ · https://blog.mozilla.org/opendesign/heading-into-the-home-stretch/ · https://blog.mozilla.org/opendesign/arrival/
- Moving Brands, "Six steps to an unshakeable strategy", 2024-08-19: https://movingbrands.com/news/six-steps-to-an-unshakeable-strategy/
- COLLINS programs: https://wearecollins.com/programs/brand-creation/ · https://wearecollins.com/programs/brand-refresh/
- Chermayeff & Geismar & Haviv (no process account): https://cghnyc.com/about

**Brand guidelines cited as delivered artefacts — primary**

- MIT: https://brand.mit.edu/logos-marks/mit-logo · https://brand.mit.edu/downloads · https://brand.mit.edu/applying-brand/do-dont
- UK ONS: https://service-manual.ons.gov.uk/brand-guidelines/logo
- GOV.UK: https://brand.design-system.service.gov.uk/logo-system/logo-elements · GDS on redrawing the crown for small sizes: https://insidegovuk.blog.gov.uk/2024/02/19/updating-gov-uks-crown/
- City of Helsinki: https://www.hel.fi/en/decision-making/information-on-helsinki/design-and-digitalisation/helsinki-brand-and-visual-identity/visual-identity-guidelines/use-basic-elements
- NASA Brand Center: https://www.nasa.gov/nasa-brand-center/brand-guidelines/ · NASA Graphics Standards Manual NHB 1430.2, January 1976: https://www.nasa.gov/wp-content/uploads/2015/01/nasa_graphics_manual_nhb_1430-2_jan_1976.pdf
- Mozilla identity guidelines, 2007 snapshot: https://www-archive.mozilla.org/foundation/identity-guidelines/firefox

**Expo (this repo's framework)**

- Splash screen and app icon: https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- app.json / app.config.js reference: https://docs.expo.dev/versions/latest/config/app/
- expo-alternate-app-icons (*third-party*): https://github.com/pchalupa/expo-alternate-app-icons

**Practitioner / secondary, labelled as such above**

- Michael Flarup, "Eye-Catching App Icon Design: How To", Smashing Magazine, 2017-01-17: https://www.smashingmagazine.com/2017/01/designing-better-app-icons/
- Alina Wheeler on the Logo Geek podcast, ep. 10 (her words, third-party venue): https://logogeek.uk/podcast/design-a-brand-identity-with-alina-wheeler/
- Michael Bierut on Behance (his words, third-party venue): https://www.behance.net/blog/michael-bierut-on-finding-your-voice · designboom interview, 2014-02-19: https://www.designboom.com/design/michael-bierut-interview/ · 99% Invisible ep. 251 on the Clinton "H": https://99percentinvisible.org/episode/negative-space-logo-design-michael-bierut/
- Michael Johnson in Creative Bloq, 2010-05-07 (three drawn size versions): https://www.creativebloq.com/computer-arts/johnson-banks-5108856
- Matt Charboneau on the squint test, GRAPHICS PRO, 2021-05-12: https://graphics-pro.com/education/checking-the-readability-of-a-sign-with-the-squint-test/
- Nielsen Norman Group on squinting/blurring (about UI hierarchy, not logos): https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- Landor via *Computer Arts*, Feb 2012, hosted on Landor's asset server (journalist's step names): https://s3-us-west-2.amazonaws.com/lndr-landorcom-assets-prd/app/uploads/2015/09/01171552/CA_Landor_Branding_Masterclass_Feb2012.pdf
- PRINT, "Remembering Alina Wheeler (1948–2023)": https://www.printmag.com/design-news/remembering-alina-wheeler-1948-2023/
