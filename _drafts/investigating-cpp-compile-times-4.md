---
layout: single
title: "Getting data from C++ Build Insights SDK"
excerpt: "Let's investigate the SDK and find interesting data!"
author: Meta
category: Toolbox
tags:
  - C++
  - Visual Studio
  - Profiling
  - Flame graph
  - MSVC
  - C++ Build Insights
  - SDK
series: Investigating C++ compile times
---

Welcome back to the series!

In the previous posts we've explored ways to know how long a C++ build takes, how to create flame graphs out of MSBuild's execution and built some projects as examples.

Join me this time as we explore a brand new SDK that lets us take way better data than we had before!

Disclaimer: this post is based on the 1.0.0 version of the SDK. It's expected to evolve over time and some of this info can be stale!

# C++ Build Insights SDK

Last november [Kevin Cadieux](https://twitter.com/KevinCadieuxMS) shared a [post over at Microsoft's C++ Team Blog](https://devblogs.microsoft.com/cppblog/introducing-c-build-insights/){:target="_blank"} announcing a brand new tool called **vcperf** to get extensive data out of a C++ compilation.

Last march they went further:

  * They released the [C++ Build Insights SDK](https://devblogs.microsoft.com/cppblog/analyze-your-builds-programmatically-with-the-c-build-insights-sdk/){:target="_blank"} so we can use it ourselves.
  * They [open sourced vcperf](https://github.com/microsoft/vcperf){:target="_blank"}, which uses the SDK.

First of all let me thank you for this SDK and for providing us with extra tools to improve our build times, it's inmensely useful!

After I finished the initial release of my [MSBuildFlameGraph](https://github.com/MetanoKid/msbuild-flame-graph){:target="_blank"} tool, I set myself on a quest to explore C++ Build Insights.

## Getting started

The better way of getting started is checking the [official documentation](https://docs.microsoft.com/cpp/build-insights/reference/sdk/overview){:target="_blank"}.

There, you'll get info on how to collect a trace using vcperf or how the SDK is structured. Let's take a look at some of its points.

## Activities and events

Put simply, most of what the SDK reports are `Event`s. They have an id, a timestamp, a name and the *real* process/thread/processor they were emitted from. They can also have extra data depending on which event type they are.

When this event isn't instant but spans over time, it becomes an `Activity`: we now know the timestamp when it finished.

You can check the full list of activities and events at the [official docs](https://docs.microsoft.com/cpp/build-insights/reference/sdk/event-table){:target="_blank"}.

### Hierarchies

Because activities have a duration and take time to complete, there can be other activities and events that happen within them. This way, an `Activity` can have both `Activity` and `Event` children.

On the other hand, events are instant and they can't have any children.

After reading the event table and not being able to make a mental map myself, I decided to build a directed graph to visualize them.

These are the parent-child relationships for activities (top-level ones are yellow-bordered):

![C++ Build Insights SDK Activities]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/activities.png "Activities"){: .align-center}

These are the parent-child relationships for events (gray-shaded):

![C++ Build Insights SDK Activities and Events]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/activities-events.png "Activities and Events"){: .align-center}

With this in mind, let's start exploring some code!

## Exploring the SDK via code

When you want to analyze a build you'll usually perform these steps:

  * Execute `vcperf /start SomeTraceName`.
  * Build your project.
  * Execute `vcperf /stopnoanalyze SomeTraceName OutputFile.etl`.
  * Analyze `OutputFile.etl` with your tool (which uses the SDK).

Please note that, although you can record traces yourself with the SDK, I'll be using the open source version of vcperf for that.

This is the basic code:

{% highlight c++ %}
#include <CppBuildInsights.hpp>
// shorthand namespace version for convenience
namespace CppBI = Microsoft::Cpp::BuildInsights;

class SampleAnalyzer : public CppBI::IAnalyzer
{
  // [...]
};

int main(int argc, char** argv)
{
  SampleAnalyzer analyzer;
  auto group = CppBI::MakeStaticAnalyzerGroup(&analyzer);
  int analysisPasses = 1;

  CppBI::RESULT_CODE result = CppBI::Analyze("OutputFile.etl", analysisPasses, group);

  return result == CppBI::RESULT_CODE::RESULT_CODE_SUCCESS ? EXIT_SUCCESS
                                                           : EXIT_FAILURE;
}
{% endhighlight %}

That's all of the setup you need to do to get working! Now we need to know how to get useful data from the SDK.

### IAnalyzer

There are three main member functions you need to know from the `IAnalyzer`:

{% highlight c++ %}
CppBI::AnalysisControl OnStartActivity(const CppBI::EventStack&);
CppBI::AnalysisControl OnStopActivity(const CppBI::EventStack&);
CppBI::AnalysisControl OnSimpleEvent(const CppBI::EventStack&);
{% endhighlight %}

The idea here is they get called whenever an `Event` is read from the `.etl` file. Remember that an `Activity` was also an `Event`?

So what's that `EventStack`? We said there was a parent-child relationship between activities and events, and here's where we can see it.

Let's say we get `OnStopActivity` called. An example of the `EventStack` could be:

{% highlight text %}
-- top of stack --
Function
Thread
CodeGeneration
C2DLL
BackEndPass
Compiler
-- bottom of stack --
{% endhighlight %}

Or say we get `OnSimpleEvent` called:

{% highlight text %}
-- top of stack --
SymbolName
C1DLL
FrontEndPass
Compiler
-- bottom of stack --
{% endhighlight %}

Okay, so how do we retrieve different events within the stack?

### Matchers

Let's say we want to know all of the command line options within our trace. We explore the official docs and find there's a [`CommandLine`](https://docs.microsoft.com/cpp/build-insights/reference/sdk/cpp-event-data-types/command-line){:target="_blank"} event type. We'd add this method to our class:

{% highlight c++ %}
void OnCommandLineEvent(const CppBI::SimpleEvents::CommandLine& event)
{
  std::cout << event.Value() << std::endl;
}
{% endhighlight %}

The SDK has a very clever way of helping you get the events you want within a hierarchy:

{% highlight c++ %}
class SampleAnalyzer : public CppBI::IAnalyzer
{
public:
  CppBI::AnalysisControl OnSimpleEvent(const CppBI::EventStack& eventStack) override
  {
    CppBI::MatchEventStackInMemberFunction(eventStack,
                                           this,
                                           &SampleAnalyzer::OnCommandLineEvent);

    return CppBI::AnalysisControl::CONTINUE;
  }
};
{% endhighlight %}

That `MatchEventStackInMemberFunction` call there makes magic and filters those stacks which contain the event types in `OnCommandLineEvent` signature.

We now know all of the command line options within the trace, but they're all mixed up. Remember how `Compiler` and `Linker` activities were parents of `CommandLine` ones? Wouldn't it be awesome to tell them apart?

Let's create these two methods instead:

{% highlight c++ %}
void OnCompilerCommandLineEvent(const CppBI::Activities::Compiler& compiler,
                                const CppBI::SimpleEvents::CommandLine& event)
{
  std::cout << "Compiler: " << event.Value() << std::endl;
}

void OnLinkerCommandLineEvent(const CppBI::Activities::Linker& linker,
                              const CppBI::SimpleEvents::CommandLine& event)
{
  std::cout << "Linker: " << event.Value() << std::endl;
}
{% endhighlight %}

And now let's update our `OnSimpleEvent` method to use both:

{% highlight c++ %}
CppBI::AnalysisControl OnSimpleEvent(const CppBI::EventStack& eventStack) override
{
  CppBI::MatchEventStackInMemberFunction(eventStack,
                                         this,
                                         &SampleAnalyzer::OnCompilerCommandLineEvent);

  CppBI::MatchEventStackInMemberFunction(eventStack,
                                         this,
                                         &SampleAnalyzer::OnLinkerCommandLineEvent);

  return CppBI::AnalysisControl::CONTINUE;
}
{% endhighlight %}

Magically, `MatchEventStackInMemberFunction` will match those stacks that have a `Compiler` activity and then a `CommandLine` event apart from those with a `Linker` activity and then a `CommandLine` event!

You can get more info on matchers and examples on the [official docs](https://docs.microsoft.com/cpp/build-insights/reference/sdk/functions/match-event-stack-in-member-function){:target="_blank"}.

## Getting useful data with the SDK

Now we know how to deal with the SDK, let's try to get some data out of our build, shall we?

Because it's the compiler and linker the ones emitting the events, we can use it in projects we couldn't with [MSBuildFlameGraph](https://github.com/MetanoKid/msbuild-flame-graph){:target="_blank"}. I'm looking at you, Unreal Engine!

### Collecting a trace

Before we can start, we need a trace to work with! These were my steps:

  * Installed Visual Studio 15.9.22.
  * Cloned [vcperf from GitHub](https://github.com/microsoft/vcperf){:target="_blank"} and built it.
  * Downloaded Unreal Engine 4.24.3, launched it and created the default First Person Shooter project with C++.
  * Launched an elevated command prompt and navigated to the vcperf output directory.
  * Executed `vcperf /start UE4Project`.
  * In Visual Studio 2017, `Rebuild` `Development|Win64` our Unreal Engine solution.
  * Executed `vcperf /stopnoanalyze UE4Project UE4Project.etl`.

Now we've got an `UE4Project.etl` trace to analyze!

Oh, and the computer I ran it on is a 8-year-old i5 laptop with no SSD, so expect slow times here!

### Listing slowest files to compile

Before we get some code, we should go back to the directed graph we built before:

![C++ Build Insights SDK Activities]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/activities.png "Activities"){: .align-center}

See how both `FrontEndPass` and `BackEndPass` live within the `Compiler` activity? After a [quick check with the official docs](https://docs.microsoft.com/cpp/build-insights/reference/sdk/cpp-event-data-types/compiler-pass){:target="_blank"} we can see both classes inherit from `CompilerPass`. And that class has two interesting members:

  * `InputSourcePath`: path to the source file that gets compiled.
  * `OutputObjectPath`: path to the compiled output file.

Nice! So we've got all the info we need. Now let's write some code:

{% highlight c++ %}
class FileCompilationsAnalyzer : public CppBI::IAnalyzer
{
public:
  FileCompilationsAnalyzer() : CppBI::IAnalyzer(), m_fileCompilationsData() {}
  virtual ~FileCompilationsAnalyzer() {}

  CppBI::AnalysisControl OnStopActivity(const CppBI::EventStack& eventStack) override
  {
    // called from the SDK
    bool processed = CppBI::MatchEventStackInMemberFunction(eventStack,
                       this,
                       &FileCompilationsAnalyzer::OnFrontEndPassCompleted) ||
                     CppBI::MatchEventStackInMemberFunction(eventStack,
                       this,
                       &FileCompilationsAnalyzer::OnBackEndPassCompleted);
    return CppBI::AnalysisControl::CONTINUE;
  }

private:
  struct FileCompilationData
  {
    std::chrono::nanoseconds frontEndDuration;
    std::chrono::nanoseconds backEndDuration;
  };
  std::unordered_map<std::wstring, FileCompilationData> m_fileCompilationsData;

  void OnFrontEndPassCompleted(const CppBI::Activities::FrontEndPass& frontEndPass)
  {
    auto result = m_fileCompilationsData.try_emplace(frontEndPass.InputSourcePath(),
                                                     FileCompilationData());
    result.first->second.frontEndDuration = frontEndPass.Duration();
  }

  void OnBackEndPassCompleted(const CppBI::Activities::BackEndPass& backEndPass)
  {
    auto result = m_fileCompilationsData.try_emplace(backEndPass.InputSourcePath(),
                                                     FileCompilationData());
    result.first->second.backEndDuration = backEndPass.Duration();
  }
};
{% endhighlight %}

And that's all we need! We can now run our code, sort the data we've collected and dump it:

{% highlight text %}
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectCharacter.cpp
  Total time: 82.724s (front-end: 81.086s, back-end: 1.638s)
path\DefaultFPSCppProjectEditor\Development\Engine\SharedPCH.Engine.ShadowErrors.h
  Total time: 81.302s (front-end: 74.104s, back-end: 7.198s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectGameMode.cpp
  Total time: 75.965s (front-end: 74.640s, back-end: 1.325s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectProjectile.cpp
  Total time: 75.914s (front-end: 74.615s, back-end: 1.300s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectHUD.cpp
  Total time: 75.535s (front-end: 74.570s, back-end: 0.964s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectCharacter.gen.cpp
  Total time: 3.071s  (front-end: 2.131s,  back-end: 0.940s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectGameMode.gen.cpp
  Total time: 3.024s  (front-end: 1.875s,  back-end: 1.149s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectHUD.gen.cpp
  Total time: 2.671s  (front-end: 2.030s,  back-end: 0.641s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProjectProjectile.gen.cpp
  Total time: 2.358s  (front-end: 1.654s,  back-end: 0.704s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProject.init.gen.cpp
  Total time: 2.253s  (front-end: 1.424s,  back-end: 0.829s)
path\UE4Editor\Development\DefaultFPSCppProject\DefaultFPSCppProject.cpp
  Total time: 1.212s  (front-end: 0.824s,  back-end: 0.388s)
{% endhighlight %}

That's it, now we know which files take longer to compile!

Important note: it looks like projects compiled with Visual Studio 15.9.22 (VS2017) report their `InputSourcePath` as null while they've got the correct `OutputObjectPath`. This seems to work without a problem if you compile your project with Visual Studio 16.5.2 (VS2019). For the sake of this section I had ommited this issue.

### Listing slowest files to include

This time we have to check the SDK for included files. Remember: file inclusion gets performed by the front-end. After a bit of searching we come up with [`FrontEndFile`](https://docs.microsoft.com/cpp/build-insights/reference/sdk/cpp-event-data-types/front-end-file){:target="_blank"}.

This event is recursive, as a file can include some file that in turn includes some other file. But, we only want to know those files that get included _from other file_. That means we want to capture a stack with two `FrontEndFile` events!

Let's see some code:

{% highlight c++ %}
class FileInclusionsAnalyzer : public CppBI::IAnalyzer
{
public:
  FileInclusionsAnalyzer() : CppBI::IAnalyzer(), m_fileInclusionTimes() {}
  virtual ~FileInclusionsAnalyzer() {}

  CppBI::AnalysisControl OnStopActivity(const CppBI::EventStack& eventStack) override
  {
    CppBI::MatchEventStackInMemberFunction(eventStack, this, &FileInclusionsAnalyzer::OnFileParsed);
    return CppBI::AnalysisControl::CONTINUE;
  }

private:
  typedef std::vector<std::chrono::nanoseconds> TTimeElapsedPerOccurrence;
  typedef std::unordered_map<std::string, TTimeElapsedPerOccurrence> TTimeElapsedPerInclusion;
  TTimeElapsedPerInclusion m_fileInclusionTimes;

  void OnFileParsed(const CppBI::Activities::FrontEndFile& fromFile,
                    const CppBI::Activities::FrontEndFile& includedFile)
  {
    auto result = m_fileInclusionTimes.try_emplace(includedFile.Path(), TTimeElapsedPerOccurrence());
    result.first->second.push_back(includedFile.Duration());
  }
};
{% endhighlight %}

And that's it! Now we have a list of the times to include each file (one file can be included from several files!).

Why don't we sort all inclusions by total inclusion time and dump the first 10?

{% highlight text %}
project\path\source\defaultfpscppproject\defaultfpscppprojectcharacter.h
  Total inclusion time: 49.854s (included 3 times)
ue_4.24\engine\source\runtime\engine\classes\gameframework\character.h
  Total inclusion time: 48.960s (included 3 times)
project\path\source\defaultfpscppproject\defaultfpscppprojectgamemode.h
  Total inclusion time: 43.096s (included 2 times)
ue_4.24\engine\source\runtime\engine\classes\gameframework\gamemodebase.h
  Total inclusion time: 42.405s (included 2 times)
ue_4.24\engine\source\runtime\engine\classes\gameframework\rootmotionsource.h
  Total inclusion time: 40.776s (included 3 times)
project\path\intermediate\[...]\engine\sharedpch.engine.shadowerrors.h
  Total inclusion time: 40.732s (included 1 times)
ue_4.24\engine\source\runtime\engine\public\enginesharedpch.h
  Total inclusion time: 40.729s (included 1 times)
project\path\source\defaultfpscppproject\defaultfpscppprojecthud.h
  Total inclusion time: 39.853s (included 3 times)
ue_4.24\engine\source\runtime\engine\classes\gameframework\hud.h
  Total inclusion time: 39.142s (included 3 times)
ue_4.24\engine\source\runtime\engine\classes\engine\serverstatreplicator.h
  Total inclusion time: 28.980s (included 2 times)
[...]
{% endhighlight %}

Easy!

### Generate a directed graph for file inclusions

With the previous analyzer we can have inclusion relationships between files, can't we? This time I won't add any code, but a couple of screenshots of the inclusion graph:

![Default Unreal Engine 4 FPS project inclusion graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/ue4project-inclusion-graph.png "Default Unreal Engine 4 FPS project inclusion graph"){: .align-center}

Yeah, no joke. That's what I can see in a laptop resolution without zooming in! Let's zoom into something, shall we?

![Default Unreal Engine 4 FPS project inclusion graph, only slowest file to include and related]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/ue4project-inclusion-graph-slowest-file-to-include.png "Default Unreal Engine 4 FPS project inclusion graph, only slowest file to include and related"){: .align-center}

This is the sub-graph with the slowest file to compile, with both files that include it and files it includes. To cut the graph down I installed Visual Studio's DgmlPowerTools extension, selected `DefaultFPSCppProjectCharacter.h` node and clicked the `Butterfly` option.

## Generate a flame graph

There are other useful metrics to get, like how long do functions take to compile (careful, SDK reports their names mangled!), how many files get included on each `.h` file or whether files compile in parallel at all.

Before we do that, we have to go back to vcperf. When it analyzes a trace, it generates extra data to view within Windows Performance Analyzer (WPA). However, although it gives very useful insights, I find myself being slow while exploring the timelines. Please refer to [vcperf on GitHub](https://github.com/microsoft/vcperf){:target="_blank"} to get a glimpse of how it looks.

Over a year ago, [@aras_p](https://twitter.com/aras_p) wrote this [blog post](https://aras-p.info/blog/2019/01/16/time-trace-timeline-flame-chart-profiler-for-Clang/) on how to get a flame graph out of Clang's compilations. That's what led me to building [MSBuildFlameGraph](https://github.com/MetanoKid/msbuild-flame-graph){:target="_blank"} in the first place. So, why don't we try to get this kind of trace from the SDK data?

We'd have to create a new analyzer to feed into the SDK that records all hierarchies and sets useful names for each entry in the graph (each entry) will represent an activity). This means taking file paths from `FrontEndFile`, function names from `Function` and the like.

Let's take a look!

![Default Unreal Engine 4 FPS project flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/ue4project-flame-graph-raw-process-thread.png "Default Unreal Engine 4 FPS project flame graph"){: .align-center}

Well, not specially readable, isn't it? To the left of the image we can see `ProcessId` and `ThreadId` as reported by the SDK. We could even list the `ProcessIndex` somewhere if we wanted to. It's a pity we have to scroll back and forth, trying to know which entry matches which parent. What's compiling in parallel?

But, can we do any better?

### Packing parent-children together

Let's try to keep child entries as close as possible to their parents, being careful to leave the necessary space to fit those children when we have entries running in parallel.

With a bit of work, we get this version:

![Default Unreal Engine 4 FPS project flame graph, with recalculated ProcessId and ThreadId]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/ue4project-flame-graph-recalculated-process-thread.png "Default Unreal Engine 4 FPS project flame graph, with recalculated ProcessId and ThreadId"){: .align-center}

As you can see, `ProcessId` and `ThreadId` aren't _real_ anymore. However, they approach to a more logical distribution of what's running where! Definitely easier to read for me!

Let's zoom into `DefaultFPSCppProjectGameMode.gen.cpp`:

![Default Unreal Engine 4 FPS project game mode's flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/ue4project-flame-graph-game-mode.png "Default Unreal Engine 4 FPS project game mode's flame graph"){: .align-center}

What can we see here (if it wasn't a static image)? As part of the `C1DLL` activity we see this `.cpp` file includes three other files while the `CodeGeneration` activity includes all of the functions that get generated (they get generated in parallel, up to 4 because my computer has 4 logical cores).

But we can see something else: the `Compiler` activity _only_ spans the `FrontEndPass` and `BackEndPass` of this file. And, if we go back to the full trace, all `Compiler` activities only deal with one file. Does this mean we aren't compiling in parallel?

### Showing template instantiations

The last cool thing we'll see requires using the [open source version of vcperf](https://github.com/microsoft/vcperf){:target="_blank"} as well as compiling with Visual Studio 16.4 (VS2019).

This time, we'll use [@BruceDawson0xB](https://twitter.com/BruceDawson0xB){:target="_blank"}'s project from [this blog post](https://randomascii.wordpress.com/2014/03/22/make-vc-compiles-fast-through-parallel-compilation/){:target="_blank"}, but updated to VS2019. Let's take a look:

![Template instantiations]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/template-instantiations.png "Template instantiations"){: .align-center}

Bruce wanted to make compilations slow and calculated Fibonacci in templates (with some tricks to prevent reusing instantiations). This is the result of instantiating all of the templates!

Of course, these template instantiations can be seen in other projects! This time we'll build the tool I've used for this post in `Release|x64` and zoom into `Main.cpp`:

![CppBuildAnalyzer's Main.cpp with template instantiations]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/cpp-build-analyzer-template-instantiations.png "CppBuildAnalyzer's Main.cpp with template instantiations"){: .align-center}

See that huge amount of small entries? Those are template instantiations! And they can be part of any file, so when you include some file you also get which templates get instantiated.

However, have you noticed the small `BackEndPass` to the right? It's got no children, hasn't it? That's because we've built a `Release` version which has `LTCG` enabled! Let's take a look at the `Linker` activity:

![Link Time Code Generation]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-4/ltcg.png "Link Time Code Generation"){: .align-center}

There's where the `Function` activities get compiled! Looks like VS2019 also adds `Thread` activities between `CodeGeneration` and `Function` activities!

---

This exploration of the C++ Build Insights SDK helped me take more informed decisions when investigating C++ compile times and I'm sure I'll be using it in the future.

Big THANK YOU to the team that made it possible, and [@KevinCadieuxMS](https://twitter.com/KevinCadieuxMS) in particular!

I'm working on releasing the tool I used to write this post, so [stay tuned here](https://twitter.com/MetanoKid){:target="_blank"}.
