---
layout: single
title: "Log window from scratch: introduction and motivation"
excerpt: "Why a live log viewer is desirable and how we're creating one?"
author: Meta
category: Toolbox
tags:
  - Log
  - WPF
  - Logcat
  - C++
series: Log window from scratch
---

Programmers love logging stuff. From errors to very verbose debug data or _errors that should be warnings_. We love them.

Logging data is very useful when you're looking for something. Maybe there's a bug that's hard to reproduce so you add some logs to trace it down after it occurs. Maybe you just want to know the values of some variables at some point in the code without attaching a debugger. Or even whether your code gets called!

So, you start adding logs. Maybe not a lot of them, but _just enough_. And then you run your program and realize you aren't able to find your log because there are too many logs from the rest of the program. _If only it would be easy to filter them..._

# Motivation

Logging is a common practice, and so is having a way to view the data you've logged. Maybe you direct them to _stdout_ and read the console _live_, as it goes. Maybe you save them to disk or send them over the net to read them _offline_. Maybe you use you IDE's or editor's built-in log viewer (i.e. Android Studio's Logcat, Unity's log panel).

I wanted to build my own take on a live log window that I could plug in most of my side projects. The goal is to create something that becomes a _written once, used everywhere_ project.

I want this log window to work with C++ projects on Windows, mainly. After some research it looks like [Windows Presentation Foundation (WPF)](https://en.wikipedia.org/wiki/Windows_Presentation_Foundation){:target="_blank"} is what I need. So that will be the framework we'll use.

## What's included?

The idea is to create something that covers the basic needs. A simple log window that can be easily integrated into other projects. It should include:

  * Live viewing log data.
  * Tabular display.
  * Timestamps.
  * Colored log levels: _debug_, _warning_, _error_.
  * Log systems/tags: _render_, _net_, _gameplay_.
  * Easy to integrate with other C++/C# projects.
  * Somewhat configurable from the host program: _which log levels/systems are relevant to this program?_
  * Auto-scroll: on and off.
  * Filters: by log level, by system.
  * _Good enough_ performance.

## What's not included?

There are some featurs that aren't in the scope of this project:

  * Persisting log data.
  * Offline view of log files.
  * Filtering by log content.

# Confessions

I started this side project like three times. Each time with a different scope and approach.

First, I investigated what I could do and how. Then, what I really wanted to have. Then made it and started writing a very long post on how to do it, step by step, and realized the approach was boring.

So, I hope this third approach is engaging enough and stays on point. With a bit of luck, I can soon start using it on my next side project!

# Road map

If you've been following this blog for a bit, you've already noticed some of the posts are part of a _series_. This is one of those too!

After this initial introduction we'll create the very basic log window, with the bare minimum: logging stuff and viewing it live.  
Then, we'll start adding functionality to the window itself: columns, filters, configuration from the host program.  
Finally, we'll work on integrating it with C++.

Let's go!
