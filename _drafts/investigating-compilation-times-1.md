---
layout: single
title: "Useful tools to investigate C++ compilation times"
excerpt: "Let's talk about some of the tools I found and how I used them"
author: Meta
category: Toolbox
tags:
  - C++
  - CSharp
  - Visual Studio
  - MSBuild
  - Profiling
series: Investigating C++ compilation times
---

Programmers build the projects they work on several times a day. Most of the times we perform the minimal build cycle which is, usually: modify some code in a single file, save it, build. Other, sometimes painful, times you have to go through the full build cycle: you've got to rebuild the whole project. These cycles take some time and what happens under the hood is totally dependent on your development environment and your project.

It took me a while to start thinking about these cycles and whether they were taking longer and longer. You know what was the key element? Rising anxiety and feeling I wasn't as productive.

These slow build times come with some costs:
  * People aren't happy to stare at progress bar, they may as well start procrastinating.
  * The time they waste waiting is time they aren't improving your product, either adding new features or iterating.

Some time ago I started worrying about these degrading build times, so I set myself on a journey to identify what was causing it. Just so we are on the same page: my main development environment was Visual Studio 2015 running on Windows, building C++ projects with MSVC.

This was (more or less!) the process to answer: **how long does it take to build?**

Disclaimer: the project I'll use to illustrate the process is my (unreleased) Game Boy emulator. It's a small project that builds relatively quickly in my old laptop, so we won't see huge build times.

# Visual Studio options

First of all, I needed some numbers. Just the big picture, nothing too detailed. All I had was Visual Studio's output panel, and it just said:

{% highlight text %}
1>------ Rebuild All started: Project: A, Configuration: Debug x64 ------
1>  [...]
2>------ Rebuild All started: Project: B, Configuration: Debug x64 ------
2>  [...]
3>------ Rebuild All started: Project: C, Configuration: Debug x64 ------
3>  [...]
========== Rebuild All: 3 succeeded, 0 failed, 0 skipped ==========
{% endhighlight %}

I could take a stopwatch and start it as soon as I hit the build button, but not much more.

After checking Visual Studio's documentation and Stack Overflow questions on this matter, I ended up [on this Microsoft Docs site](https://docs.microsoft.com/visualstudio/ide/reference/options-dialog-box-projects-and-solutions-build-and-run){:target="_blank"}.

Let's just take a couple of options from this page to add some timing:

## Build and Run

