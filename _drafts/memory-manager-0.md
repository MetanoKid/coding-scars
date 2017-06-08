---
layout: single
title: "Memory Management in C++: introduction"
excerpt:
author: Meta
category: Computer Science
tags:
  - Programming
series: Memory Management in C++
---

Some time ago I was rolling my own take on some containers of C++'s STL. Of course they were simplified versions of the originals, just focusing on the _bare-bones_.

If you have used the STL, you might recall having a `std::vector<std::string>` somewhere, for example. It turns out these two containers have an optional parameter: the `Allocator`. It deals with how their dynamic memory requirements are fulfilled. So, of course, I wanted to mimic this behavior.

I went on and created a _copy_ of the default `Allocator`: it forwarded memory requests to `new` and `delete`. Not bad, as I could create other allocators that obtained that dynamic memory from other source.

That source, in this case, was a custom Memory Manager. It was a rather naive one, just a Proof of Concept (but it worked!). I learned a lot while doing it but barely scratched the surface. However, I wanted to share what I found, so this series of posts will go step by step through building a simple Memory Manager in C++ and what to keep in mind while implementing it.

# Why do you need a Memory Manager?

In C++, each time you need dynamic memory you use `new` (`malloc` in C), some memory is allocated on the heap and you get a pointer to it. When you're done with the memory, you use `delete` (`free` in C) and the memory is returned to the OS.

While doing that, you are in fact calling the OS. It is, in turn, switching contexts between your application and the kernel to fulfill your requests. And that's each time you call `new` and `delete`! We're talking about tiny fractions of a second on each context switch, but they will stack if you are performing them continuously.

While this might not seem like a big deal for all applications, some high-performant ones do require memory management to be quick. This is something well widespread in videogames development. Consoles aren't as fast as computers, and none of them would reject those extra fractions of a second.

# What's the idea?

Okay so, from what I know the most common strategy when building a Memory Manager is to allocate a big chunk of memory on a single call on the early startup of the application.

During the execution of said application, all the calls to `new` and `delete` are in fact being redirected to the Memory Manager, which acts on the previous big memory chunk. Think of it as if it was the OS handling which memory is being allocated, but it's working on the _user space_ instead of the _kernel space_ so no context switch is performed.

When the application is closing, the big memory chunk is returned to the OS and no memory is leaked.

# Benefits

Let's summarize them into this list:

  * Potential performance improvement: we've claimed the calls to the OS can be slow in certain scenarios. If you deal with your memory in a nice way you can outperform the OS.
  * Full control of the memory: you're responsible for dealing with the memory layout yourself, so you can decide how you partition it, which memory is returned to the user and what to do with the one you recover.
  * Debugging: you can add debug information to user's allocations. For example, at the cost of extra memory you could store the file and the line from which the allocation was made and track memory leaks down. Or you could include guards on each allocations to find memory stomps.
  * Profiling and tuning: because you know which allocations are being made you can extract some statistics on which memory sizes are being requested the most, which is your memory usage peak, whether you're running out of memory or identify code that uses more memory than it really needs to.

# Goals

With this series of posts I want to go through the progress of building a simple, single threaded Memory Manager. We'll study how to add some debug utilities like the ability to dump the memory in hexadecimal format. We'll also investigate different options on how to layout the big memory chunk, their pros and cons.

And, if we manage to outperform `new` and `delete` we'll throw a party!

Let's get started!