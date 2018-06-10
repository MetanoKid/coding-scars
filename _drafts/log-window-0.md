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
  - CSharp
series: Log window from scratch
---

Programmers love logging stuff. From errors to very verbose debug data or _errors that should be warnings_. We love them.

Logging data is very useful when you're looking for something. Maybe there's a bug that's hard to reproduce so you add some logs to trace it down after it occurs. Maybe you just want to know the values of some variables at some point in the code without attaching a debugger. Or even whether your code gets called at all!

So, you start adding logs. Maybe not a lot of them, but _just enough_. And then you run your program and realize you aren't able to find your log because there are too many logs from other systems in the program (your past self added _just enough_ ones as well, maybe?). _If only it would be easy to view and filter them live..._

# Motivation

Logging is a common practice, and so is having a way to view the data you've logged. Maybe you direct them to _stdout_ and read the console _live_, as it goes. Maybe you save them to disk or send them over the net to read them _offline_. Maybe you use you IDE's or editor's built-in log viewer (i.e. Android Studio's Logcat, Unity's log panel).

I wanted to build my own take on a live log window that I could plug in most of my side projects. The goal was to create something that becomes a _written once, used more than once_ project, a log window that works with C++ and C# projects on Windows, mainly.

After some research it looked like [Windows Presentation Foundation (WPF)](https://en.wikipedia.org/wiki/Windows_Presentation_Foundation){:target="_blank"} was what I needed. So that's the framework we'll use.

## What's included?

These are the requirements:

  * Live viewing log data.
  * Tabular display.
  * Timestamps.
  * Colored log levels: i.e. _debug_ is black, _warning_ is yellow, _error_ is red.
  * Log systems/tags: _render_, _net_, _gameplay_.
  * Easy to integrate with other C++/C# projects.
  * Somewhat configurable from the host program: _which log levels/systems are relevant to this program?_
  * Auto-scroll: on and off.
  * Filters: by log level, by system.
  * _Good enough_ performance.

## What's not included?

There are some features that aren't in the scope of this project:

  * Persisting/copying log data.
  * Offline view of log files.
  * Filtering by log content.

# End result

So, after I worked on these requirements while writing some posts, this was the result:

![Final sample window with extra configuration]({{ '/' | absolute_url }}/assets/images/per-post/log-window-0/final-sample-window-extra-configuration.png){: .align-center}

# Confessions

I started this side project like three times. Each time with a different scope and approach.

I investigated what I could do and how. Then, what I really wanted to have. Then made an initial version and started writing a very long post on how to do it, step by step, and realized the approach was pretty boring.

After that I decided I'd start again but stay on point, have more screenshots while showing most of the code. With a bit of luck this approach is more engaging and you don't get bored!

# Road map

If you've been following this blog for a bit, you've already noticed some of the posts are part of a _series_. This is one of those too! So, what's in this series?

  * After this introduction we'll create a very basic log window with the bare minimum: logging simple data and viewing it live.
  * Then we'll convert it to a `Class Library` so we can plug it into other projects.
  * Later, we'll start adding some extra functionality to the window itself: configuring it from the host program, filtering log entries and the like.
  * Finally, we'll work on integrating it with a C++ project.

Are you ready? Then let's start!
