---
title: Introducing LazySQL: A Database Client for the Shell
description: 
---

I always have had an urge to keep my system memory as low as possible. Initially it was due to lower compute available on my dev machine. Down the
road I luckily did get my hands on power machines but the urge remained. Partially due to ever increasing memory usage of IDEs and browsers but new
tools didn't help either. Running docker, visual studio code, database client, git client, postman and all other sorts of client didn't help and on
top of it, if I was profiling background jobs, I was easily consuming 99% of memory. At this point memory was also not the only thing, switching
between windows, keeping track of terminals running within IDEs and emulators for tailing logs was a headache in its own.

I avoided vim because the shame of not being able to close one was too much. However, couple of years ago I started dabbling into self hosting and
setting up observability stack instead of using off the shelf ones. That forced me to finally conquer my fear of vim. In the beginning, it was little
things like editing nginx configs, tweaking docker files and navigating log files. My vim config eventually went to a point where I was able to
perform most of my work within vim. After discovering tmux for building mini dashboards, it felt like my toolkit was complete and in my timeoff, I was
able to build my workflow entirely within terminal. Browsers used to come late in my development flow as tdd practitioner. The only hurdle was my
databasea client and they did not just had one pain point.

Most of the good ones are licensed and each organization I worked with had different one depending on the technologies being used. If you were using
nosql like dynamo they had their own clients. Most of the clients are general purpose way more tools than what normal application developer needs. My
muscle memory just worked with vim shortcuts, editing queries were becoming a headache. Most of all, in most of modern enviorments, database
credentials are usually kept in vaults and rotated even for development environments. That required constant copying and pasting credentials. All in
all, I was looking for hackable, minimal client with vimbindings, just like lazygit. There was one opensource solution but the UI was not up to my
taste, missing some features I was looking for. Having recently built an experiement arch linux installer, I was like why not and hence LazySQL was
born.

LazySQL is a tui based application written in go with help of bubbltea and vimtea. It currently supports 
- postgres but the hackable nature allows to easily plug more database drivers. 
- It supports the usual with authentication with additional mode of configuring command to fetch credentials. 
- In case of saving credentials, it takes benefit of os keyrings if available. 
- It uses bindings famililar to vim and lazygit for navigation. 
- For database explorarion it uses binding inspired from vim-fern, where once your reach the leaf nodes you can load the data in viewer pane. 
- The editor allows you to run specific part queries using Ctrl+r binding. This was not available in vimtea and functionality is added in fork and PR has been opened. 
- Having an LLM agent within the app is intentially omitted since I don't see every app having their own chatbox sustainable. Instead each session
  opens a log file, that can be fetched directly into any LLM agent of choice. You will need PID, that is shown in footer.

In future iterations

- More database drivers will be added, starting with mysql and dynamo.
- Additional tools will be added to support llm agents, like adding and running queries directly from agent within specific instance of app
- Bug fixes and performance improvements.
- Adding support for more database and requested features.

