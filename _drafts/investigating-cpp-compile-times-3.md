---
layout: single
title: "Improving C++ compile times using flame graphs"
excerpt: "Now we can create flame graphs from MSBuild executions, let's put them to use!"
author: Meta
category: Toolbox
tags:
  - C++
  - CSharp
  - Visual Studio
  - MSBuild
  - Profiling
  - Flame graph
series: Investigating C++ compile times
---

Within this series we've explored some ways to find how long a build is taking and how to create flame graphs out MSBuild's execution.

This time we'll check several examples and try make more informed decisions to improve our build times.

There will be a lot of examples, so it will be an image-heavy post!

# Understanding MSBuild flame graphs

This graph shows a sample build of my (unreleased) GameBoy emulator side project. It's a Visual Studio 2015 solution that mixes C++, C++/CLI and C# code:

![GameBoy emulator flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/gameboy-emulator-flame-graph.png "GameBoy emulator's flame graph"){: .align-center}

In this graph we've got:

  * Several `pid`: these are the `NodeId` values as reported by MSBuild. Because `NodeId` starts at 1, we've used index 0 to tag the build itself. They don't represent processors, cores or threads (we'll see an example later).
  * Several `MSBuild timeline`: they represent different execution hierarchies. Very important notice: they are **absolutely made up**. When MSBuild reports entries (`Project`, `Target` or `Task`) living in the same `NodeId` but they don't share the same hierarchy, I decided to separate them into different timelines. We explained why this happens in the previous post.

It's a bit hard to explore hierarchies with screenshots, but let's edit the image above to help us understand what's going on:

![GameBoy emulator flame graph: top-level projects]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-flame-graph-top-projects.png "GameBoy emulator's flame graph: top-level projects"){: .align-center}

These are the two top-level projects within the solution. In this case, both create an executable (one for the emulator itself, one for the test suite).

Did you notice they're `.metaproj` projects? That means they're created implicitly from the `.sln` file because they have dependencies (more info in the previous post). See how both of them have two `MSBuild` tasks? The leftmost task builds its dependencies while the rightmost build the project itself.

In the image, the uppermost group labeled `1` is the `MainWindows.vcxproj.metaproj`. Its dependencies get built within the same timeline and then builds `MainWindows.vcxproj` down at `NodeId 2`. This was kind of surprising for me at first (*why not build it within the same timeline, similar to dependencies?*) but that's how MSBuild reports it.

Meanwhile, `Test.vcxproj.metaproj` is building in the same `NodeId` but in a different timeline: they build in parallel because they don't depend on each other. It also waits for its dependencies (in this case, both projects share the same ones), then builds `Test.vcxproj` within the same timeline.

And what about these dependencies? Let's zoom in a bit into `MainWindows.vcxproj.metaproj` and annotate the graph:

![GameBoy emulator flame graph: dependencies]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-flame-graph-dependencies.png "GameBoy emulator's flame graph: dependencies"){: .align-center}

  * Group `1` is `MainWindows.vcxproj.metaproj`. It starts in `NodeId 1, timeline 0` and features two `MSBuild` tasks. The rightmost one builds `MainWindows.vcxproj` in `NodeId 2, timeline 0` (MSBuild scheduled `Test.vcxproj.metaproj` to `NodeId 1`, so this one moved to a separate one).
  * Group `2` is `GameBoy.vcxproj.metaproj`. Everything it does lives in `NodeId 1, timeline 0`.
  * Group `3` is `LogLibrary.vcxproj.metaproj` and, surprisingly, starts in `NodeId 1, timeline 0`, but does all of its work in `NodeId 2, timeline 0`. No idea why this jump, that's how MSBuild schedules them.
  * Group `4` is `LogWindowBridge.vcxproj`. Although it has a dependency, there's no `.vcxproj.metaproj` this time. I guess it's because it depends on a C# project? It does all of its work at `NodeId 2, timeline 0`, but I've painted the group bigger to fit the next dependency.
  * Group `5` is the last dependency: `LogWindowUI.csproj`. It gets built in `NodeId 1, timeline 1` (MSBuild reports it shares `NodeId 1` with other entries but they aren't part of the same hierarchy, that's why it lives in `timeline 1`).

