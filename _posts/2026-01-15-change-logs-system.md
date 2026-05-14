---
title: Adding a Change-Log System Without Breaking the One You Have
description: Building an audit trail into a live product is mostly about what *not* to break — observability, latency, context, and a database that can scale alone.
---

Customers wanted to know who did what, and when, and they wanted to
know it without having to ask us. Specifically: was that change made
by a human, or by automation? When two stakeholders disagreed, the
default move had become to ask engineering to dig through logs. Not
sustainable.

The ask sounded simple — "log changes to objects" — but the
constraint that made it interesting was that we were adding this to
a system that was already running. The audit path had to do its job
without breaking the path being audited.

# The shape of the problem

What we actually needed was:

- A record per change, with **what** changed, on **which object**,
  by **which actor**.
- The ability to ask "show me everything that happened to this
  object" — quickly, and across a lot of history.
- Zero impact on the latency of the operations being audited.
- A failure in the audit path that does *not* leak into the
  operation it's auditing.

The closer we got to that list, the more it looked like a side
system that happened to share a database key with the main app —
not a feature inside it.

# Capturing changes the right way

The codebase had been moving toward a command pattern: each business
operation fulfilled by a small object that owned its context. That
turned out to be the lever we needed.

We wrote a concern that any command could mix in, and the concern
took care of the boring parts:

- Snapshot the model before the mutation, snapshot it again after.
  Diff. That's the "what changed."
- Pull the current actor and the current user out of context.
  These are not always the same person.
- Build a payload — either from the active record directly, or via
  an adapter for cases where the change spanned multiple models or
  lived deeper than a single object.
- Schedule a background job to persist the change-log entry.
- Enrich the payload after the fact: turn `user_id: 7` into
  `user: "My Name"` so anyone reading the log later doesn't need
  another query to make sense of it.

The concern existed so commands stayed readable. The thing a command
*looks* like, in code, is the business operation — not the
bookkeeping.

## Actor vs. user (the distinction that matters)

The single most important thing the change-log captured wasn't
*what* changed. It was **who did it**.

There is a difference between the user whose data was affected and
the actor who performed the change. For self-service flows they're
the same. For impersonation, API tokens, and automation, they are
not — and the whole reason customers wanted the audit trail was to
tell those cases apart.

If we'd modeled this as a single `user_id`, we'd have shipped a
product that couldn't answer the question it was built for. The
moment we got that distinction right in the data model, the rest
got noticeably easier.

# The constraints that shaped the architecture

Three things forced most of the design:

**Operations were already near their SLA.** A bunch of the
operations we wanted to audit had p95 latencies that didn't leave
us room to do extra synchronous work. That ruled out writing the
change log inline. So: every persist goes through a background
job. The command captures, the worker stores.

**An audit failure must not become an operation failure.**
"Recording that you did the thing" cannot break "doing the thing."
That meant strict isolation: the change-log worker has its own
queue, its own dashboards, its own alerts. If it falls over,
nothing in the user-facing path notices.

**Operations performed in the background lose their user
context.** Workers don't have a session attached. We had to make
peace with the fact that for some backend-only operations, the
actor is going to be a system default rather than a real person.
Pretending otherwise would have meant lying in the audit log.

# Why DynamoDB

This was the most contested decision and the one I'm most sure
about in hindsight.

The shape of the queries was:

- "Everything for object X, newest first."
- Append-heavy, read-rarely.
- Going to grow forever.

The shape we did *not* need was joins. A change-log entry doesn't
join to anything; the payload is denormalized at write time, on
purpose, so that years later we don't accidentally show stale
context because some related record got renamed.

That's a fairly precise fit for a key-value store with sortable
range keys, and a fairly bad fit for the main relational database
that was already under load from the rest of the product. Putting
this in Dynamo meant the audit table could grow without competing
for resources with the primary database. It cost us some
infrastructure complexity. It bought us the ability to forget about
the change-log table when we were tuning anything else.

# Legacy paths got a wrapper

Most of the API had moved to the command pattern, but a chunk of
the legacy API hadn't. We found that out later than we'd have liked.

Rewriting the legacy API to use commands was a separate, larger
project that wasn't going to ship in time for this one. So we built
a wrapper: the legacy API hands an action and a context to it, the
wrapper builds an object that walks and talks like a command, mixes
in the same concern, and calls the same log function.

It's a shim. It will get deleted when the underlying API gets
modernized. Until then it means there is exactly one path that
writes change-log entries, which is the property worth protecting.

# Rolling it out without making any noise

We turned the change log on one action at a time, behind a flag.
Each action's worker had its own dashboard. We'd flip the flag,
watch the queue depth and error rate for a few hours, then move on
to the next action. If something looked off, the flag came back
off and the operation went back to behaving exactly as it always
had.

By the end of the rollout the audit trail was complete, and no
customer had noticed anything had changed — which, for the audit
log, is the highest compliment.

# What I'd take to the next one

A few things that I think generalize:

- **Move side-system writes off the user request path.** A
  background job, with its own queue and its own observability,
  buys you both performance headroom and isolation.
- **Pick the data model for the actual query shape.** A growing,
  append-heavy, no-joins workload does not belong on your main
  relational DB just because that's where everything else lives.
- **Separate actor from user, in the data, on day one.** The
  difference between "who is this for" and "who did this" is the
  difference between an audit log that answers questions and one
  that creates them.
- **Wrap, don't rewrite, when you have to ship.** A focused shim
  around legacy code is allowed to exist if it preserves a single
  canonical write path. Just be honest about it being a shim.
