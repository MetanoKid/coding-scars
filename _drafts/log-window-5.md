---
layout: single
title: "Log window from scratch: C++ and C# interoperability"
excerpt: "Connect a native C++ project with our C# WPF log window"
author: Meta
category: Toolbox
tags:
  - Log
  - WPF
  - CSharp
  - C++
  - C++/CLI
  - Managed
  - Unmanaged
series: Log window from scratch
---

Hello and welcome to the last entry in the series!

So far we've gone through the process of building a WPF live log window we could use from other C# projects. We made it a `Class Library` and used it from a _host program_ also written in C#.

This time, we'll learn how we can have a C++ project use it. Yeah, that's right: we'll be calling C# WPF from C++!

Let's do it!

# Overview

Before we dive into creating projects, configurations and code, let's have a look into what we'll need.

First of all, our WPF log window is C# code. If we were to categorize it by how memory is dealt with, we'd call it _managed_. This is because we create memory via `new` and the [Garbage Collector](https://docs.microsoft.com/en-us/dotnet/standard/garbage-collection/){:target="_blank"} will know when to _free_ it.

Second, our new _host program_ will be C++ code. However, because there's no Garbage Collector of any sort, we can call it _unmanaged_. We can also call it _native code_.

So, you could say: _how can we invoke C# code from C++ code?_ The short answer is _you can't, directly_. Fortunately for us, there's a long answer!

## C++/CLI

There's a language called [C++/CLI](https://en.wikipedia.org/wiki/C%2B%2B/CLI){:target="_blank"} that we could basically say is C++ with new functionality to deal with .NET languages via [Common Language Infrastructure](https://en.wikipedia.org/wiki/Common_Language_Infrastructure){:target="_blank"}. We could call this kind of code _mixed_.

With this in mind, we could have C++/CLI code sitting in between of C++ and C#, like in this diagram:

TODO: diagram

With this picture in mind, these will be the steps:

  * Create a C++ project with the typical _Hello, world!_
  * Create a C++/CLI project with a not-so-typical _Hello, mixed world!_
  * Connect these two so we can invoke the _mixed_ one from the _unmanaged_ one.
  * Connect the _mixed_ project with our _managed_ WPF one.

# C++ host program

Let's start by adding a new C++ project to our solution: right-click it, then _Add -> New project..._ and choose _Win32 Console Application_ from the _Visual C++_ filter. Give it a descriptive name like `NativeHostProgram`. From the wizard select _Empty project_.

Now, create the typical `Main.cpp`:

{% highlight c++ %}
int main(int argc, char **argv)
{
    std::cout << "Hello, world!" << std::endl;
    return 0;
}
{% endhighlight %}

Set this project as the _startup project_ and run it. So far, so good. Next step?

# C++/CLI bridge project

We've set our C++ project as the main one, so we can't do the same for this C++/CLI project. Instead, we'll use it from the _native_ one, and that means it must be a library.

Again, right-click on the solution then _Add -> New project..._ but this time, under _Visual C++_ select the _CLR_ group. The only project type we're given that matches our requirement is a `Class Library`, so let's create that one. Give it a nice descriptive name, like `LogWindowMixedBridge`.

By doing so, Visual Studio will also create `LogWindowMixedBridge.h` and `LogWindowMixedBridge.cpp` for us. I prefer deleting them to start from scratch once again.

Let's instead create a nice and simple `Bridge.h` with this code:

{% highlight c++ %}
#pragma once

#include <iostream>

void helloMixedWorld()
{
    std::cout << "Hello, mixed world!" << std::endl;
}
{% endhighlight %}

To be able to invoke this `helloMixedWorld` we must first connect the two projects together. But, how can we do that?

## Referencing Bridge from native