I really hope it made things a bit more clear.

We can ask MSBuild to *limit parallel projects to 1* and thus flatten them:

![GameBoy emulator flame graph, one parallel project]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/gameboy-emulator-one-parallel-project-flame-graph.png "GameBoy emulator's flame graph, one parallel project"){: .align-center}

Leftmost entries are the ones that build first while depth represents dependencies.

# Adding more info via MSVC flags

In the previous post we explored some MSVC flags that added extra timing information to our build, so we should try using them!

## /Bt+

This flag produces this kind of output:

{% highlight text %}
1>  File.cpp
1>  time(Z:\path\to\compiler\c1xx.dll)=0.39427s < 1617765075910 - 1617766036302 > BB [Z:\path\to\File.cpp]
1>  time(Z:\path\to\compiler\c2.dll)=0.06475s < 1617766053824 - 1617766211553 > BB [Z:\path\to\File.cpp]
{% endhighlight %}

These messages represent three parts of a file compilation: the start, the end of the compiler's front-end and the end of the compiler's back-end. With this, we can create our own entries in the graph and represent it!

![Using /Bt+ MSVC flag]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-flame-graph-btplus-no-mp.png "Using /Bt+ MSVC flag"){: .align-center}

Because these entries are **absolutely made up**, I've labeled its timeline as `Post-processed timeline` to separate them from the raw MSBuild data.

`/Bt+` output, for this graph, looks like this:

{% highlight text %}
File1.cpp
time(c1xx.dll) [...] [File1.cpp]
File2.cpp
time(c1xx.dll) [...] [File2.cpp]
[...]
time(c2.dll) [...] [File2.cpp]
time(c2.dll) [...] [File1.cpp]
{% endhighlight %}

This means it's executing the front-end for each file and then the back-end! That means we're not compiling files in parallel! What a mess!

Turns out, this is the default behavior when you create a new project in Visual Studio 2015. Let's fix it by adding the `/MP` flag:

![Enabling /MP]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/mp-flag.png "Enabling /MP"){: .align-center}

We also have to turn off `/Gm` because it's incompatible with `/MP`:

![Disabling /Gm]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gm-minus-flag.png "Disabling /Gm"){: .align-center}

Let's now rebuild the solution and check again!

![Using /Bt+ and /MP MSVC flags]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-flame-graph-btplus-with-mp.png "Using /Bt+ and /MP MSVC flags"){: .align-center}

That's better! Now we can see how there's as many `Post-processed timeline` as logical cores. This is the default maximum, it can be tweaked as well.

Again, because these timelines are made up, it's not set in stone which file gets compiled in which core. All we have are MSBuild messages saying their compilation started, front-end execution finished and back-end execution finished. With that, we've filled the gaps in the logical cores.

Here we hit one big issue: every message within the same `Task` (`CL` task in this case) share the same `BuildEventContext` and other data we could use to relate each other. Because of that, we have to do some extra work to get complete data. We'll come back to this issue later on, with `/d1reportTime`.

Let's use another project now! This is what `/Bt+` has to say when we build the solution from [this blog post](https://randomascii.wordpress.com/2014/03/22/make-vc-compiles-fast-through-parallel-compilation/){:target="_blank"}:

