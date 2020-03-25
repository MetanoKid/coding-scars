---
layout: single
title: "Creating a MSBuild-to-flame-graph tool"
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

I love side projects. You have a problem you want to solve, think about how you'd do it and then start working on a solution that *mostly works*. Now you've calmed the itch that started it all, it becomes a *product* and you start losing interest on it. A new side projects pops in. But this time I managed to finish it!

Over a year ago I started a side project to create a flame graph out of a MSBuild execution. This was inspired by [@aras_p](https://twitter.com/aras_p)'s [blog post](https://aras-p.info/blog/2019/01/16/time-trace-timeline-flame-chart-profiler-for-Clang/){:target="_blank"}. Thanks again for everything you've written in your blog!

This post serves as a summary of what I learned and what ended up in the tool. I thought it would be a shorter post but it got out of control, so the examples will be part of a new one so we can show more!

![MSBuild to flame graph]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/msbuild-flame-graph.png "MSBuild flame graph"){: .align-center}

We'll be using my (unreleased) GameBoy emulator (yeah, one of those abandoned side-projects) throughout the post so we can see real data and not just synthetic tests.

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

This will rebuild our solution and dump a lot of information to console. This looks very much like setting *MSBuild project build output verbosity* to `Normal` or `Detailed` in Visual Studio's Options window!

We're getting closer, and [MSBuild official documentation](https://docs.microsoft.com/visualstudio/msbuild/msbuild){:target="_blank"} has a lot more information, like [using MSBuild programmatically](https://docs.microsoft.com/visualstudio/msbuild/msbuild-api){:target="_blank"}.

# The goal

Now that we know we can invoke MSBuild ourselves and there's, apparently, some kind of API to deal with it programmatically, we want to explore what it can offer!

And because we're programmers, want some code, right? Let's get that first!

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

Simple, right? Well... no.

For it to work you need these `BuildRequestData`, `BuildParameters` and `BuildManager` classes. And this is where the pain started for me.

## Reference MSBuild assemblies

By the time I started working on this tool I was using Visual Studio 2015 and I didn't know where to find any of these assemblies. So I tried adding a Reference to them via `Framework`:

![MSBuild assemblies via Framework]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/msbuild-assemblies-framework.png "Assemblies via Framework"){: .align-center}

Note it says version `4.0.0.0`, I didn't even know which version I needed! This happened like a year ago so I may have forgotten, but I think it worked for a while until I tried to compile a different kind of project. Anyways, I ended up referencing assemblies via the Extensions page:

![MSBuild assemblies via Extensions]({{ '/' | absolute_url }}/assets/images/per-post/investigating-cpp-compile-times-2/msbuild-assemblies-extensions.png "Assemblies via Extensions"){: .align-center}

Note it says version `14.0.0.0`. Still, no idea why they're different, but this one worked correctly (and then I knew I was using MSBuild 14).

### Bonus: binding redirects

As if it wasn't complex enough, I had to apply binding redirects to make it build Visual Studio 2015 solutions. More info on the [official docs](https://docs.microsoft.com/dotnet/framework/configure-apps/redirect-assembly-versions){:target="_blank"}. I'm a C++ programmer and wasn't aware of this requirement, I guess .NET programmers are used to it!

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

Everything seemed to work until a year later when I tried to migrate to MSBuild 15 (Visual Studio 2017+). There's [an official guide](https://docs.microsoft.com/visualstudio/msbuild/updating-an-existing-application){:target="_build"} to do so. Apparently, versions under MSBuild 15 were bound to their Visual Studio installation and the new recommended way is to pull them via NuGet packages so they're separate.

My GameBoy emulator project is built in C++ but uses [a Logger built in WPF]({{ '/' | absolute_url }}log-window-0/). Turns out, WPF uses MSBuild itself to process `.xaml` files (its UI-definition files). So, it tries to spawn and wait for a new MSBuild process within ours! That results in an `Unknown build error: object reference not set to an instance of an object`. Yes, a null pointer exception is all of the info you have to diagnose it. Good.

The fix is quite simple, however! Add this property to you WPF project:

{% highlight xml %}
<AlwaysCompileMarkupFilesInSeparateDomain>false</AlwaysCompileMarkupFilesInSeparateDomain>
{% endhighlight %}

And it will use the same MSBuild instance that invoked the build. *Voilà*!

## Get build data

Alright! We've managed to make a solution build but we have nothing else to work with! Fear not, the API defines the `ILogger` and the basic `Logger` for us! More info on the [Build Loggers docs](https://docs.microsoft.com/visualstudio/msbuild/build-loggers){:target="_blank"}.

Let's just log everything:

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

With this we can print the message associated to each event MSBuild emits. And believe me, there's a ton of messages!

There are two interesting things we should investigate now:

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

As you can see, you can bind to different kind of events to get only what you're interested in.

### BuildEventArgs

This is the base class for the events we're notified and has several child classes, one for each kind of event. Of all members it's got we're interested in these ones:

  * `Timestamp`: the `DateTime` when the event was emitted.
  * `Message`: the text you've already read within Visual Studio's Output panel.
  * `BuildEventContext`: the context this event lives in.

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
  * `NodeId`, after a bit of testing, identifies the *core* where it got executed (starts at 1, goes up until `Environment.ProcessorCount`).
  * `ProjectContextId`, `TargetId` and `TaskId` identify *where* this event got executed within a hierarchy.

Alright, I think we can't postpone exploring `Project`, `Target` and `Task` anymore!

## Projects, targets and tasks

MSBuild data is defined in XML files and there's a hierarchy between definitions.

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

There are two sections I want you to pay attention to, in this case: `ClCompile` and `Link`. Both are specialized `Target` definitions (we'll see *how* in a moment). These are part of a `Project` and they group `Task` definitions together with a given order. You can read more in the [official documentation](https://docs.microsoft.com/visualstudio/msbuild/msbuild-targets){:target="_blank"}.

### Task

Finally, tasks execute the real logic behind all these definitions. They can create directories ([`MakeDir` task](https://docs.microsoft.com/visualstudio/msbuild/makedir-task){:target="_blank"}), compile code ([`CL` task](https://docs.microsoft.com/visualstudio/msbuild/cl-task){:target="_blank"}) or invoke other projects ([`MSBuild` task](https://docs.microsoft.com/visualstudio/msbuild/msbuild-task){:target="_blank"}), to give some examples.

Let's have a look ourselves, shall we? If you have a basic `.vcxproj` you won't see any `Task`. But you'll see this entry:

{% highlight xml %}
<Import Project="$(VCTargetsPath)\Microsoft.Cpp.targets" />
{% endhighlight %}

If you were to find that file, you'd find it has some definitions that point to `Microsoft.Cpp.Current.targets` and you could continue down the rabbit hole until you get to `Microsoft.CppCommon.targets`. Inside that file you can find the definition of the `ClCompile` target:

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

And that's where the `CL` task gets invoked.

Nice, so a `Project` can have `Target` children and a `Target` groups `Task` entries together (one of which can spawn other `Project`).

![PLACEHOLDER, add project target task manual diagram here](https://via.placeholder.com/900x500){: .align-center}

This is all great, but what's a `Solution` file then?

### Solution

If we were to open a `.sln` file (Visual Studio 2015 in this case) we'd find some text based data:

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

Great, so now that we know how MSBuild is structured, let's continue. But before we move on, this is the key takeaway from this section:

**Don't be afraid of diving as deep as you can when facing a new system.**
{: .notice--primary}

## Tying it all together

...

# The result

A couple of screenshots with raw MSBuild data (no post-process).
