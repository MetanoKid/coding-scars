---
layout: single
title: "My journey investigating long compilation times in C++"
excerpt: "Things I learned when trying to shorten compilation times"
author: Meta
category: Toolbox
tags:
  - C++
  - Visual Studio
  - MSBuild
series: C++ compilation times
---

People don't usually enjoy processes that take long to complete without their direct interaction. And even when they interact, it may be boring
Making some coffee? *I want it already!* Doing the laundry? *If only it didn't take hours*. Riding a slow elevator? *Please, c'mon.*

One good thing about these processes taking long is being able to do something else in the meantime, and if you do them only once or twice in a day you may not bother.

Programmers repeat one thing way too many times a day: building the project they're working on. And chances are you've come across this awesome webcomic:

[![Compiling!](https://imgs.xkcd.com/comics/compiling.png "Compiling!"){: .align-center}](https://xkcd.com/303/)

Yeah, at first you may smile and think *hey, it's funny because they're not working*. However, when that happens on a daily basis you start thinking *oh, not again* instead.

This isn't a pathology for a single language, platform or business: you may be a game programmer whose project takes several minutes to build, or a front-end developer whose packaging and deployment process lets you have some breakfast while it finishes or you may have some kind of assets in your project you need to preprocess and you wish you didn't need to.

# Motivation

I've been worrying about slow build times lately. Programmers are more or less used to profiling their programs, but we don't use to profile our build/deployment times. When they're slow, they cause frustration and discourage both architecture and feature iteration. And yes, they cost your company increasing amounts of money because people aren't making new stuff and they aren't happy.

In the last months (and those to come) I've tried to learn what kind of things cause slow compilation times. I've read about ways to investigate them. Found some tools, used them, built my own. Most of the stuff I've looked for matches my main development environment: Visual Studio on Windows, compiling C++ code with MSVC.

In this series I'd like to share what I've learned in the process, some of these tools I've discovered and how I've applied that knowledge to my work. I also want to talk about a way to visualize MSBuild's build process using Chrome's Tracing viewer and how it helped me, inspired by [@aras_p](https://twitter.com/aras_p) from [this blog post](https://aras-p.info/blog/2019/01/16/time-trace-timeline-flame-chart-profiler-for-Clang/):

![PLACEHOLDER](https://via.placeholder.com/900x400.png)

## Disclaimer

Unfortunately, this isn't a series about *how to speed up your compilation times* (although I'll link most of the blog posts I found useful on that matter as we go).  
Instead, I want to share what I've learned while *investigating slow compilation times*: how MSBuild deals with solutions and projects, how to configure Visual Studio add some insights, how some MSVC compiler flags can give you a heads up on your development cycle.

You know, the first step when optimizing something is to get some metrics we can compare with, or else we couldn't know whether we've improved. Some useful questions to answer are: *how long does it take?*, *how many resources it uses?*

Last thing before we start, please answer this question: how much time you *think* you waste waiting for your project to build, each day?







Slow compilation times don't encourage refactoring.
They cause anger when "NucleoDeLaTierra.h" is touched and everything gets recompiled.
Improved with better computers and compilers.
PCH, flags, but before you try to improve times you need to know where you are.
Build Monitor, Parallel Builds Monitor, Visual Studio configuration to get more output on compilation, /Bt+, /time+, /d2cgsummary, /d1reportTime.
"All files up to date" when you compile and one CL group is already compiled, why do you have several of those?
What's MSBuild doing? Can we visualize it?
C# MSBuild API, events, context.
Generate Chrome Tracing file and visualize up to task.
Add support for /Bt+ and /time+, visualize CL and Link extra data.
Play with some flags and show different results, /Gm, /MP.
