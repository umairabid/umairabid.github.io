---
title: Reshaping an Invoice-Sync Pipeline Without a Rewrite
description: A 1:1 sync framework had to absorb a 1:N invoice workflow with prepayments, locking, and idempotent retries — without forking the platform.
---

We had a working sync framework. The shape was simple: one local
entity, one remote entity, push changes across when they diverged. It
served us well for years. Then the product team showed up with a new
invoicing workflow that did not fit that shape at all.

The new flow was:

- Customers create quotes (and a separate thing we ended up calling
  "MR quotes").
- Customers can accept prepayments against those quotes.
- Quotes get synced downstream as the canonical record.
- As services are rendered, line items get posted against the quote.
- Those charges deduct from the prepaid balance.
- Once services are complete, a final invoice is generated and sent.

A single local quote could end up touching multiple remote
entities, in a specific order, sometimes weeks apart. That's a 1:N
sync problem, and our framework only knew how to do 1:1.

The lazy option was to write parallel sync logic *next to* the
framework. Build a second pipeline for invoices and let the original
keep doing its thing. That would have worked for about six months and
then we'd have two pipelines slowly diverging in subtle ways. So we
decided to stretch the framework instead.

# What got built first turned out to be the easy part

The visible work — adding the new entities, wiring up the prepayment
flow, making sure each line item posted to the right remote object —
was the part we estimated up front. It went roughly as planned.

The interesting work was everything we found *after* the first
version was on staging.

## Async jobs failing randomly, creating duplicates

The first thing the QA cycle turned up was that some sync jobs were
silently failing and then re-running, and the re-run was sometimes
creating a second copy of a charge downstream. Not always. Just often
enough to be terrifying.

We considered a few things:

- **Exponential backoff with sleeps.** Tempting, but our workers are
  not infinite. A backed-off sleep is a worker you can't use for
  anything else, and a queue that gets choked by retries during an
  outage is worse than the outage.
- **Splitting each sync job into smaller jobs.** Cleaner in theory,
  more correct under failure. The amount of refactoring to get there
  was not reasonable given what else was on the roadmap.
- **Making the jobs idempotent.** Pick a stable external key, check
  before you write, and treat a re-run as a no-op if the work has
  already landed. Cheap to implement, and "this can run twice
  without consequences" is a property worth having for its own sake.

We went with idempotent + retries. The duplicate-charge bug
disappeared. More importantly, the next two async bugs we found also
disappeared on their own, because we'd already made the operations
safe to repeat.

## Decimal places that didn't agree with the accounting system

Some invoices were off by a cent or two. Sometimes more. The cause
turned out to be the price calculator: we were storing prices as
floats with effectively unlimited precision and rounding at the very
end. The downstream accounting system rounded at every line.

We branched the calculator behind a feature flag — old behavior for
existing data, fixed behavior for new — and slowly moved customers
across. Now: every monetary calculation happens in the minimum
currency unit (cents), and rounding happens at the same boundary it
happens at downstream. There is no graceful way to retrofit this
into a system that was happily doing float math in production, so
the feature flag earned its keep.

## Silent failures when the posting window closed

Some charges weren't posting at all, and we didn't notice for days,
because the failure was silent: the downstream system had a
"posting window" (essentially a billing period), and once a window
closed, anything submitted against it was rejected without a useful
error.

The fix was partly observability — alert on the rejected-write
shape so we'd see it within minutes — and partly workflow:
detect the closed-window state before sending and route those
charges into a different reconciliation path.

# Two design decisions that paid off

A couple of choices, made early enough to matter, kept the system
from collapsing under the weight of the new flow:

**Prepayment as its own type.** The shortcut was to add a
`prepayment_percentage` column to the existing invoice model and
move on. We took the slower route: prepayment got its own
type. It cost some brevity at the model level, but every downstream
consumer — the sync, the locking, the state machine, reporting —
could now tell at a glance what it was looking at. There was
no "is this *really* a prepayment, or just an invoice with a
percentage set?" branch in any code path.

**A real state machine instead of boolean flags.** Locking an
invoice once it had been sent downstream started life as a single
boolean column. By the time we were done, the lifecycle had at
least five states with constraints on which transitions were
allowed. Replacing the boolean with an explicit state machine made
the sync logic — "sync this thing if it's in state X, ignore it if
it's in state Y, queue a follow-up if it's in state Z" — fall out
of the model rather than being scattered across the codebase.

# Stretching the framework instead of forking it

The biggest architectural decision was the framework one. We taught
the existing sync framework to support 1:N relationships rather than
writing a second pipeline.

The reason wasn't elegance. It was risk. A second pipeline meant a
second place to monitor, a second place where retries could go
wrong, and a second team mental model to keep loaded. Stretching the
framework was more work up front and more careful work — but every
existing capability (bulk operations, retry behavior, observability
hooks) came along with it for free.

If I had to summarize the whole project in one sentence: most of the
real work was the work we discovered after the happy path was
already running, and the early architectural choices were what
determined whether discovering it cost us a week or a quarter.
