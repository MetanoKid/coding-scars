---
layout: single
title: "Understanding MSBuild to build flame graphs"
excerpt: "Let's explore how MSBuild works and how we can visualize its process"
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

I love side projects. You have a problem you want to solve, think about how you'd do it and then start working on a solution that *mostly works*. Now you've calmed the itch that started it all, it becomes a *product* and you start losing interest on it. A new side projects pops in, the cycle repeats.

But this time I managed to finish one!

Over a year ago I started a side project to create a flame graph out of a MSBuild execution. This was inspired by [@aras_p](https://twitter.com/aras_p)'s [blog post](https://aras-p.info/blog/2019/01/16/time-trace-timeline-flame-chart-profiler-for-Clang/){:target="_blank"}. Thanks again for everything you've written in your blog!

This post serves as a summary of what I learned while developing this tool. I thought it would be a shorter post but then got out of control! We'll have an extra post fiddling with compiler flags and project configurations to show a lot of examples!

![MSBuild to flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/msbuild-flame-graph.png "MSBuild flame graph"){: .align-center}

Some of the examples in this post will feature my (unreleased) GameBoy emulator (yeah, one of those abandoned side projects) to illustrate some points. This way, we can see some real data and not just synthetic tests.

# The background

When I started looking for ways to investigate build times I ended up with some useful MSVC flags and some Visual Studio options (check previous post in the series for more).

It basically looked like I could compile a solution, parse its output and start working from there. And it didn't seem very crazy, people build tools around that! Just open Visual Studio's Developer Command Prompt and type:

{% highlight text %}
devenv.com Z:\path\to\solution.sln /Rebuild
{% endhighlight %}

I've used `devenv.com` instead of `devenv.exe` because it writes to console.

We'll get something like:

{% highlight text %}
3>  [...]
4>------ Rebuild All started: Project: GameBoy, Configuration: Debug x64 ------
4>  Cartridge.cpp
4>  [...]
========== Rebuild All: 6 succeeded, 0 failed, 0 skipped ==========
{% endhighlight %}

This is basically like building the solution in Visual Studio and copying the `Output` panel. However, that's it. I guess this isn't enough for us.

In the previous post I mentioned Visual Studio Extensions use a SDK that lets you hook to MSBuild events and perform your own logic. So, Visual Studio is using MSBuild under the hood, isn't it?

Let's try to build our solution with MSBuild directly (again, within Visual Studio's Developer Command Prompt):

{% highlight text %}
msbuild.exe Z:\path\to\solution.sln /t:Rebuild
{% endhighlight %}

This will rebuild our solution and dump a lot of information to console. It looks very much like setting *MSBuild project build output verbosity* to `Normal` or `Detailed` in Visual Studio's Options window!

We're getting closer, and [MSBuild official documentation](https://docs.microsoft.com/visualstudio/msbuild/msbuild){:target="_blank"} has a lot more information, like [using MSBuild programmatically](https://docs.microsoft.com/visualstudio/msbuild/msbuild-api){:target="_blank"}.

# The goal

Now that we know we can invoke MSBuild ourselves, parsing its output would be complex and still not give us enough data. Since there's some kind of API to deal with it programmatically, let's explore what it can offer!

# C# basic API

At first, when I started building this tool I was amazed at how little information I could find on how to call MSBuild from C# code. All I found were incomplete or unrelated issues on the MSDN forums and a couple of samples over at GitHub.

I spent a lot of time trying to make it work, failing, trying again, mostly working but only for C++ solutions and not C# ones...

In the end, invoking MSBuild just takes these lines:

{% highlight c# %}
Dictionary<string, string> globalProperties = new Dictionary<string, string>
{
  { "Configuration", "Debug" },
  { "Platform", "x64" },
};

BuildRequestData data = new BuildRequestData("Z:\\path\\to\\solution.sln",
                                             globalProperties,
                                             null,
                                             new[] { "Rebuild" },
                                             null);

BuildParameters parameters = new BuildParameters();
BuildResult result = BuildManager.DefaultBuildManager.Build(parameters, data);
switch(result.OverallResult)
{
  case BuildResultCode.Success:
    // yay!
    break;
  case BuildResultCode.Failure:
    // d'oh!
    break;
}
{% endhighlight %}

Simple, right? Well... *no*.

For it to work you need these `BuildRequestData`, `BuildParameters` and `BuildManager` classes. And this is where the pain started for me.

## Reference MSBuild assemblies

By the time I started working on this tool I was using Visual Studio 2015 and I didn't know where to find any of these assemblies. I only knew they were part of `Microsoft.Build` packages. So I tried adding a Reference to them via `Framework`:

![MSBuild assemblies via Framework]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/msbuild-assemblies-framework.png "Assemblies via Framework"){: .align-center}