![Random ASCII's trace with /Bt+]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/random-ascii-bt-plus.png "Random ASCII's trace with /Bt+"){: .align-center}

First of all: no project has dependencies. That's why we don't find any `.vcxproj.metaproj` entries. Thanks to this, and because we've built the full solution, each project lies into its own `NodeId`. Let's explore each one:

  * `CompileNonParallel.vcxproj`: it's doesn't have `/MP` enabled (we only see one `Post-processed timeline`) and it defines groups of files with different compiler flags (it has several `CL` tasks).
  * `CompileMoreParallel.vcxproj`: it has `/MP` enabled but still defines groups of files with different compiler flags. That's why we see parallel compilations in the `CL` tasks with more than one file, but still a lot of `CL` tasks.
  * `CompileMostParallel.vcxproj`: all files share the same compiler flags except the pre-compiled header, that's why we see two `CL` tasks.

But, what does this *different compiler flags* have to do with several `CL` tasks? That's because MSBuild creates batches of files that can be compiled with the same flags and then spawn as many `CL` tasks to execute the compiler. When they're done, a new batch begins.

In the case of pre-compiled headers, you must compile one file with the `/Yc` flag to create the PCH while other files must compile with the `/Yu` flag to use that file. Because they've got different flags, MSBuild creates two batches.

### Bonus: files with the same name

Let's suppose you've got a project with a number of files spread in folders. And let's say two of the files you've got use the same name: `File.cpp`. When you compile the project you get this warning:

Two or more files with the name of `File.cpp` will produce outputs to the same location. This can lead to an incorrect build result. The files involved are `src\Folder1\File.cpp`, `src\Folder2\File.cpp`.
{: .notice--primary}

This is because the default project configuration creates all intermediate `.obj` files in the same folder. When it compiles the second `File.cpp` file, its `.obj` file deletes the former one. If you queried Google and checked [the first answer in Stack Overflow](https://stackoverflow.com/a/3731577/1257656){:target="_blank"}, you'd modify the project with this property:

{% highlight xml %}
<ObjectFileName>$(IntDir)/%(RelativeDir)/</ObjectFileName>
{% endhighlight %}

And this is its trace:

![Setting %(RelativeDir) to ObjectFileName]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/object-file-name-relative-dir.png "Setting %(RelativeDir) to ObjectFileName"){: .align-center}

Yes, it built without issues, but now we will have as many batches as folders in our project! This is **the wrong approach**!

Alright, that was a synthetic test! But now imagine you have a processor with 8 or 16 logical cores and the same kind of project. If you've got only a handful of files per folder (you've been a good programmer and separated behaviors in folders) you'd be wasting most of those cores because batches won't have as many files as logical cores! You're destroying parallelism!

You better fix your physical structure instead of doing this, or your build times will suffer. I once decreased the rebuild time of a project by almost 2 minutes (!) with just this change. It can get serious.

## /time+

Let's move onto a linker flag we talked about in the previous post:

![GameBoy emulator flame graph: /time+ Debug]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-flame-graph-time-plus-debug.png "GameBoy emulator flame graph: /time+ Debug"){: .align-center}

That's a `Debug|x64` compilation. Not many info, really. What about a `Release|x64` compilation?

![GameBoy emulator flame graph: /time+ Release]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-flame-graph-time-plus-release.png "GameBoy emulator flame graph: /time+ Release"){: .align-center}

By default, Release configurations enable `/LTCG` (Link Time Code Generation). It first loads all of the `.obj` files (the small entries to the left of `Pass 1`) and then generates more optimized code (`LTCG CodeGen` entry).

## /d1reportTime

This is the last flag we'll be adding to get extra data (check previous post for more info). And it comes with two issues:

  * It's only available from Visual Studio 2017 version of MSVC: this means we need to upgrade the GameBoy emulator project we've been using to make it work.
  * It outputs a huge amount of `Message` tasks for each file and we can't relate messages to each other (i.e. their `BuildEventContext` and other identifiable data match). Because files are getting compiled in parallel we'll get mixed `Message` tasks! We need to break parallelism to be able to build a hierarchy ourselves.

So let's first upgrade our project and then ensure we **only compile one file at a time**. This isn't alien either, that's what the `/showIncludes` MSVC flag does (although it doesn't mention it in [the official docs](https://docs.microsoft.com/cpp/build/reference/showincludes-list-include-files){:target="_blank"}).

Let's take an example now!

![GameBoy emulator flame graph: /d1reportTime]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-d1reportTime.png "GameBoy emulator flame graph: /d1reportTime"){: .align-center}

This is one of my test files: `LoadAIntoAddressHL.cpp`. As reported by `/d1reportTime`, the front-end executes three sections: `Include Headers`, `Class Definitions` and `Function Definitions`. Again, all these entries are made up and that's why they are in a `Post-processed timeline`.

### Bonus: /Bt+ and /d1reportTime timing flaw

Let's take the combined output for `/Bt+` and `/d1reportTime` for this file and remove *a lot* of the messages, let's just keep the timing ones:

