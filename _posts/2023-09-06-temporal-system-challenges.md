# Challenges of Time-Based Systems Without Proper Database Structures

When we store information in our database, we normally store it without a time dimension even if it is only valid for a specific period of time. For example, people move around all the time, but most apps ask for your current address and rely on you to change it whenever you move. This works because most applications have no use case to be aware of your address history and only need your current address.

However, for some systems, the time dimension is omnipresent whenever data is queried or mutated, and implementing them on traditional data models can pose serious challenges. I had a chance to work on a project with similar challenges that provided a good learning experience on how to overcome them. The project makes a good use case of how temporality can help streamline operations. To go into the details while not revealing proprietary information, let's use an example of a tax system.

## Situation

To understand the challenges, let's start with an overview of the tax system. We first define some use cases for our hypothetical tax system, understand the structure of tables involved in recording tax returns for users, and deep dive into problems due to that structure.

### Overview of Tax System

The tax system is a single tool for residents of a country to submit their tax returns according to the tax percentages set at the state level. The system is used by two roles: administrators and taxpayers. To avoid confusion, please refrain from comparing this system to a real-world tax system, as it serves only as a reflection of the actual system we worked with. Our hypothetical tax system only supports the following use cases.

![Temporal System Use Case Diagram](/assets/img/p2-image-1.svg)

Taxpayers, when they sign up, enroll themselves in tax types like income tax, capital gains tax, etc. Then each year, the system calculates the amount of tax that is due for that tax year and also allows them to enter the tax they paid throughout the year. For the sake of simplicity, how those two values, i.e., tax paid and tax due, are balanced is not our concern.

### Structure of Critical Tables

Although the problems spanned multiple tables, they can be generalized using two tables used for storing state taxes and tax returns. The `state_taxes` table stores the `rate` to calculate the tax due for the taxpayer. For example, if the income tax rate is 0.7 and taxpayer income is 100$ then the income tax due is 100 * 0.07 = $7. The rate varies by type of tax and state.


![Temporal System Database Design](/assets/img/p2-image-2.svg)

One important thing to point out here is that the system was not designed to handle varying versions of data over time, although we have the column `year` in the table `state_taxes`. The access patterns assumed one row per tax for a state and the type of tax when the table is joined or read directly. In other words, there is a `unique(state_id, type)` constraint on the table. That essentially means you cannot add the same tax for the same type, for different years. To have some audit compatibilities rows were not updated, rather updates were applied by soft deleting the old and creating new rows with updates.

The other table to consider is `tax_returns` responsible for storing the tax returns of a specific taxpayer. The table has one row per tax type for each payer, it stores tax returns within that row in the form of a JSON array.

![Temporal System Database Design](/assets/img/p2-image-3.svg)

The `returns` column was added as a solution for storing returns for each user while still conforming to having only one row per tax. The `deleted_at` key served the same purpose for each JSON object as it did in `state_taxes` the table.

### Problems with the Underlying Structure

The above structure functioned correctly only when data was added in a linear time order. However, a single retroactive update, whether to correct a mistake or add a new record, could introduce data inconsistencies. These inconsistencies sometimes led to data corruption, while in other cases, data loss occurred.

#### Data Loss on Updates

Unlike the `returns` column in `tax_returns`, the `state_taxes` table lacks a JSON column to store tax rates per year, presumably due to the absence of a use case for displaying rates for each tax year. As a result, any rate update, whether for correction or addition, results in the removal of the previous rate. In cases of retroactive updates, the system effectively loses the currently effective rate.

For example, suppose admin has added rates for tax years 2021 and 2023 (currently effective). They later realized that the rate for 2021 was incorrect and wanted to update it. Now since `state_taxes` can only support one row for a tax, adding a correct rate for 2021 will result in a loss of the 2023 rate. Another case is that rates were added correctly for years 2021 and 2023 but they missed adding a rate for 2022, now adding that rate will again overwrite the rate for 2023.

#### Data Corruption on Updates

