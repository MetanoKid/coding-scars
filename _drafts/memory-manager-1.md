---
layout: single
title: "Memory Management in C++: system analysis and first steps"
excerpt:
author: Meta
category: Computer Science
tags:
  - Programming
series: Memory Management in C++
---

Welcome to the first post in the series _{{ page.series }}_!

In this post we'll try to understand the big picture of what we're trying to achieve with the full series. We'll also start building the Memory Manager in small steps, ensuring we build the tools we need as we go.

So let's get started!

# Trick of the trade

Let me give you a piece of advice. Something I learned some time after I started learning Computer Science. Something I was told when I started programming but I didn't understand by then.

_**Whenever you want to build a system, take pen and paper and draw the system you want to end up having.**_

Draw it once, take notes. Thrash it because you noticed you were missing something. Start drawing it again, discover dependencies, interactions. Find out how you're structuring your code. Be sure you know what you are building before you even open an IDE and start coding.

It's useful to even find out how the user (maybe that's _you_) will interact with your system. What's the top level API? Which classes/functions you can come up with?

That's what we'll do first, so we know what we want to build.

# Understanding what we want to build

Okay, we want to build a Memory Manager. And _what is a Memory Manager_, you say?

Let's define it as _a system that can receive requests to retrieve and return arbitrary-sized chunks of memory from an existent memory pool_.

That means that the typical use of the system would be to request memory to store data, transform that memory and then return it back to the system somewhere down the line. The memory we deal with is finite, so subsequent requests of memory will result in less available memory in the pool. Not returning it back to the system can make it run out of memory.

## Top level API

We want to expose some functions to the user so she can fulfill the requirements we've just defined. We're building it in C++, so we can define the following class:

{% highlight c++ %}
class cMemoryManager
{
public:
    void *allocate(unsigned int bytes);
    void deallocate(void *pointer);
};
{% endhighlight %}

With this, the user can do:

{% highlight c++ %}
int *intPointer = static_cast<int *>(memoryManager.allocate(sizeof(int)));
*intPointer = 42;
memoryManager.deallocate(intPointer);
{% endhighlight %}

Alright, it's a weird example, but we'll try to understand it. The experienced programmers might have to bare with me for a second.

We take the `sizeof(int)`, which results in a number of bytes (the ones it takes to store an `int`). Then we request that amount of memory to the Memory Manager. Because the `allocate` method returns a `void *` (_pointer to anything_) we need to interpret it as an `int *`, hence the `static_cast<int *>`.

Then we take the pointer to our `int` and update the memory it points to so it contains `42`. Now we have _a pointer that points to an `int` that has value 42_.

Now that we're done with it, we return the memory back to the Memory Manager.

This is basically the same code as doing the following thing:

{% highlight c++ %}
int *intPointer = new int;
*intPointer = 42;
delete intPointer;
{% endhighlight %}

The difference is that we control the underlying memory instead of letting the OS deal with it.

Okay, so that's the kind of thing we want our users to be able to do. Now let's take pen and paper and start designing our system!

## System design

One of the requirements we set ourselves was that the memory we manage is finite. That means the `MemoryManager`, somehow, has access to a chunk of the full computer memory. Then, we slice it into chunks which have different sizes based on what is requested by the user. So, we need to keep track of all of the chunks we've sliced the memory into.

With all that in mind, we can think of our system as:

TODO: picture

By drawing this picture we've discovered a new class for our system: the `MemoryChunk`. And we've also found some of the data it needs to have. Let's define it as:

{% highlight c++ %}
struct cMemoryChunk
{
    bool m_isInUse;
    unsigned int m_bytes;

    cMemoryChunk *m_previous;
    cMemoryChunk *m_next;
};
{% endhighlight %}

Each of these `MemoryChunk` instances is part of a chain of chunks. It knows whether it's in use, the number of bytes it contains and a couple of pointers to the previous and next chunks in the chain. You might have noticed it looks like a [Doubly Linked List](https://en.wikipedia.org/wiki/Doubly_linked_list). And you're right. The `MemoryManager` would, then, have some kind of reference to the _head_ of the list of chunks. We'll see how, but it's not via a `MemoryChunk *`.

One caveat: although the user requests arbitrary memory in the form of a `void *` (check the API we defined), we're building `MemoryChunk` instances internally. That means we're using the `MemoryChunk` as kind of a _container_ of the memory the user requests, storing internal data for the manager and returning the memory that is _contained_ in the chunk.

Knowing all this, we can start coding!

# First steps

Okay, we're dealing with some big chunk of memory ourselves and slice it into small pieces by user request. But where does that memory come from? How do we obtain and release that memory?

## Obtaining memory for our manager

The idea is simple: during the program's startup we build our `MemoryManager`. It will, in turn, request enough memory to the OS via the `new` operator and keep the pointer to that memory. From then on, we can't perform new memory requests to the OS: we're doing it only once in a big chunk.

We could then update our `MemoryManager` definition with this behavior:

{% highlight c++ %}
class cMemoryManager
{
public:
    cMemoryManager(unsigned int bytes) :
        m_memory(nullptr),
        m_totalBytesCount(bytes)
    {
        m_memory = ::new unsigned char[bytes];
    }

private:
    unsigned int m_totalBytesCount;
    unsigned char *m_memory;
};
{% endhighlight %}