{% highlight text %}
[...]
LoadAIntoAddressHL.cpp
Include Headers:
  [...]
  Total: 0.591067s
Class Definitions:
  [...]
  Total: 0.178967s
Function Definitions:
  [...]
  Total: 0.511502s
time(Z:\path\to\compiler\c1xx.dll)=1.17362s < 2283035638380 - 2283038497179 > [Z:\path\to\LoadAIntoAddressHL.cpp]
{% endhighlight %}

Let's sum `/d1reportTime` sections: `0.591067s + 0.178967s + 0.511502s = ‭1.281536‬s`. However, `/Bt+` reports the front-end took `1.17362s`! Disaster!

If we were to use these times in the graph as they're reported, the `Function Definitions` entry would overflow `c1xx.dll`. To fix it I decided to scale down each child of `c1xx.dll` proportionally so all of them fit. This was a compromise, though: their times aren't real anymore, but still give you an idea of their relative impact.

# Impact of a pre-compiled header

With `/d1reportTime` data at hand, let's add this PCH to the project and check how it changes:

{% highlight c++ %}
#pragma once

#include <vector>
#include <string>
#include <iomanip>
#include <sstream>
{% endhighlight %}

![GameBoy emulator flame graph: /d1reportTime with PCH]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/gameboy-emulator-d1reportTime-PCH.png "GameBoy emulator flame graph: /d1reportTime with PCH"){: .align-center}

First of all, we can see the `Include Headers` section features a smaller number of files and hierarchies: the biggest ones we had came from the STL! `Class Definitions` is also reduced: we can even read some entries at the same zoom level! And what about `Function Definitions`? It's got far less entries now!

No wonder why the time spent on this file went down from `1.174s` to `0.161s`! Why don't we compare how the `Test.vcxproj` project build time changed with the PCH?

This one is before having a PCH:

![Test.vcxproj without PCH with /d1reportTime]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/test-project-d1reporttime-pre-pch.png "Test.vcxproj without PCH with /d1reportTime"){: .align-center}

Let's add the PCH:

![Test.vcxproj with PCH with /d1reportTime]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/test-project-d1reporttime-post-pch.png "Test.vcxproj with PCH with /d1reportTime"){: .align-center}

See how the PCH has cut a lot of depth on each file? Also, the full project went down from `2m17s` to `49s`, and that's with `/MP` turned off! What if we turned it on?

This one is before having a PCH:

![Test.vcxproj without PCH]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/test-project-pre-pch.png "Test.vcxproj without PCH"){: .align-center}

Let's add the PCH:

![Test.vcxproj with PCH]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/test-project-post-pch.png "Test.vcxproj with PCH"){: .align-center}

It's gone from `1m08s` to `27s`! Also, have you noticed how each `c1xx.dll` entry has shrunk?

To sum up: we can check build times thanks to these flame graphs but also visualize the impact of our changes!

# Extra examples

To finish this post I've built a couple of projects from GitHub to see how their flame graphs look like. Let's check them!

## RapidJSON

This is the flame graph for [RapidJSON](https://github.com/Tencent/rapidjson){:target="_blank"} when building the whole solution in `Debug|x64` with `/Bt+` and `/time+` enabled. Be warned, it's huge:

![RapidJSON flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/example-rapidjson.png "RapidJSON flame graph"){: .align-center}

With the info from this post, can you tell whether `/MP` is enabled for this build?

For reference, this is what [Paralel Builds Monitor](https://marketplace.visualstudio.com/items?itemName=ivson4.ParallelBuildsMonitor-18691){:target="_blank"} has to say of the build:

![RapidJSON build as seen by Parallel Builds Monitor]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/example-rapidjson-parallel-builds-monitor.png "RapidJSON build as seen by Parallel Builds Monitor"){: .align-center}

See how the maximum number of projects building in parallel is 4? That's the number of logical cores in the machine I used to build it.

## Google Test

This one is for [Google Test](https://github.com/google/googletest){:target="_blank"}, `Debug|x64`. While RapidJSON built 28 projects, this one builds 80. We'll have to see it as a downscaled gif:

![Google Test flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-3/google-test-flame-graph.gif "Google Test flame graph"){: .align-center}

---

Redact some final.