When we chose `Class Library` while creating our C++/CLI project we were in fact creating a DLL, so we must follow the usual process for [linking DLLs](https://docs.microsoft.com/en-us/cpp/build/linking-an-executable-to-a-dll){:target="_blank"}. This time, we'll use the _Implicit Linking_ method.

Let's change our `Bridge.h` file to:

{% highlight c++ %}
#pragma once

#ifdef MIXED_MODE_DLL_EXPORT
#define MIXED_BRIDGE_API __declspec(dllexport)
#else
#define MIXED_BRIDGE_API __declspec(dllimport)
#endif

MIXED_BRIDGE_API void helloMixedWorld();
{% endhighlight %}

And a `Bridge.cpp` file with:

{% highlight c++ %}
#include "Bridge.h"

#include <iostream>

MIXED_BRIDGE_API void helloMixedWorld()
{
    std::cout << "Hello, mixed world!" << std::endl;
}
{% endhighlight %}

Which will yield this error:

_Error: a function declared 'dllimport' may not be defined._
{: .notice--primary}

This is because `MIXED_MODE_DLL_EXPORT` isn't defined, which means we're declaring the `helloMixedWorld` as `dllimport`. However, DLL projects must use `dllexport` for their functions so other projects use `dllimport`. So, where can we define `MIXED_MODE_DLL_EXPORT`?

Right-click the `LogWindowMixedBridge` project and select Properties. Under _C/C++ > Preprocessor > Preprocessor definitions_ then add `MIXED_MODE_DLL_EXPORT`.

With this, the error has gone away!

Now, compile the `LogWindowMixedBridge` project alone. It should complete with no errors and will have created two files we're interested in: `LogWindowMixedBridge.dll` and `LogWindowMixedBridge.lib`. These, alongside the `Bridge.h` file are the three things we need to _implicitly link_ this DLL.

### Implicit Linking

We said we needed three things to be able to reference this DLL from our `NativeHostProgram`:

  * Have access to the `.h` files with declarations.
  * Have access to the `.lib` file to perform the link.
  * Have access to the `.dll` file.

With this, it's pretty much working as a _static library_ although it is a DLL.

Right-click `NativeHostProgram`, select Properties and perform these steps (we're using paths from the default Visual Studio configuration):

  * Update _C/C++ > Additional Include Directories_: `%(SolutionDir)LogWindowMixedBridge\;%(AdditionalIncludeDirectories)`.
  * Update _Linker > Additional Dependencies > Input_: `LogWindowMixedBridge.lib;` and all of the previous values.
  * Update _Linker > General > Additional Library Directories_: `$(SolutionDir)\$(Configuration)\;%(AdditionalLibraryDirectories)` for _Win32_ and `$(SolutionDir)$(Platform)\$(Configuration)\;%(AdditionalLibraryDirectories)` for _x64_.

Last, but not least, we must tell the solution that `NativeHostProgram` depends on `LogWindowMixedBridge`. To do so, right-click the solution, select Properties and under _Project Dependencies_ select `NativeHostProgram` and check `LogWindowMixedBridge`. From now on, when we compile the solution it will first compile `LogWindowMixedBridge` and then `NativeHostProgram`.

Well, we've linked everything so we can go back to `Main.cpp` in `NativeHostProgram` and update it with:

{% highlight c++ %}
#include <Bridge.h>

int main(int argc, char **argv)
{
    helloMixedWorld();
    return 0;
}
{% endhighlight %}

Run the solution and you'll have an impressive message in your console saying the _Hello, mixed world!_ message!

Phew! It was intense! Well done :)

# Connecting C++/CLI to C# #

Nice! We know how to connect C++ with C++/CLI, but how about going from C++/CLI to C#? The answer is in fact pretty simple: reference it!

To do so, expand our `LogWindowMixedBridge` project, right-click References, select _Add Reference..._ and then check our `LogWindowUI` project (which, if you remember from previous entries, is our C# WPF project).

Now we can update our `Bridge.cpp` file with this code:

{% highlight c++ %}
#include "Bridge.h"

MIXED_BRIDGE_API void helloMixedWorld()
{
  LogWindowUI::LoggerUI::Initialize(0, 0, 500, 300);
  LogWindowUI::LoggerUI::Instance->Add(0.0f, "DEBUG", "TEST", "Hello, WPF!");

  // required so we can see the window for a bit
  System::Threading::Thread::Sleep(5000);
}
{% endhighlight %}

Run it and you'll get this:

![Hello WPF from mixed]({{ '/' | absolute_url }}/assets/images/per-post/log-window-5/hello-wpf-from-mixed.png){: .align-center}

Impressive! It may look like no big deal, but we've shown our log window from a code that started at C++! Now, for the last bit!

# Bridge revisited

Alright, we're awesome because we communicated C++ with C#, but for now it's just a function! Why don't we design it a bit and make our C++ program configure the C# WPF window and log some stuff?

Our `LoggerUI` class, which belongs to C#, has methods to deal with the window like `Initialize`, `ConfigureSystems` or `Add`. Wouldn't it be awesome to have some kind of _wrapper_ in our C++/CLI project to call them from C++? We're doing that now.

Let's modify our `Bridge.h` file with this:

{% highlight c++ %}
#pragma once

#ifdef MIXED_MODE_DLL_EXPORT
#define MIXED_BRIDGE_API __declspec(dllexport)
#else
#define MIXED_BRIDGE_API __declspec(dllimport)
#endif

#include <vector>

class MIXED_BRIDGE_API Bridge
{
public:
  Bridge(int x, int y, int w, int h);
  ~Bridge();

  void configureSystems(std::vector<const char *> systems);
  void configureLevels(std::vector<std::pair<const char *, const char *>> levels);

  void log(const char *level, float timestamp, const char *system, const char *message) const;
};
{% endhighlight %}

Notice how we can export a whole class with the DLL, not just free functions. As you can see, its methods mostly map those at `LoggerUI`. Why don't we see some of the implementations?

{% highlight c++ %}
Bridge::Bridge(int x, int y, int w, int h)
{
  LogWindowUI::LoggerUI::Initialize(x, y, w, h);
}

Bridge::~Bridge()
{
  LogWindowUI::LoggerUI::Destroy();
}
{% endhighlight %}

Nothing pretty fancy here, right? What about `configureSystems`, for example?

{% highlight c++ %}
void Bridge::configureSystems(std::vector<const char *> systems)
{
  auto ^systemsManaged = gcnew System::Collections::Generic::List<System::String ^>();
  for (const char *s : systems)
  {
    systemsManaged->Add(gcnew System::String(s));
  }

  LogWindowUI::LoggerUI::Instance->ConfigureSytems(systemsManaged);
}
{% endhighlight %}

This is what our `Bridge` is all about: translating stuff from C++ to C#. See how we're converting the `const char *` to `String`? Okay, but you may say: _what's that `String ^` or `gcnew`?

The `^` symbol represents a pointer to managed memory, and that memory must be created somewhere. That's where `gcnew` comes into play: creates memory handled by the Garbage Collector. We could say they are the managed counterparts of `*` and `new`.

## LoggerUI as a Singleton

By now you've already noticed we're enforcing having a single `LoggerUI` instance because it's a Singleton. However, nothing prevents us from creating several `Bridge` instances! We could create two of them and then an assert would trigger because we'd be trying to call `LoggerUI::Initialize` twice!

We could fix it by ditching out the Singleton pattern at this level and having our `Bridge` _wrapper_ have a private `LoggerUI` member. However, it's a bit more convoluted than I wanted to dive into. Long story short, it requires creating a `BridgePrivate` class to be used by `Bridge` (pretty much like [PIMPL](https://en.cppreference.com/w/cpp/language/pimpl){:target="_blank"}) with a member of type `gcroot<LoggerUI ^>`. The reason is we can't expose a C++/CLI class to C++ with pointers to managed memory, so we must hide it.

# Putting it all together

The only thing we're missing is calling all this from C++! Let's update `Main.cpp` with this:

{% highlight c++ %}
#include "Bridge.h"

#include <chrono>
#include <thread>

int main(int argc, char **argv)
{
  std::vector<const char *> systems;
  systems.push_back("TEST");

  std::vector<std::pair<const char *, const char *>> levels;
  levels.push_back(std::pair<const char *, const char *>("DEBUG", "#000000"));

  Bridge *bridge = new Bridge(0, 0, 400, 200);
  bridge->configureSystems(systems);
  bridge->configureLevels(levels);

  bridge->log("DEBUG", 0.0f, "TEST", "Hello from native C++!");

  std::this_thread::sleep_for(std::chrono::seconds(20));
  delete bridge;

  return 0;
}
{% endhighlight %}

And this is the result:

![Hello WPF from native C++]({{ '/' | absolute_url }}/assets/images/per-post/log-window-5/hello-wpf-from-cpp.png){: .align-center}

What if we configured more levels and more systems? What if we logged messages with random level and system? What if we recorded it into a gif?

![Live log window]({{ '/' | absolute_url }}/assets/images/per-post/log-window-5/live-log-window.gif){: .align-center}