![Visual Studio's Build and Run options page]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/visual-studio-options-build-and-run.png)

This page has several useful options, and we'll come back to it later on, but let's just take a look at *MSBuild project build output verbosity*.

If we increase it from *Minimal* to *Normal*, we get this output:

{% highlight text %}
1>------ Rebuild All started: Project: A, Configuration: Debug x64 ------
1>Build started DD/MM/YYYY HH:MM:SS.
1>  [...]
1>Build succeeded.
1>
1>Time Elapsed 00:00:03.08
2>------ Rebuild All started: Project: B, Configuration: Debug x64 ------
2>Build started DD/MM/YYYY HH:MM:SS.
2>  [...]
2>Build succeeded.
2>
2>Time Elapsed 00:00:03.60
3>------ Rebuild All started: Project: C, Configuration: Debug x64 ------
3>Build started DD/MM/YYYY HH:MM:SS.
3>  [...]
3>ClCompile:
3>  Main.cpp
3>  [...]
3>Link:
3>  [...]
3>Build succeeded.
3>
3>Time Elapsed 00:00:04.08
========== Rebuild All: 3 succeeded, 0 failed, 0 skipped ==========
{% endhighlight %}

Great! We now have some data! There are three interesting additions:
  * *Build started DD/MM/YYYY HH:MM:SS*: the real output doesn't show those letters, but actual numbers. We now know when this project started building.
  * *Time Elapsed HH:MM:SS.ms*: we now know how long it took to build this project.
  * *ClCompile*, *Link* and a lot of new sections: they are what MSBuild calls *targets*. We'll come back to them in depth later on.

If we increase the previous option from *Normal* to *Detailed* the output will be more verbose, and it will include more info on those *targets* and also add *tasks* to the log. All these data will prove extremely useful in the future, but they don't add extra information on how long it takes to build. The bad thing is the build itself gets slower as you increase this log level.

## VC++ Project Settings

![Visual Studio's VC++ Project Settings options page]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/visual-studio-options-vcpp-project-settings.png)

This page also has a handful of useful options, but the most important one for us is *Build Timing*.

When we enable it and build our project, we get something like this:

{% highlight text %}
[...]
3>Project Performance Summary:
3>     3592 ms  A.vcxproj   1 calls
3>               3592 ms  Rebuild                                    1 calls
3>
3>Target Performance Summary:
3>        0 ms  CppClean                                   1 calls
3>        [...]
3>        1 ms  GetCopyToOutputDirectoryXamlAppDefs        1 calls
3>        [...]
3>      176 ms  PostBuildEvent                             1 calls
3>     1341 ms  Link                                       1 calls
3>     1990 ms  ClCompile                                  1 calls
3>
3>Build succeeded.
3>
3>Time Elapsed 00:00:03.59
========== Rebuild All: 3 succeeded, 0 failed, 0 skipped ==========
{% endhighlight %}

Now we're talking! This output includes the time spent on each *target* as reported by MSBuild (we still don't know what's a *target*!), so we know where it's getting slow. Are C++ file compilations slow? Or maybe link times are too high?

By the way, this option and the one from the previous point are exclusive: you can leave the former as *Minimal* and enable the latter.

So far, so good! What should we do with this, then? Should we try to parse this output and build a timeline? Let's continue looking for tools first.

# Visual Studio extensions

A lot of the times you want some tool, chances are someone already built it. And, in this Visual Studio ecosystem we're bound to, we should take a look at Extensions.

## Build Monitor

[Build Monitor](https://marketplace.visualstudio.com/items?itemName=danielperssson.BuildMonitor){:target="_blank"} is an interesting extension that supports, at the time of writing, up to Visual Studio 2015.

Turns out, Visual Studio Extensions' SDK lets you get notified of some MSBuild key events: when did the build start? when did a project finish? And that's what this extension does. Build your solution and you'll get this kind of output:

{% highlight text %}
Solution loaded:    GameBoyEmulator
------------------------------------------------------------
 - 00h 00m 03s 551ms  -- LogWindowUI --
 - 00h 00m 03s 714ms  -- LogWindowBridge --
 - 00h 00m 01s 142ms  -- LogLibrary --
 - 00h 00m 04s 434ms  -- GameBoy --
 - 00h 00m 05s 542ms  -- MainWindows --
 - 00h 01m 10s 958ms  -- Test --
[1] Time Elapsed: 00h 01m 24s 545ms     Session build time: 00h 01m 24s 545ms
{% endhighlight %}

While Visual Studio is open, it will keep track of the *session*, adding up each compilation you do. But, what if you close Visual Studio? The *session* is gone, but the coolest thing is that sessions are persisted to a JSON file! This way, you can always access it.

### Tool idea

Have all programmers in your team install this extension. Create a tool that collects each JSON file at the end of the day, sends it to a server and clears it. Later on, aggregate all of the data and you have the time your team is wasting by building the project (including how often each project is built)! If you plot it, you can even see some trends over time or spikes when a big code change happens.

Be careful! The results may be daunting at first!

## Parallel Builds Monitor

If you liked the previous one but you prefer a more graphical approach, then take a look at [Paralel Builds Monitor](https://marketplace.visualstudio.com/items?itemName=ivson4.ParallelBuildsMonitor-18691){:target="_blank"}.

![Parallel Builds Monitor]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/parallel-builds-monitor.png)

Although this extension also has support to export build data to a CSV file and feed that data into another tool, it's the Gantt chart that I like the most. Not only it tells you which projects are building in parallel (you may think you removed some dependency but didn't!), it also gives you the total time spent on each project and the full build. Absolutely recommended.

  * doxygen
  * Header Hero
  * MSBuild Structured Log Viewer
  * /Bt+
  * /time+
  * /d1reportTime
  * /d2cgsummary