An `unsigned char` can store values in the range `0..255` with a size of 1 byte and `m_memory` is a pointer to the first byte in an array with as many bytes as requested in the constructor. If we were to use this class as it is now, we'd be leaking memory. So we need to release the array we requested to the OS. Let's add that in the destructor:

{% highlight c++ %}
cMemoryManager::~cMemoryManager()
{
    ::delete[] m_memory;
    m_memory = nullptr;
}
{% endhighlight %}

And with this, we've got the start and end of the life cycle for the memory we manage. But before we continue on with the `MemoryChunk`, we need some tool to know we're doing it right.

## Dumping the contents

One useful tool we want to have is the ability to dump the contents of the memory we're managing in an hexadecimal view. We'll use the most common format: a left column with the pointer address, a central column with all of the bytes and a right column with an ASCII representation of each byte. Let's define a `dump` method:

{% highlight c++ linenos %}
std::string cMemoryManager::dump(unsigned int itemsPerRow) const
{
    const unsigned int bytesPerRow = itemsPerRow * sizeof(void *);

    const unsigned char *memoryIterator = m_memory;
    const unsigned char *characterIterator = m_memory;

    std::stringstream ss;

    // iterate over the memory
    for (; static_cast<unsigned int>(memoryIterator - m_memory) < m_totalBytesCount; memoryIterator += bytesPerRow)
    {
        ss << static_cast<const void *>(memoryIterator) << ":  ";

        // iterate over the row
        for (unsigned int charIndex = 0; charIndex < bytesPerRow; ++charIndex, ++characterIterator)
        {
            const unsigned int characterIteratorAsInt = static_cast<unsigned int>(*characterIterator);
            ss << std::uppercase << std::hex << std::setw(2) << std::setfill('0');

            // general case
            if (charIndex < bytesPerRow - 1)
            {
                ss << characterIteratorAsInt << ":";
            }
            // last item
            else
            {
                ss << characterIteratorAsInt << "  ";
                ss << std::nouppercase << std::dec;

                // get the string representation of the bytes in the row
                for (unsigned int representationIndex = 0; representationIndex < bytesPerRow; ++representationIndex)
                {
                    const unsigned char &character = *(memoryIterator + representationIndex);
                    ss << (isprint(character) ? character : static_cast<unsigned char>('.'));
                }
            }
        }

        ss << "\n";
    }

    return ss.str();
}
{% endhighlight %}

Wow, long code this time! Let's study it!

TODO: explaination

Let's test it! Assume we have this code:

{% highlight c++ %}
int main()
{
    cMemoryManager memoryManager(64);
    std::cout << memoryManager.dump() << std::endl;

    return 0;
}
{% endhighlight %}

If we execute it in Visual Studio with the **Debug x86** configuration, we get something similar to:

{% highlight text %}
00CC5F68:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00CC5F78:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00CC5F88:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00CC5F98:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

Please note that the addresses in the left column will change on each execution. As you can see, the memory is magically initialized to the `0xCD` value! _Oh, thank you Visual Studio in Debug mode_. As we mentioned before, the `.` is used whenever the character doesn't have a string representation.

What happens if we use Visual Studio with the **Release x86** configuration?

{% highlight text %}
00375B98:  38:9D:37:00:C8:6E:37:00:10:4C:37:00:10:4C:37:00  8.7..n7..L7..L7.
00375BA8:  10:4C:37:00:10:4C:37:00:10:4C:37:00:10:4C:37:00  .L7..L7..L7..L7.
00375BB8:  10:4C:37:00:10:4C:37:00:20:49:37:00:10:4C:37:00  .L7..L7. I7..L7.
00375BC8:  10:4C:37:00:10:4C:37:00:10:4C:37:00:10:4C:37:00  .L7..L7..L7..L7.
{% endhighlight %}

Wow, what is _THAT_? That's all thrash values from the memory we've received from the OS! Where did all of the `0xCD` values go? Turns out that Visual Studio is kind enough to initialize values for us while in Debug but not in Release. So be careful, kids, _always initialize your variables_. But before we do initilize our memory, let's execute it again in Visual Studio with **Debug x64** and **Release x64** configurations:

{% highlight text %}
0000020801EF8480:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................................
0000020801EF84A0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................................
{% endhighlight %}

{% highlight text %}
00000144EF14F7B0:  20:00:46:00:69:00:6C:00:65:00:73:00:20:00:28:00:78:00:38:00:36:00:29:00:5C:00:4D:00:69:00:63:00   .F.i.l.e.s. .(.x.8.6.).\.M.i.c.
00000144EF14F7D0:  72:00:6F:00:73:00:6F:00:66:00:74:00:20:00:56:00:69:00:73:00:75:00:61:00:6C:00:20:00:53:00:74:00  r.o.s.o.f.t. .V.i.s.u.a.l. .S.t.
{% endhighlight %}

TODO: explaination

TODO:
* Memory thrashing (on initialization, on allocation, on deallocation)
* Initial memory chunk