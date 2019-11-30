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
