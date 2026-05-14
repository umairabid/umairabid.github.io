---
layout: default
title: About
description: A bit more about me, the kinds of problems I like working on, and the side projects I hack on after hours.
permalink: /about/
---

# About me

I've worked as a software engineer for about ten years. Most of that
time has been spent inside Ruby on Rails codebases — the kind that
started small, grew under product pressure, and now hold a real
business together. I tend to gravitate toward the parts that are
slowing teams down: slow queries, fragile workers, sync pipelines, the
dashboard that takes fifteen seconds to load. The work I'm most proud
of is the kind that quietly makes the next engineer's day a little
easier.

Early in my career I was mostly driven by curiosity about how real
systems work, and I tried to absorb as much as I could. Over time my
focus has shifted toward creating actual impact — picking the work
that moves the business and growing in that direction on purpose.

I try to be unbiased about tools. Most problems are easier to solve
once you've broken them down to the parts that actually matter, and
the answer is usually whichever tool the team can maintain. That's
let me move between stacks without too much drama and step into
projects that needed someone to come in and unblock them.

## Experience, in stories

I find a list of job titles tells you almost nothing about what
someone is actually good at. The work I remember is the work that
taught me something — usually because it broke first.

### Untangling a date-time bug across a timezone boundary

A hotel reservations system was generating proposals with the wrong
rate dates for a brand-new customer. The fix turned out to be one of
those quiet ones: timestamps were going out from the frontend in UTC,
and the backend was implicitly parsing them as PST. Making the
conversion explicit fixed it. Lesson banked: never let the runtime
guess a timezone on your behalf.

### Tracking down a rounding bug that was blocking a high-profile client

Invoice sync was producing totals that didn't match what the
downstream accounting system expected, and it was the one thing
keeping a VIP customer from going live. The trick was reverse-
calculating prices from the downstream totals to find where they
diverged. We were storing prices as floats with effectively unlimited
decimal places and rounding once at the end; the accounting system
rounded at every line. Now I do all monetary math in the minimum
currency unit. Cents only.

### Migrating duplicated data across a portfolio of clients

A multi-account product was duplicating tens of thousands of records
across portfolios — same data, written once per child account.
Customers were panicking; we were panicking. The argument I had to
make was that the unique key was wrong: data was unique *per
portfolio*, not per account-within-portfolio. The fix was a dedicated
portfolio-level client to own and sync the shared data, plus a
one-time migration to clean things up. Expensive in the short term;
cheap forever after. Worth the trade.

### Rebuilding a coverage-calculation engine that was costing trust

The product was marketed as "we reduce your costs" — and version one
of the coverage calculator was, in places, doing the opposite.
Support tickets spiked, engineering was constantly pulled in, and the
business was losing trust. Coverage came from three inputs: DOB,
plan, and salary. By walking through real customer journeys against
the actual system behavior, we found coverage wasn't recalculating
when salary changed. We refactored the platform so coverage stayed
dynamic by design. Result: about an 80% drop in support tickets, and
the promise the product had been making was true again. Comparing
the journey on paper to the journey in the database is something I
still reach for.

### Adding an audit trail to a live product without disrupting it

Customers couldn't tell whether a change had been made by a human or
by automation, and the blame games were getting expensive. Building
change logs into a production system meant two things at once: don't
add latency to operations that were already near SLA, and don't let a
bug in the audit path take down the path being audited. We pushed
persistence into background workers, gave the change-log system its
own observability, and chose DynamoDB so it could scale independently
of the primary database. We rolled it out gradually, one action at a
time, with zero user-facing impact. Wrote up the full design
[here](/blog/2026/01/15/change-logs-system/).

### Keeping downstream services happy through a breaking upstream change

An upstream service had to start publishing every event in order to
fix a bug in a downstream service — but downstream consumers were
built assuming real-time events only. Solution: an intermediary app
with two queues, one for the full firehose and one that preserved
the real-time-only stream for existing consumers. Got the fix
shipped, didn't break anyone else's infrastructure. An extra queue
is often the cheapest path to backward compatibility.

### Reshaping a 1:1 sync framework into a 1:N invoice pipeline
{: id="invoice-sync"}

An existing sync framework was designed for 1:1 entity sync, and a
new charges/prepayments/invoice workflow needed 1:N. Rather than
write parallel sync logic outside the framework, we stretched the
framework to support the new shape, modeled prepayment as its own
type (rather than a boolean flag on the existing one), and replaced
locking flags with a real state machine. Idempotent jobs with retries
turned out to be the right answer for the async failures we'd been
seeing. Long write-up
[here](/blog/2025/05/08/invoice-sync-pipeline/).

### Convincing the team to ship features as mini-MVPs

Post-release iteration cycles were taking forever, and we were
sinking expensive engineering time into features that didn't always
land. I pushed for a smaller loop: ship a mini-MVP behind a review
app, get power users on it directly, and only invest in the rest
once we'd learned what was actually useful. We wasted a lot less
effort after that, and the features we did ship were closer to what
people wanted.

## Side projects

I like building small tools, mostly in Go, mostly for the terminal.
Arch + Vim + Tmux is my daily driver, and a lot of these come out of
wanting to scratch my own itch.

- **[lazysql](https://github.com/umairabid/lazysql)** — a TUI SQL
  client in Go. Built because I didn't want to leave the terminal
  to poke at a database.
- **[sweaty_wallet](https://github.com/umairabid/sweaty_wallet)** —
  a personal-finance app (Rails + Hotwire) with a Chrome extension
  that pulls bank transactions. I use it on my own money.
- **[malang](https://github.com/umairabid/malang)** — an experimental
  Arch Linux installer in Go + Bubble Tea. Started as "how hard
  could this be?" and turned into a real thing.
- **[logs_stack](https://github.com/umairabid/logs_stack)** — a
  Grafana + Loki + Alloy observability setup I run for my side
  projects.
- **[tmux](https://github.com/umairabid/tmux)** /
  **[.vim](https://github.com/umairabid/.vim)** — dotfiles. Always
  being tweaked.

## Stack

Ruby, Rails, Go, PostgreSQL, MySQL, GraphQL, AWS, Docker, React,
Arch Linux, Vim, tmux.

## Reach me

[LinkedIn](https://www.linkedin.com/in/umairabid) ·
[GitHub](https://github.com/umairabid)
