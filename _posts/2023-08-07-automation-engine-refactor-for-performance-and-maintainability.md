---
title: Blog
layout: default
---

# Automation Engine Refactor for Performance and Maintainability

Imagine starting your day with your mailbox full of outages due to all database connections being held up for an extensive period. Nobody likes it and our team went on a mission to ensure we never have such a day again, at least for the exact root cause.

## Situation

The problem originated from the Pipeline Automation Engine of our CRM app. A pipeline consists of a series of stages that a [lead](https://en.wikipedia.org/wiki/Lead_generation?ref=umairabid.com) go through to either become a sale or be lost. Each stage has associated actions like sending emails or text, in addition to the move action which decides the next stage for the lead. To understand how the flow works, please consider the preliminary database design below.

![Automation Engine Database Design](/assets/img/p1-image-1.svg)

The right side of the design is relations or tables containing the configuration which dictates how automation will be executed. Whereas the left side helps run the pipeline automation for the specific lead. Here is a brief summary of each table,

**Pipeline**: For example "Google Adwords Campaign", can be one pipeline to convert leads from google adwords campaign to sales.

**Pipelines Stages**: Contains stages for each pipeline, for example, "Inquired", "Responded" etc can be the stages that a lead goes through.

**Pipeline Stage Actions**: Send an introduction email and then move them to the "responded" stage would be an example of how actions work together, where sending an email and moving them to the stage are separate actions.

**Lead**: Any internet user who clicked on your ad, landed on your page, and gave their information.

**Lead Stages**: Contains all the stages a lead has been or is currently in.

**Lead Stage Actions**: All the actions which have been performed on lead are recorded by stage in this table. As soon as the lead enters in stage, this table is also populated with actions for that stage. Actions are executed serially.

## Problem

The beauty of startups is that you build something for one purpose and customers may use it in all different ways except the one it was intended for. This automation feature was built to manage the lead automation coming from landing pages, but one of our customers imported around 16k leads and ran automation on all of them. This caused an instant outage, where the connections were held up by queries coming from the automation system code. When we investigated the code scheduled to run after every five minutes, the problem became very apparent. Below is the simplified version of that code.

```
for each lead in leads
  lead_stages = get_lead_stages
  for each lead_stage in lead_stages
    last_performed_action = lead_stage.last_performed_action
    sequence_number = last_performed_action.sequence_number || 0
    action_to_perform = lead_stage.pipleline_stage.action_after(sequence_number)
 
    if action_to_perform
    	action_to_perform.perform
```

The thing which instantly comes out and explains the problem is that we are querying the full leads table after every five minutes, some non-apparent problems which were adding fuel to the fire were,

1. The job had no unique clause or any preventive measures to not schedule the job if the previously scheduled was still running
2. No eager loading is being used
3. Truly brute force, not making any use of information already stored in the system to determine which leads and actions need to be performed. Hence too many unnecessary computations.

## Solution

The brute-force nature of the solution provided an obvious hint for the solution i.e. limit unnecessary computations. Considering the major source of unnecessary computations was scanning the leads table, we could also rephrase the problem to "How do we only fetch the leads which have pending stage actions". Once the problem was stated, the solution was a no-brainer since we can easily filter out the leads for whom all stage actions have been executed.

Couple the above improvement which significantly reduced the leads every time the job is run with improvement over making the job unique and not scheduling it if the is still in progress, the two quick fixes helped us to resolve the outage, but we had to ask how long until the next outage?

## Challenges on the Horizon

This was one of the core features where performance was not only expected but needed to be guaranteed under specific SLAs (e.g. the next action should be performed within 2 minutes after performing the previous one). Considering how one customer used the system in a way it was not intended to be used, it was only a matter of time before other customers put the system under identical stress. The system had to be rethought and replanned to at least give the first few hundred customers the best experience while we invested in other parts of the app.

After a few discussions and meetings, the following problems (in order of their priority) were identified to be fixed,

1. One lead action should not block another lead action. Sending emails or texts can be an expensive operations
2. Performing actions can fail due to any number of reasons and the system is missing the retry ability. This especially becomes important due to the rate limits of third-party services. This also aggregates the first problem.
3. Importing 16000 leads is fine but adding them all into automation at once is not, especially when multiple accounts do that in a narrow window of time. There should be a limit on how many automation can be scheduled per account.
4. The query to fetch leads with pending actions might still return where no further action is required. For example
  - "wait" action can be used to add a buffer between actions until the wait time is over, no action can be performed on lead
  - Some actions might be triggered when as a response from the lead, like a reply to an email or text. Until a reply is received or the threshold to receive a reply is not over, no action can be performed on the lead.

## Scaling upwards

The first two problems pointed out that our system is missing two key pieces, making the automation loop async and applying throttling on automations by the organization. For rest, we also needed to augment `lead_stage_actions` table to store some extra information which would help filter out the leads if they are pending on user action or just need to be scheduled at some time in the future. To work around the problems we added,

Two columns in the `lead_stage_actions` table,

1. `perform_at` Action can only be performed after this timestamp
2. `status` Hold status for lead actions, only pending actions can be performed

and few classes, two fundamental classes were `Scheduler` responsible for querying and distributing actions to their appropriate handlers and `AutomationActionHandler` which all individual action handlers extend from (e.g. `EmailActionHandler`, `SmsActionHandler` etc.)

![Automation Enginer Class Diagram](/assets/img/p1-image-2.svg)

## Knitting Everything Together

Eventually, we replaced the original automation loop with the following flow encapsulating primary automation flow end to end. The dashed lines represent the async/indirect flow where the next step is not executed in the same process. Few highlights of the flow

1. The scheduler is lean and only depends on one simple query.
2. All action handlers get executed in separate threads independently.
3. Rate limiting is applied on the action handlers level, allowing users to add leads in stages but preventing organizations to use more than allocated processing.
4. The automation fails gracefully in case of errors.

![Automation Enginer Flow Chart](/assets/img/p1-image-3.svg)

## Aftermath

After the release, we continue monitoring the performance and user activities but nothing major came up, except tweaking limits and small bug fixes here and there. We had some concerns that relying on status to identify pending action may run into concurrency issues but since the application was not supposed to run on a massive scale just yet, we relied on database locks to ensure consistency.