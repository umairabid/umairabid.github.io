---
layout: default
title: Traveling time with Postgres Range Columns
---

In [Challenges of Time-Based Systems Without Proper Database Structures](/2023/09/06/temporal-system-challenges.html), we looked into everything that went wrong when we tried to build a temporal system without a compatible foundation. In this article, we will describe how we added that foundation to support temporal use cases. We will start by discussing how we built the foundation using Postgres ranges that could be a potential denominator for any time-based system. The solution might not be general enough but it can provide some good insights for building a foundation for the temporal system.

# Migrating First Table

We started by migrating the `state_taxes` as it contained fewer rows and had fewer dependencies than other tables. The reason for starting with a relatively simple table was to vet the solution with minimum dependencies and then expand to other tables. The first version of the table structure we came up with was as follows.

```
CREATE TABLE IF NOT EXISTS public.state_taxes
(
  id bigint NOT NULL DEFAULT nextval('state_taxes_id_seq'::regclass),
  state_id integer NOT NULL,
  tax_type character varying COLLATE pg_catalog."default" NOT NULL,
  rate numeric NOT NULL,
  effective_range daterange NOT NULL,
  system_range tsrange NOT NULL,
  CONSTRAINT state_taxes_pkey PRIMARY KEY (id),
  CONSTRAINT prevent_overlapping_state_taxes EXCLUDE USING gist (
      system_range WITH &&,
      state_id WITH =,
      effective_range WITH &&,
      tax_type WITH =
  )
)
```

# Understanding State Taxes Structure

The key and important difference from the previous version is two columns `effective_range` and `system_range` with the addition of the constraint `prevent_overlapping_state_taxes`. Let's go through each of them and see what value they add

## Effective Range Column