Note it says version `4.0.0.0`, I didn't even know which version I needed! This happened like a year ago so I may have forgotten, but I think it worked for a while until I tried to compile a different kind of project. Anyways, I ended up referencing assemblies via the Extensions page:

![MSBuild assemblies via Extensions]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/msbuild-assemblies-extensions.png "Assemblies via Extensions"){: .align-center}

Note it says version `14.0.0.0`. Still, no idea why they're different, but this one worked correctly (and then I knew I was using MSBuild 14).

### Bonus: binding redirects

When I thought everything was set, I tried to build my first project and... it failed.

{% highlight text %}
The "Message" task could not be loaded from the assembly Microsoft.Build.Tasks.Core, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a. [...]
{% endhighlight %}

This cryptic message hit me like a stone. *Why can't it find it? It compiled and I'm executing the tool now!*

Oh, well, turns out you have to apply binding redirects to make it build Visual Studio 2015 solutions. More info on the [official docs](https://docs.microsoft.com/dotnet/framework/configure-apps/redirect-assembly-versions){:target="_blank"}. I'm a C++ programmer and wasn't aware of this requirement, I guess .NET programmers are used to it!

I ended up adding this kind of entries to my `App.config` file:

{% highlight xml %}
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <!-- [...] -->
  <runtime>
    <assemblyBinding xmlns="urn:schemas-microsoft-com:asm.v1">
      <dependentAssembly>
        <assemblyIdentity name="Microsoft.Build" culture="neutral" publicKeyToken="b03f5f7f11d50a3a" />
        <bindingRedirect oldVersion="0.0.0.0-99.9.9.9" newVersion="14.0.0.0"/>
      </dependentAssembly>
      <!-- more bindings for Microsoft.Build.Framework and other assemblies! -->
    </assemblyBinding>
  </runtime>
</configuration>
{% endhighlight %}

[![I have no idea what I'm doing](https://i.kym-cdn.com/photos/images/newsfeed/000/234/765/b7e.jpg "I have no idea what I'm doing"){: .align-center}](https://knowyourmeme.com/memes/i-have-no-idea-what-im-doing)

### Bonus: MSBuild 15 and WPF projects

Everything seemed to work... until I tried to migrate to MSBuild 15 (so I could build Visual Studio 2017 solutions) a year later. There's [an official guide](https://docs.microsoft.com/visualstudio/msbuild/updating-an-existing-application){:target="_build"} to do so (thank you!).

Apparently, versions under MSBuild 15 were bound to their Visual Studio installation and the new recommended way is to pull them via NuGet packages so they're separate.

My GameBoy emulator project is built in C++ but uses [a Logger built in WPF]({{ '/' | absolute_url }}log-window-0/). Turns out, WPF uses MSBuild itself to process `.xaml` files (its UI-definition files). So, it tries to spawn and wait for a new MSBuild process within ours! That results in an `Unknown build error: object reference not set to an instance of an object`. Yes, a null pointer exception is all of the info you have to diagnose it. Good.

The fix is quite simple, however! Add this property to you WPF project:

{% highlight xml %}
<AlwaysCompileMarkupFilesInSeparateDomain>false</AlwaysCompileMarkupFilesInSeparateDomain>
{% endhighlight %}

And it will use the same MSBuild instance that invoked the build. *Voilà*!

## Get build data

Alright! We've managed to make a solution build but we have nothing else to work with! Fear not, the API defines the `ILogger` interface and the basic `Logger` class for us! More info on the [Build Loggers docs](https://docs.microsoft.com/visualstudio/msbuild/build-loggers){:target="_blank"}.

Let's just take everything we can get:

{% highlight c# %}
public class AllMessagesLogger : Logger
{
  public override void Initialize(IEventSource eventSource)
  {
    eventSource.AnyEventRaised += OnAnyMessage;
  }

  private void OnAnyMessage(object sender, BuildEventArgs e)
  {
    Console.WriteLine(e.Message);
  }
}
{% endhighlight %}

And we can add this logger to the build by modifying the original code with this:

{% highlight c# %}
BuildParameters parameters = new BuildParameters()
{
  Loggers = new List<ILogger>() { new AllMessagesLogger() },
};
{% endhighlight %}

We can now print the message associated to every event MSBuild emits. And believe me, there's a ton of messages!

Still, there are some interesting things we should investigate.

### Which events we can hook to?

This is the definition of `IEventSource`:

{% highlight c# %}
public interface IEventSource
{
  event BuildMessageEventHandler MessageRaised;
  event BuildErrorEventHandler ErrorRaised;
  event BuildWarningEventHandler WarningRaised;
  event BuildStartedEventHandler BuildStarted;
  event BuildFinishedEventHandler BuildFinished;
  event ProjectStartedEventHandler ProjectStarted;
  event ProjectFinishedEventHandler ProjectFinished;
  event TargetStartedEventHandler TargetStarted;
  event TargetFinishedEventHandler TargetFinished;
  event TaskStartedEventHandler TaskStarted;
  event TaskFinishedEventHandler TaskFinished;
  event CustomBuildEventHandler CustomEventRaised;
  event BuildStatusEventHandler StatusEventRaised;
  event AnyEventHandler AnyEventRaised;
}
{% endhighlight %}

Nice, our old friends the `Project`, `Target` and `Task`! We'll come back to them in a bit and explore their relationships.

For now, just remember you can bind to different kind of events to get only what you're interested in.

### BuildEventArgs

This is the base class for these events. Of all members it's got we're interested in these ones:

  * `Timestamp`: the `DateTime` when the event was emitted (the *when*).
  * `Message`: the text you've already read within Visual Studio's Output panel (the *what*).
  * `BuildEventContext`: the context this event lives in (the *where*).

Let's try to understand what's the `BuildEventContext` then!

### BuildEventContext

This class looks like this:

{% highlight c# %}
public class BuildEventContext
{
  public int ProjectContextId { get; }
  public int NodeId { get; }
  public int ProjectInstanceId { get; }
  public int TaskId { get; }
  public int TargetId { get; }

  public long BuildRequestId { get; }
  public int SubmissionId { get; }
  public int EvaluationId { get; }
}
{% endhighlight %}

We're only interested in the first ones.

  * `ProjectContextId` identifies this context.
  * `NodeId`, after a bit of testing, identifies the *logical timeline* where it got executed (starts at 1, can excess the number of cores).
  * `ProjectContextId`, `TargetId` and `TaskId` identify *where* this event got executed within a hierarchy.

Alright, I think we can't postpone exploring `Project`, `Target` and `Task` anymore!

## Projects, targets and tasks

MSBuild data is defined in XML files and there's a hierarchy between definitions. These are the basics:

### Project

You may not know it, but that `.vcxproj` project file you've got is an XML file with MSBuild definitions. A Visual Studio 2015 project, for example, looks like:

{% highlight xml %}
<?xml version="1.0" encoding="utf-8"?>
<Project DefaultTargets="Build" ToolsVersion="14.0" xmlns="[...]">
  <ItemGroup Label="ProjectConfigurations">
    <ProjectConfiguration Include="Debug|x64">
      <Configuration>Debug</Configuration>
      <Platform>x64</Platform>
    </ProjectConfiguration>
    <!-- [...] -->
  </ItemGroup>
  <!-- [...] -->
</Project>
{% endhighlight %}

The key part here is the `Project` tag: it's the root of the file. You can head to the [official documentation](https://docs.microsoft.com/visualstudio/msbuild/project-element-msbuild){:target="_blank"} for more info, but let's just keep `Project` in cache.

### Target

If we continue exploring this `.vcxproj` file we'll find this section:

{% highlight xml %}
<!-- [...] -->
<ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'">
  <ClCompile>
    <WarningLevel>Level3</WarningLevel>
    <Optimization>Disabled</Optimization>
    <PreprocessorDefinitions>_DEBUG;_LIB;%(PreprocessorDefinitions)</PreprocessorDefinitions>
    <SDLCheck>true</SDLCheck>
    <MultiProcessorCompilation>true</MultiProcessorCompilation>
    <MinimalRebuild>false</MinimalRebuild>
  </ClCompile>
  <Link>
    <SubSystem>Windows</SubSystem>
    <GenerateDebugInformation>true</GenerateDebugInformation>
  </Link>
</ItemDefinitionGroup>
<!-- [...] -->
{% endhighlight %}

There are two parts I want you to pay attention to, in this case: `ClCompile` and `Link`. Both are specialized `Target` definitions (we'll see *how* in a moment) and the stuff they contain are *properties*. These are part of a `Project` and they group `Task` definitions together in a given order. You can read more in the [official documentation](https://docs.microsoft.com/visualstudio/msbuild/msbuild-targets){:target="_blank"}.

### Task

Finally, tasks execute the real logic behind all these definitions. They can create directories ([`MakeDir` task](https://docs.microsoft.com/visualstudio/msbuild/makedir-task){:target="_blank"}), compile code ([`CL` task](https://docs.microsoft.com/visualstudio/msbuild/cl-task){:target="_blank"}) or invoke other projects ([`MSBuild` task](https://docs.microsoft.com/visualstudio/msbuild/msbuild-task){:target="_blank"}), for example.

Instead of faithfully believing that paragraph, let's have a look ourselves, shall we? If you have a basic `.vcxproj` you won't see any `Task`, but you'll get this entry:

{% highlight xml %}
<Import Project="$(VCTargetsPath)\Microsoft.Cpp.targets" />
{% endhighlight %}

If you were to find that file, you'd see it has some definitions that point to `Microsoft.Cpp.Current.targets` and you could continue down the rabbit hole until you get to `Microsoft.CppCommon.targets`. Inside that file you can find the definition of the `ClCompile` target:

{% highlight xml %}
<!-- [...] -->          
<Target Name="ClCompile"
        Condition="'@(ClCompile)' != ''"
        DependsOnTargets="SelectClCompile">
  <CL Condition="[...]" />
  <CL Condition="[...]" />
  <!-- [...] -->          
</Target>
<!-- [...] -->
{% endhighlight %}

And that's where the `CL` task gets invoked!

Nice, so a `Project` can have `Target` entries and a `Target` groups `Task` entries together (one of which can spawn other `Project`).

![PLACEHOLDER, add project target task manual diagram here](https://via.placeholder.com/900x500){: .align-center}

This is all great, but what's a `Solution` file then?

### Solution

If we were to open a Visual Studio 2015 `.sln` file we'd find some structured text:

{% highlight text %}

Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio 14
VisualStudioVersion = 14.0.23107.0
MinimumVisualStudioVersion = 10.0.40219.1
[...]
Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "GameBoy", "Projects\GameBoy\GameBoy.vcxproj", "{A9A3EC03-A464-4D7C-AC36-857D50CCA937}"
  ProjectSection(ProjectDependencies) = postProject
    {E6C50B23-8563-4980-B0E4-DD4B0570810D} = {E6C50B23-8563-4980-B0E4-DD4B0570810D}
  EndProjectSection
EndProject
[...]
Global
  GlobalSection(SolutionConfigurationPlatforms) = preSolution
    Debug|x64 = Debug|x64
  EndGlobalSection
  [...]
EndGlobal
{% endhighlight %}

This defines which projects exist within our solution, their relationship and some extra data. If we go back to our Visual Studio's Developer Command Prompt and type:

{% highlight xml %}
set MSBuildEmitSolution=1
msbuild.exe Z:\path\to\solution.sln
{% endhighlight %}

We'll get a `solution.sln.metaproj` file we can open. And surprise! It's a MSBuild compilant file!

{% highlight xml %}
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="14.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" InitialTargets="ValidateSolutionConfiguration;ValidateToolsVersions;ValidateProjects" DefaultTargets="Build">
	<!-- [...] -->
	<Target Name="GameBoy:Rebuild" ... />
	<!-- [...] -->
</Project>
{% endhighlight %}

This is why we can Rebuild a single project (and its dependencies) by executing:

{% highlight text %}
msbuild.exe Z:\path\to\solution.sln /t:ProjectName:Rebuild
{% endhighlight %}

Great, so now that we know how MSBuild is structured, we can continue. But before we move on, this is the key takeaway from this section:

**Don't be afraid of diving as deep as you can when facing a new system.**
{: .notice--primary}

## Tying it all together

Let's take the previous `AllMessagesLogger` we created and run a build. Simplifying a whole lot and gracefully indenting it, we'd get something like:

{% highlight text %}
BuildStarted
  ProjectStarted
    TargetStarted
      TaskStarted
      TaskFinished
      TaskStarted
        ProjectStarted
          [...]
        ProjectFinished
      TaskFinished
    TargetFinished
    TargetStarted
      [...]
    TargetFinished
  ProjectFinished
BuildFinished
{% endhighlight %}

Doesn't this looks like a hierarchy to you?

{% highlight text %}
Build
  Project
    Target
      Task
      Task
        Project
          [...]
    Target
{% endhighlight %}

We can now start building our *timeline*!

### Issues

At first I thought it would be enough to keep stacking events together but soon enough I found not every entry refers to the *same hierarchy*. You may have two `Project` building in parallel and events get mixed up.

Here's where we go back to the `BuildEventContext`. Remember it had `ProjectInstanceId`, `TargetId` and `TaskId` members? Thanks to that, we can recreate the actual hierarchy!

Each context will populate these values as we get deeper in the hierarchy (i.e. a `Project` won't have a `TargetId` defined), but there are two exceptions:

  * The `Build` is a unique element with no context.
  * A `Project` can have no parent context (it's a top-level one) or reference a `Task` context via `ParentEventContext` member (part of the `ProjectStartedEvent` class).

There are a lot of caveats in the implementation, some inconsistencies (like a `Task` that spawns a `Project` but that `Task` is finished before the `Project` even starts), and some trial and error.

But, eventually, you get to something!

# Google Chrome's trace viewer

Now that we've got our hierarchy in memory we should dump it to some kind of file. Turns out, Google Chrome has this [chrome://tracing](chrome://tracing){:target="_blank"} viewer we can use!

We'll create a JSON file with a couple of special properties that let us visualize flame graphs. The format and properties are [available in this doc](https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/preview){:target="_blank"}.

{% highlight json %}
{
  "traceEvents": [
    {
      "ph": "B",
      "pid": 0,
      "tid": 0,
      "ts": 0.0,
      "name": "Hello, flame graph!"
    },
    {
      "ph": "B",
      "pid": 0,
      "tid": 0,
      "ts": 2000.0,
      "name": "I'm a child!"
    },
    {
      "ph": "E",
      "pid": 0,
      "tid": 0,
      "ts": 8000.0
    },
    {
      "ph": "E",
      "pid": 0,
      "tid": 0,
      "ts": 10000.0
    }
  ]
}
{% endhighlight %}

In this small example you can see how to create hierarchies in this format. You can load it into the viewer and this will be the result:

![Google Chrome's trace viewer example]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/trace-example.png "Google Chrome's trace viewer example")

And finally, let's build real traces!

# The result

Let's take everything, build some projects and see what's going on!

## Blank project

If you create a blank `C++ Win32 Console Application` in Visual Studio 2015 with the default configuration, this is how it looks like:

![Blank project flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/blank-project-flame-graph.png "Blank project's flame graph"){: .align-center}

See how it has two `CL` tasks? One is the pre-compiled header and the other one is the main file.

## GameBoy emulator

This is the trace from my GameBoy emulator (we'll try to improve it in the next post):

![GameBoy emulator flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/gameboy-emulator-flame-graph.png "GameBoy emulator's flame graph"){: .align-center}

See how it's using several `NodeId` and each one has a number of *timelines*? They represent projects with dependencies!

The top-level Solution executes a `MSBuild` task to build `MainWindows.vcxproj.metaproj` (within the same `NodeId`) and `Test.vcxproj.metaproj` (in a separate `NodeId`). Both wait for `GameBoy.vcxproj.metaproj` to finish, which in turn waits for `LogLibrary.vcxproj.metaproj` to build...

It's a bit complex because of the (seemingly) arbitrary `NodeId` switches, but that's the process!  
Remember, these `.vcxproj.metaproj` are generated from the `.sln` file!

## Bruce Dawson's parallel build

Finally, while investigating slow compile times I read [this blog post](https://randomascii.wordpress.com/2014/03/22/make-vc-compiles-fast-through-parallel-compilation/){:target="_blank"} by [@BruceDawson0xB](https://twitter.com/BruceDawson0xB){:target="_blank"} and it helped me a lot. This is its trace:

![Random ASCII parallel project flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/random-ascii-parallel-flame-graph.png "Random ASCII's parallel project flame graph"){: .align-center}

If you want to know why there are that many `CL` tasks, I invite you to check his blog post!

---

That's all for now! We've seen how to invoke MSBuild from C# and use its `Logger` to create our flame graphs.

In the next post we'll play around with these graphs to diagnose possible issues, add and remove some MSVC flags to get extra information (I'm looking at you `/Bt+` and `/d1reportTime`!).

![Teaser of /d1reportTime as a flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-1/teaser-d1reporttime-flag.png "Teaser of /d1reportTime as a flame graph"){: .align-center}

Thanks for reading!