The `tax_due` in the `results` column of `tax_returns` is a dynamic value calculated based on existing data in the system i.e. `income * tax_ratio`. Normally, such a calculated value shouldn't be stored, but due to the data loss issue mentioned earlier, it was necessary to save it to preserve the value using the tax rate effective at the time of calculation. However, this would be more akin to keeping the best possible value rather than the correct value.

The value stored at the time of adding tax returns remains valid as long as the factors used for its calculation, such as the tax ratio and income, are not updated. If these factors are updated, the field will contain an incorrect value according to the current system data and cannot be verified. In some cases, it might be argued that having no value stored is preferable to having an outdated or unverifiable one.

#### Ineffective auditing capabilities

The system is frequently used `deleted_at` and soft deletes to prevent loss of information for auditing purposes. Since they were system level, not application level construct, they were quite ineffective in providing any help to address the problems we have seen so far, when retroactive changes were made. The best case scenario was using them to figure out if a version of data existed at some point in some system and that is it.

In temporal systems, auditing capability is required at the application level to facilitate resolving risks. For example, let's say you bought a pair of shoes. After selling you that pair, the shop realized that the price was entered incorrectly in the system and they fixed it. Now, if you go back to return the shoes if they have a proper temporal system, they can quickly find out the effective price of shoes on the date when they were sold to you. Otherwise, there is no way for the system to find out the price on the date when the shoes were sold.

## Expectations from the Temporal System

What we went through while trying to uncover the problems were basically a consequence of implementing time-based systems without a proper structure to support temporal transactions. This now leads us to define expectations for a temporal system to avoid the problems that we uncovered while also making it easier for users to work with it.

### Consistent Timelines

As we have observed, when data validity is time-dependent, it results in multiple versions of data corresponding to different points in time. These variations collectively form timelines, and it is essential to maintain their consistency. Overlapping timelines can lead to indeterministic outcomes when attempting to identify a valid record for a specific date. To address this issue, consider the following example using the `state_taxes` table, which employs an [effective date range](https://en.wikipedia.org/wiki/Effective_date?ref=umairabid.com) to denote the validity of tax rates.

![Temporal System Database Design](/assets/img/p2-image-4.svg)


> [start_time, end_time) is a convention to define ranges with start and end date. Here "[" means range includes start_time and ")" excludes end_time

Now, let's consider the scenario where we need to determine the income tax rate effective on the date 2023-01-15. Upon inspecting the date ranges, we can identify that this date falls within the row with id=1. In this case, obtaining a single row ensures determinism.

However, if we attempt to find the rate for any date within February 2023, we would retrieve two rows. Consequently, for this rate, it becomes impossible to ascertain which ratio to apply. The motivation behind enforcing consistent timeframes is precisely to prevent such situations from arising.

### Consistent Implementation across tables

The implementation of temporal tables can vary from one table to another, and there may be situations where such customization is necessary. However, in most cases, it is not the ideal approach.

For instance, consider a scenario where you need to join three temporal tables together, and each of these tables has implemented temporality differently. In such cases, fetching data in a single query can be challenging, if not entirely impossible.

Moreover, while it may still be feasible to write data in such a setup, doing so often means sacrificing the potential for abstraction in both read and write patterns. A consistent implementation approach, on the other hand, enables seamless integration with Object-Relational Mapping (ORM) systems, making working with temporal tables a much more straightforward and efficient process.

### Prevent the loss of information

One of the fundamental reasons for incorporating a temporal aspect into your data is the preservation of information. In cases where information undergoes retroactive changes, it's crucial that the system retains the data as it existed before the alteration to maintain auditing capabilities.

In monetary systems, calculations often depend on specific configurations, even if those configurations are initially incorrect. These incorrect configurations are utilized in calculations until corrected. When these configurations are rectified later, with their effective or validity period remaining the same but only the data being updated, the system is still expected to retain the original configurations. They can help with auditing when you need to check what was calculated before at a specific point in time.

## Solution

As you might have already discerned, while many of these challenges and expectations can be addressed by extending the current design, such as expanding JSON columns to cover other columns and implementing upsert hooks to maintain system consistency, it's evident that straightforward use cases can rapidly escalate the complexity of a system.

In our forthcoming article, we will delve into a solution that tackles these issues without unnecessarily inflating system complexity.