This column unlocks the ability to create timelines by having a rate for a specific start and end date, eliminating the need for year the column. The clients will add rates only by providing a start date and the backend system will automatically detect the end date for the rate. The benefit of using range columns is that querying becomes easier using powerful [Postgres range functions](https://www.postgresql.org/docs/9.3/functions-range.html?ref=umairabid.com). For example, if a client asks for a rate on a specific effective date we can easily find it by searching a row whose effective range overlaps with the provided effective date.

## System Range Column

`system_range` helps us solve the shoe store problem discussed in the last article. This column stores the validity of data in terms of system time, also in the form of a range with specific start and end dates. When a rate is added, the system will set the current time at the time of change as the start of the validity range. Later if the rate is invalidated, the system will set the end time as the end of the system range when the change was made. This eliminates any need for maintaining `deleted_at` columns. The system range actually removes the concept of soft deletes and replaces it with versioning the data with system validity.

## Exclude Constraint

You can think of this constraint as a unique constraint but since ranges are involved and we want to check for overlapping ranges, the exclude constraint was used. Exclude constraint basically doesn't allow two rows to exist that return true for the provided gist condition. This helps us ensure we only get one valid row for one effective date.

# Adding Timeline Logic to State Taxes

With a solid underlying table structure to support temporal operations next step was to add logic to `StateTaxes` model which will ensure the timeline logic of changes as they are added. We defined the following expectations for handling changes

## First Change

If a rate is added for state tax for the first time for the effective date let's say `2023-01-01` we expected the following record in the table

![Temporal Database Design](/assets/img/p3-image-1.png)

This row tells us that the rate 0.15 is effective from 2023-01-01 till the end of time and it is valid from 2023-10-16 (the time it was added) to the end of time, for state_id=1 and tax_type=income_tax (identified unique tax rate). This statement can be understood by a few queries, let's ask the system for a rate effective on 2023-05-01

```
SELECT rate 
FROM state_taxes 
  WHERE state_id = 1 AND 
  tax_type = 'income_tax' AND
  effective_range @> '2023-05-01'::date
 
#=> 0.15
```

This seems correct since the rate is effective from 2023-01-01 to end of time, let's ask for the rate before this date\

```
SELECT rate 
FROM state_taxes 
  WHERE state_id = 1 AND 
  tax_type = 'income_tax' AND
  effective_range @> '2022-12-31'::date
 
#=> null
```

As expected since the date is before the date the first rate is effective, the query returned nil. Now let's query for any rates valid in the system time before the date 2023-10-16

```
SELECT rate 
FROM state_taxes 
  WHERE state_id = 1 AND 
  tax_type = 'income_tax' AND
  system_range @> '2022-10-16'::timestamp
 
#=> nil
```

This returns nil because as far as the system is concerned no rate existed in the system time for 2023-10-16, this is how it helps in the example of a shoe store by finding rates when transactions occurred in the system.

## After First Change

If the first change is already added the rest of the changes will fall in one or a combination of the following scenarios

1. The new change has the same effective date as the effective date (Correction)
2. The new change effective date is before the existing change effective date (Past Change)
3. The new change effective date is after the existing change effecting date (Future Change)

## Adding a correction

When a new change has the same effective date as an existing change, we need to invalidate the existing change and replace it with a new one. It is called a correction because the new change replaced the old one. If we correct our first change rate from 0.15 to 0.19 the result will look like something below

![Temporal Database Design](/assets/img/p3-image-2.png)

It shows that we invalidated our first change by adding an end to system_range of the first change and then added the correction with the new rate. Now if only query valid rates effective on or after 2023-01-01 we get 0.19

```
SELECT rate 
FROM state_taxes 
  WHERE state_id = 1 AND 
  tax_type = 'income_tax' AND
  lower(effective_range) >= '2023-01-01' AND
  upper(system_range) is null # only valid rates have system_range null
 
#=> 0.19
```

## Adding a Past Change

When a new change is added whose effective date is before the already existing change, then the new change should automatically assume an end date as well. This makes sure that end result is a consistent timeline where effective ranges don't overlap. For example, continuing from before, if we add a change for the effective date 2022-12-01 with rate 0.14 then execute the query

```
SELECT * 
FROM state_taxes 
  WHERE state_id = 1 AND 
  tax_type = 'income_tax' AND
  upper(system_range) is null
ORDER BY lower(effective_range)
```

It will return the following result

![Temporal Database Design](/assets/img/p3-image-3.png)

## Adding a Future Change

When a change is added whose effective date is after the existing change, the existing change needs to have a new end date. So in order to apply the change, we correct the existing change by replacing it with a new end date. Now in our example if we add a rate 0.25 with effective date 2023-02-01 the query in the previous example will return the following result

![Temporal Database Design](/assets/img/p3-image-4.png)

For reference fetching changes including the invalidated ones results in the below

![Temporal Database Design](/assets/img/p3-image-5.png)

You can find the implementation for the rails model [here](https://gist.github.com/umairabid/54ca1f6ab7a32439554551418847ced5?ref=umairabid.com) and [migration](https://gist.github.com/umairabid/7fe9619d73e0a17558145b5d4fe6e9fe?ref=umairabid.com) here to run examples by yourself.

# Scaling beyond State Tax Table

After completing the implementation for the state tax table, the next task was to assess how this implementation would work when joining tables and how the same implementation could be applied to other tables. We immediately saw that we needed to modify our approach or rethink our table relations.

## Problem with Relations

Initially before adding effectivity to state_tax table, the id was an explicit primary key to identifying a unique tax rate, whereas the composite key (state_id, tax_type) served as the implicit primary key. However, with the new structure, the id was no longer the key to identify a tax rate hence won't work as a foreign key meant to identify a unique tax, and reason why we had to resort to using the composite key to identify taxes.

The nature of the issue can be traced to the fact that before the change each row state_tax was one "tax rate" but after, a row was one "tax rate change". In other words, after changing the structure the table should also have been renamed to state_tax_changes. To fix the relations we thought about just having a running id in the table to be used as the foreign key in the related tables. Still, the insight that we have fundamentally changed the table prevented us from continuing with the running id hack.

## Splitting the Tables

To resolve the relations as they were defined currently we decided to not replace tables but rather split tables into the main model and its effective attributes. So effective attributes of state_taxes were moved to another table state_tax_changes. The resulting table structures looked something like the ones below

```
CREATE TABLE IF NOT EXISTS public.state_taxes
(
    id bigint NOT NULL DEFAULT nextval('state_taxes_id_seq'::regclass),
    state_id integer NOT NULL,
    tax_type character varying COLLATE pg_catalog."default" NOT NULL,
)
```

```
CREATE TABLE IF NOT EXISTS public.state_tax_changes
(
    id bigint NOT NULL DEFAULT nextval('state_taxes_id_seq'::regclass),
    state_tax_id integer NOT NUL
    rate numeric NOT NULL,
    effective_range daterange NOT NULL,
    system_range tsrange NOT NULL,
    CONSTRAINT state_tax_changes_pkey PRIMARY KEY (id),
    CONSTRAINT prevent_overlapping_state_taxes EXCLUDE USING gist (
        state_tax_id WITH &&,
        effective_range WITH &&,
        tax_type WITH =
    )
)
```

Although from the implementation perspective splitting tables added more complexity due to breaking up existing tables. However, this complexity was only temporary and was expected to subside with the migration of old tables. The benefit of this approach was that it reflected the true nature of our data tables. Previously one state tax had one rate and now one tax had many which was nicely reflected in `state_taxes` and `state_tax_changes` table.

# Conclusion

This project was not easy or smooth by easy means as we had to deal with some issues that were not directly related to not have temporality but as we moved ahead with the system the choice of undertaking a large refactor proved to be correct. It was a great reminder that no matter how good you are design is, if it isn't compatible with business it can't get you very far.

