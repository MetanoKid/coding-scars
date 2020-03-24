---
layout: single
title: "Useful tools to investigate C++ build times"
excerpt: "Let's talk about some of the tools I found and how I used them"
author: Meta
category: Toolbox
tags:
  - C++
  - CSharp
  - Visual Studio
  - MSBuild
  - Profiling
  - MSVC
  - Flag
series: Investigating C++ compilation times
---

People build the projects they work on several times a day. More often than not, we perform the minimal build cycle: modify some code in a single file, save it and build. Other, sometimes painful, times we have to go through the full build cycle: rebuilding the whole project.

These cycles take some time and what happens under the hood is totally dependent on your development environment and project.

It took me a while to start worrying about these cycles and whether they were long or not. You know why it started? With rising anxiety and feeling I wasn't as productive.

These slow build times come with some costs:

  * People aren't happy to stare at progress bar, so they may as well procrastinate and lose focus.
  * The time they waste waiting is time they aren't improving your product, either adding new features or iterating.

So, a while ago I set myself on a journey to identify what was causing them. And just so we are on the same page: my main development environment was Visual Studio 2015 running on Windows, building C++ projects with MSVC.

This was (more or less!) the process to answer: **how long does it take to build?**

Disclaimer: although we're talking about long build times, the project I'll use to illustrate the process is my (unreleased) Game Boy emulator. It's a small project that builds relatively quickly in my old laptop, so we won't really see huge build times.

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

Let's explore some options.

## Build and Run

![Visual Studio's Build and Run options page]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/visual-studio-options-build-and-run.png){: .align-center}

This page has several useful options, and we'll come back to it later on, but let's just take a look at *MSBuild project build output verbosity*.

If we increase it from `Minimal` to `Normal`, we get this output:

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

Great! We now have some data to work with! There are three interesting additions:

  * `Build started DD/MM/YYYY HH:MM:SS`: the real output doesn't show those letters, but actual numbers. We now know when this project started building.
  * `Time Elapsed HH:MM:SS.ms`: we now know how long it took to build this project.
  * `ClCompile`, `Link` and other new sections: they are what MSBuild calls *targets*. We'll come back to them in depth later on.

If we increase the previous option from `Normal` to `Detailed` the output will be more verbose, it will include more info on those *targets* and also add *tasks* to the log. All this data will prove extremely useful in the future, but they don't add extra information on how long it takes to build. The bad thing is the build itself gets slower as you increase this log level.

## VC++ Project Settings

![Visual Studio's VC++ Project Settings options page]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/visual-studio-options-vcpp-project-settings.png){: .align-center}

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

By the way, this option and the one from the previous point aren't related to each other: you can leave the former as `Minimal` and enable the latter.

So far, so good! What should we do with this, then? Should we try to parse this output and build a timeline? Let's continue looking for tools first.

# Visual Studio extensions

A lot of the times you want some tool, chances are someone already built it. And, in this Visual Studio ecosystem we're bound to, we should take a look at Extensions.

Let me discuss a couple of the ones I found more suitable for my needs.

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

While Visual Studio is open, it will keep track of the *session*, adding up each compilation you do. But, what if you close Visual Studio? The *session* is gone, but the coolest thing is that sessions are persisted to a JSON file! This way, you can always come back to them.

This is good enough to compare two builds together!

### Tool idea

Have all programmers (or everyone using Visual Studio!) in your team install this extension. Build a script that collects each JSON file at the end of the day, sends it to a server and clears the local one. Later on, aggregate all files together, tag data as necessary and you have the time your team is wasting by building the project (including how often each project is built)! If you plot it, you can even see some trends over time or spikes when a big code change happens.

Be careful! The results may be daunting at first (i.e. too much time wasted)!

## Parallel Builds Monitor

If you liked the previous one but prefer a more graphical approach, then take a look at [Paralel Builds Monitor](https://marketplace.visualstudio.com/items?itemName=ivson4.ParallelBuildsMonitor-18691){:target="_blank"}. It's got better version support, up to Visual Studio 2019 (at the time of writing).

![Parallel Builds Monitor]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/parallel-builds-monitor.png){: .align-center}

Although this extension can also export build data to a CSV file, it's the Gantt chart that I like the most. Not only it tells you which projects are building in parallel (you may think you removed some dependency but didn't!), it lets you quickly see how long did each project take to build. Absolutely recommended!

This graph can be docked like another panel, so be careful if you're an anxious person: seeing how much time is gone on each build may be unwise for you!

# MSVC compiler flags

Nice, so we've got some big numbers and we know which projects take longer to build. But we still don't know where time is spent! Fortunately, MSVC has some compiler options that can help us investigate further:

## /Bt+

This flag applies to the compiler and produces this sample output when turned on:

{% highlight text %}
1>  File.cpp
1>  time(Z:\path\to\compiler\c1xx.dll)=0.39427s < 1617765075910 - 1617766036302 > BB [Z:\path\to\File.cpp]
1>  time(Z:\path\to\compiler\c2.dll)=0.06475s < 1617766053824 - 1617766211553 > BB [Z:\path\to\File.cpp]
{% endhighlight %}

This shows the time spent on the front-end (`c1xx.dll` as we're compiling C++ code, it would be `c1.dll` when compiling C code) and on the back-end (`c2.dll`). It's extremely useful to narrow the long times down.

You can find more info on the [official C++ devblogs](https://devblogs.microsoft.com/cppblog/vc-tip-get-detailed-build-throughput-diagnostics-using-msbuild-compiler-and-linker/){:target="_blank"}.

## /time+

This one applies to the linker and gives this kind of output in a typical Debug build:

{% highlight text %}
5>  Linker: Pass 1: Interval #1, time = 0.78976s [Z:\path\to\program.exe]
5>  Linker:   Wait PDB close Total time = 0.32035s PB: 7331840 [Z:\path\to\program.exe]
5>  Linker: Pass 2: Interval #2, time = 0.48362s [Z:\path\to\program.exe]
5>  Linker: Final Total time = 1.27344s < 1618429762951 - 1618432864884 > PB: 7331840 [Z:\path\to\program.exe]
{% endhighlight %}

While you'll get this info in a typical Release build:

{% highlight text %}
5>  Linker: (Z:\path\to\compiler\c2.dll)   LTCG Load Main.obj: Total time = 0.04933s PB: 35180544 [Z:\path\to\program.exe]
5>  [...]
5>  Linker: (Z:\path\to\compiler\c2.dll)   OptRef Total time = 0.00091s PB: 40161280 [Z:\path\to\program.exe]
5>  Generating code
5>  [...]
5>  Finished generating code
5>  Linker: (Z:\path\to\compiler\c2.dll)   LTCG CodeGen Total time = 2.58961s PB: 57692160 [Z:\path\to\program.exe]
5>  Linker: (Z:\path\to\compiler\c2.dll)   OptRef Total time = 0.00077s PB: 60547072 [Z:\path\to\program.exe]
5>  Linker: (Z:\path\to\compiler\c2.dll)   OptIcf Total time = 0.00857s PB: 60551168 [Z:\path\to\program.exe]
5>  Linker: (Z:\path\to\compiler\c2.dll) Pass 1: Interval #1, time = 3.56095s [Z:\path\to\program.exe]
5>  Linker: (Z:\path\to\compiler\c2.dll)   Wait PDB close Total time = 0.14563s PB: 59539456 [Z:\path\to\program.exe]
5>  Linker: (Z:\path\to\compiler\c2.dll) Pass 2: Interval #2, time = 0.23024s [Z:\path\to\program.exe]
5>  Linker: (Z:\path\to\compiler\c2.dll) Final Total time = 3.79130s < 1618638531573 - 1618647766698 > PB: 59539456 [Z:\path\to\program.exe]
{% endhighlight %}

Remember: by default Release configurations have [Link Time Code Generation](https://docs.microsoft.com/cpp/build/reference/ltcg-link-time-code-generation){:target="_blank"} turned on to optimize further!

You can also find [more info here](https://devblogs.microsoft.com/cppblog/vc-tip-get-detailed-build-throughput-diagnostics-using-msbuild-compiler-and-linker/){:target="_blank"}.

## /verbose

Although [this flag](https://docs.microsoft.com/cpp/build/reference/verbose-print-progress-messages){:target="_blank"} doesn't give you elapsed times, it's also very useful if you want to investigate why link times are slow. I haven't had much luck with it, but it's interesting to see the amount of data the linker processes.

## /d2cgsummary

This flag enables a cool behavior on the compiler's back-end (hence the `d2`) from Visual Studio 2015 onwards. I learned about this flag [thanks to Aras](https://aras-p.info/blog/2017/10/23/Best-unknown-MSVC-flag-d2cgsummary/){:target="_blank"}, and I invite you to check his blog post for the full explanation!

The key takeaway is that you get a summary of the code generation which includes anomalistic compile times and points you to the functions you should investigate!

Although the slow build times I have investigated weren't related to code generation, this flag is extremely useful!

## /d1reportTime

Again, I learned about this flag [thanks to Aras](https://aras-p.info/blog/2019/01/21/Another-cool-MSVC-flag-d1reportTime/){:target="_blank"}, so please check his post for all of the info. This one applies to the compiler's front-end (hence the `d1`).

The bad thing about this flag is the huge amount of data it gives... and the cool thing is the huge amount of data it gives! You get, separately, the time spent when including files (hierarchically!), the time spent declaring classes and the one on functions. It also has a summary on each section with the top sorted culprits so you can find useful date more easily.

If only we could visualize this data in a more graphical way...

![/d1reportTime as shown by Google Chrome's trace viewer]({{ '/' | absolute_url }}/assets/images/per-post/compilation-times-1/teaser-d1reporttime-flag.png)

This is a teaser of the next post in the series!

It's a pity this flag is only available on Visual Studio 2017 onwards, because at the time I started investigating build times we were bound to VS2015.

# External tools

Now that we know how to get high level and low level build times, we should check some other tools to complement this data or help us diagnose why they're happening.

So far we've been talking about C++ development, and that means talking about `#include` clauses. We've also mentioned MSVC compiler execution consists of two phases:

  * Front-end: reads code files, parses them, executes preprocessor directives (i.e. `#include` clauses) and applies semantic analysis.
  * Back-end: takes front-end's output and performs code generation.

When you have large files and a lot of dependencies via `#include`, you're bound to have long front-end execution times. When that's the case, it's useful to see these connections.

## doxygen

Yes, the one that helps you document your code. [doxygen](http://www.doxygen.nl/){:target="_blank"} comes with a handful of tools, and one of them is building `dot` graphs.

This example is extracted from [doxygen's docs](http://www.doxygen.nl/manual/examples/diagrams/html/diagrams__e_8h.html){:target="_blank"}, but trust me when I tell you it can handle huge dependency graphs:

![doxygen's include dependency graph](http://www.doxygen.nl/manual/examples/diagrams/html/diagrams__e_8h__incl.png){: .align-center}

The cool thing about these graphs is they're interactive when you use the `html` version (check previous link) and you can navigate at will. There's even an option to configure the maximum inclusion depth in a single graph, so it has you covered!

## Header Hero

A long while ago I found [this blog post](http://bitsquid.blogspot.com/2011/10/caring-by-sharing-header-hero.html){:target="_blank"} (which also gives very useful techniques to reduce your file dependencies!) and had a try. But it wasn't until I read [@aras_p](https://twitter.com/aras_p){:target="_blank"} in [this other blog post](https://aras-p.info/blog/2018/01/17/Header-Hero-Improvements/){:target="_blank"} that I put it to good use.

This tool has proven very useful, although it can take some trial and error to get the data you're looking for when your project is very complex. I highly recommend you check Aras' additions to the tool as well!

When you get it working, take one of the biggest contributors or hubs, click on it and start exploring which files include it. Should they? Can you refactor your code so they don't (i.e. forward declarations, remove nested classes or enums)?

## Visual Studio Code Map

Unfortunately this tool is only available in a Visual Studio Enterprise installation, so I haven't tested it myself (although it looks promising!).

From what I see in the [official documentation](https://docs.microsoft.com/visualstudio/modeling/map-dependencies-across-your-solutions){:target="_blank"} it produces complex graphs with several layers of data, but I guess some of that complexity may be configurable.

The great thing about finding this tool was learning there's a [graph format](https://docs.microsoft.com/visualstudio/modeling/directed-graph-markup-language-dgml-reference){:target="_blank"} you can use for your own tools, and Visual Studio will be the viewer! You may use it for `#include` clauses, asset dependencies or whatever fits in a directed graph!

## Other tools with dependency graphs

I also found some other Visual Studio extensions that give you inclusion dependency graphs like [Include Toolbox](https://marketplace.visualstudio.com/items?itemName=Wumpf.IncludeToolbox){:target="_blank"} (VS2017+) or [Visual Assist](https://www.wholetomato.com/){:target="_blank"} (has a trial version).

I'm sure there are a lot more!

## MSBuild Structured Log Viewer

More recently, [Kirill Osenkov](https://twitter.com/KirillOsenkov){:target="_blank"} pointed me to [MSBuild Structured Log Viewer](https://msbuildlog.com/){:target="_blank"}.

[![MSBuild Structured Log Viewer](https://msbuildlog.com/Screenshot1.png){: .align-center}](https://msbuildlog.com/)

MSBuild 15.3 onwards lets you dump the full log it produces into a binary file you can read with that viewer. This includes project-target-task hierarchies, clicking on a target to see its definition in code and a great search tool. You can even *replay a build* by feeding that same binary file to MSBuild in case you want to do something with it!

I encourage you to give it a try! This tool shares one of the principles with the one we'll talk about in the next post in the series, so it feels very familiar to me!

## C++ Build Insights

This one is even more recent, available from Visual Studio 2019 according to [Kevin's blog post](https://devblogs.microsoft.com/cppblog/introducing-c-build-insights/){:target="_blank"} on the official C++ developers blog.

![C++ Build Insights](https://devblogs.microsoft.com/cppblog/wp-content/uploads/sites/9/2019/11/word-image.gif)

To put it simply, the new versions of MSVC compiler and linker emit [ETW events](https://docs.microsoft.com/windows/win32/etw/event-tracing-portal){:target="_blank"} and they've added specially tailored panels to the [WPA](https://docs.microsoft.com/windows-hardware/test/wpt/windows-performance-analyzer){:target="_blank"} so you can explore them. This means you'll get exact timestamps, which is awesome when you want to investigate!

And even more, [Kevin shared this post](https://devblogs.microsoft.com/cppblog/analyze-your-builds-programmatically-with-the-c-build-insights-sdk/){:target="_blank"} not even a month ago with the release of an SDK to help you build your own tools on top of that info! This looks like the tool I was looking for, so thank you for the release!

At the time of writing, you need to register to the Windows Insider Program to get the latest version, but it's a quick process. Have a try and build great tools with it!

---

After a couple of years investigating these build times it's very possible I forgot about some tool or compiler flag, but this was more or less my process.

We've mentioned MSBuild several times. We talked about *targets* and *tasks*. Further investigation led me to building my own tool so we can get a flame graph out of MSBuild! Visualizing data in a graphical may be key! That will be the next post in the series.

Thank you for reading, hope some of these tools help you!
