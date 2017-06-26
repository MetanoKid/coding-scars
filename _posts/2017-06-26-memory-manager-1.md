---
layout: single
title: "Memory Management in C++: first steps"
excerpt: In this entry we'll learn how to dump the contents of the memory and understand the data we're writing
author: Meta
category: Computer Science
tags:
  - Programming
  - Memory Management
  - Videogames development
  - Endianness
  - Hexadecimal
series: Memory Management in C++
---

Welcome back to the series on {{ page.series }}!

In the previous post we tried to understand the big picture of what we're building on this series and discovered the pieces we'll be building to complete the system. In this post we'll dive into the code and start creating the foundation of our Memory Manager.

Are you ready?

## Obtaining memory

If you recall from the previous post, the basic concept for our manager was that we'd get a big chunk of memory and we'd deal with how it is sliced.

So, the idea is: during the program's startup we build our `MemoryManager`. It will, in turn, request enough memory to the OS via the `new` operator and keep the pointer to that memory. From then on, we can't perform new memory requests: we're doing it only once in a big chunk.

We could then create our `MemoryManager` definition with this behavior:

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
    unsigned char *m_memory;
    unsigned int m_totalBytesCount;
};
{% endhighlight %}

Note that `::new` refers to `operator new` that's defined in the global namespace: the standard one. It's called explicitly this way so we don't accidentally call other `operator new` that could've been defined in the scope chain.

An `unsigned char` can store values in the range `0..255` with a size of 1 byte and `m_memory` is a pointer to the first byte in an array with as many bytes as requested in the constructor. If we were to use this class as it is now, we'd be leaking memory. So we need to release the array we requested to the OS. Let's add that in the destructor:

{% highlight c++ %}
cMemoryManager::~cMemoryManager()
{
    ::delete [] m_memory;
    m_memory = nullptr;
}
{% endhighlight %}

And with this, we've got the start and end of the life cycle for the memory we'll be managing! But before we continue on with the `MemoryChunk`, we need some way to know we're doing it right.

## Dumping the contents

One of the most useful tools we want to have is the ability to dump the contents of the memory we're managing in a readable format. Something similar to those awesome hexadecimal editors. We'll use the most common format: a left column with the memory address, a central column with all of the bytes with an offset from that address and a right column with an ASCII representation of each byte. Let's define a `dump` method like so:

{% highlight c++ %}
std::string cMemoryManager::dump(unsigned int bytesPerRow) const
{
    const unsigned char *memoryIterator = m_memory;
    const unsigned char *characterIterator = m_memory;

    std::stringstream ss;

    // iterate over the memory
    for (; static_cast<unsigned int>(memoryIterator - m_memory) < m_totalBytesCount; memoryIterator += bytesPerRow)
    {
        // print left column
        ss << static_cast<const void *>(memoryIterator) << ":  ";

        // iterate over the row
        for (unsigned int charIndex = 0; charIndex < bytesPerRow; ++charIndex, ++characterIterator)
        {
            const unsigned int characterIteratorAsInt = static_cast<unsigned int>(*characterIterator);
            ss << std::uppercase << std::hex << std::setw(2) << std::setfill('0');

            // bytes in central column: general case
            if (charIndex < bytesPerRow - 1)
            {
                ss << characterIteratorAsInt << ":";
            }
            // bytes in central column: last item
            else
            {
                ss << characterIteratorAsInt << "  ";
                ss << std::nouppercase << std::dec;

                // get the string representation of the bytes in the row (right column)
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

Wow, long code this time! And a bit ugly due to the `operator<<` to deal with the `stringstream`! But don't panic, let's talk about how it works!

The idea is to iterate over the memory in small step of bytes at a time (as many as given in `bytesPerRow`, let's say 16). The start of each iteration marks the address of the first element in the row, so we can display that address in the first column.

Then, within the step of `bytesPerRow`, we display one byte at a time separated by the `:` character. We use `characterIteratorAsInt` for display purposes, if we were to use the gool old `printf` family we'd use `%02X` and pass the pointer to the byte instead of having an intermediate variable.

The last byte in the row also adds the string representation of the bytes in the row as the right column. It basically takes the address of the first element in the row, displays its string representation (or a `.` if it can't be printed) and then moves into the next byte within the same row until it's done.

Phew, not bad! Show me an example then! Assume we have this code:

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
000B6058:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000B6068:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000B6078:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000B6088:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

Please note that the addresses in the left column will change on each execution. The first byte in the first row has the address `0x000B6058`, and we're displaying 16 bytes per row. Each byte in the row would have offsets `+00`, `+01`, ..., `+0F` from the pointer in the left column. Let's illustrate this by manually adding a header row:

{% highlight text %}
Offset    +00:01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E:0F
000B6058:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000B6068:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000B6078:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000B6088:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

That's better!

As you can see, the memory is magically initialized to the `0xCD` value. That's because of the _kind_ MSVC in a Debug build. As we mentioned before, the `.` is used whenever the character doesn't have a string representation. MSVC uses the `0xCD` value to indicate it's clean memory, allocated and initialized.

What happens if we use Visual Studio with the **Release x86** configuration?

{% highlight text %}
00375B98:  38:9D:37:00:C8:6E:37:00:10:4C:37:00:10:4C:37:00  8.7..n7..L7..L7.
00375BA8:  10:4C:37:00:10:4C:37:00:10:4C:37:00:10:4C:37:00  .L7..L7..L7..L7.
00375BB8:  10:4C:37:00:10:4C:37:00:20:49:37:00:10:4C:37:00  .L7..L7. I7..L7.
00375BC8:  10:4C:37:00:10:4C:37:00:10:4C:37:00:10:4C:37:00  .L7..L7..L7..L7.
{% endhighlight %}

Wow, what is _THAT_? That's all thrash values from the memory we've received from the OS! Where did all of the `0xCD` values go? We're not in a Debug build anymore, so we are _on the wild_! Which brings me to another piece of advice:

**Always initialize your variables.**
{: .notice--primary}

And regularly test Release builds!

# Memory thrashing

Now that we've seen the difference between Debug and Release builds, another useful tool we'd like to have is a way of initializing memory for the different scenarios we'll come up with (memory we've just initialized, memory that was allocated in a chunk, memory that was returned to the manager, ...).

Let's make use of the knowledge we gained with the [X-Macros]({{ site.baseurl }}{% post_url 2017-05-05-x-macros %}) post (because, why not?) and define it as:

{% highlight c++ %}
#define MemoryManagerThrashingOptions \
    TO(NONE,                                                                0, 0xFF) \
    TO(ON_INITIALIZATION,                                              1 << 0, 0xCD) \
    TO(ON_ALLOCATION,                                                  1 << 1, 0xAA) \
    TO(ON_DEALLOCATION,                                                1 << 2, 0xDD) \
    TO(ON_ALL,            ON_INITIALIZATION | ON_ALLOCATION | ON_DEALLOCATION, 0xFF) \
{% endhighlight %}

_What's this sorcery?_, you may ask. Let's go through it.

We're defining five values to model a bitmask so we can store several values in only one variable: the one that defines when to apply memory thrashing. The `ON_ALL` value represents the combination of the three ones it references. If we were to use a binary representation for all of the values we'd get:

{% highlight text %}
NONE              -> 0000 (0)
ON_INITIALIZATION -> 0001 (1)
ON_ALLOCATION     -> 0010 (2)
ON_DEALLOCATION   -> 0100 (4)
ON_ALL            -> 0111 (7)
{% endhighlight %}

We're then creating two enumerations from this data: one to store the bitmask and one to store the thrashing value. And both enumerations come from the same data we shown in the macro. Let's define them as:

{% highlight c++ %}
enum class eThrashing
{
#define TO(ID, MASK, HEX_VALUE) ID = MASK,
    MemoryManagerThrashingOptions
#undef TO
};

enum class eThrashingValue
{
#define TO(ID, MASK, HEX_VALUE) ID = HEX_VALUE,
    MemoryManagerThrashingOptions
#undef TO
};
{% endhighlight %}

Now we can modify our constructor to receive the thrashing mask, so we can have different configurations:

{% highlight c++ %}
cMemoryManager(unsigned int bytes, eThrashing thrashing = eThrashing::ON_ALL);
{% endhighlight %}

And finally, we can apply it! Let's modify our constructor to check for this mask and apply the correct value:

{% highlight c++ %}
cMemoryManager::cMemoryManager(unsigned int bytes, eThrashing thrashing) :
    m_memory(nullptr),
    m_totalBytesCount(bytes),
    m_thrashing(thrashing)
{
    m_memory = ::new unsigned char[bytes];

    if (static_cast<int>(m_thrashing) & static_cast<int>(eThrashing::ON_INITIALIZATION))
    {
        memset(m_memory, static_cast<int>(eThrashingValue::ON_INITIALIZATION), m_totalBytesCount);
    }
}
{% endhighlight %}

Yeah, I know what you're thinking right now. _What on Earth are all those `static_cast<int>` for? What an ugly code!_

Well, we've used `enum class` to define the enumerations to have type safe values, but with it we've lost the implicit conversion to `int` (and that's a good thing!). However, since we're working with these typed values as a bitmask, we need to be able to use the `&` operator to check whether the flag is set and that operator isn't defined for enumerations.

Note that we've stored the mask for all of the thrashing we're performing in `m_thrashing`. Whenever we want to check if we have to apply thrashing, we check it against the `eThrashing` enumeration and then use the value in the `eThrashingValue` enumeration.

### Testing thrashing

Okay! Let's give it some runs!

#### Debug x86

{% highlight text %}
011ED6E0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
011ED6F0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
011ED700:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
011ED710:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

#### Release x86

{% highlight text %}
00F05C78:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00F05C88:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00F05C98:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00F05CA8:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

#### Debug x64

{% highlight text %}
000001E4A4F67100:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000001E4A4F67110:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000001E4A4F67120:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000001E4A4F67130:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

#### Release x64

{% highlight text %}
000001805267E6B0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000001805267E6C0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000001805267E6D0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
000001805267E6E0:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

It seems we've done it right! Congratulations :)

# Initial chunk

Remember we mentioned we were slicing our internal memory in small chunks of arbitrary size? We're getting ready to do that now! Let me remember the definition of our `MemoryChunk`:

{% highlight c++ %}
struct cMemoryChunk
{
    bool m_isInUse;
    unsigned int m_bytes;

    cMemoryChunk *m_previous;
    cMemoryChunk *m_next;
};
{% endhighlight %}

We've added two fields to the chunk: a flag to know if this chunk is free and the number of bytes in use for this chunk. There's nothing where we're storing the memory for this chunk, we'll see where that's happening in the next post.

If we were to use the `MemoryManager` as a traditional Doubly Linked List we'd have a pointer to the head and tail of the list (`MemoryChunk` nodes). However, because we're using the memory we're managing to store the chunks themselves, we'll store all nodes _in_ the managed memory (and just use the head for now)! And how will we do it?

## Introducing placement new

I guess that, by now, you are somewhat used to the `new` operator. You use it to request memory and build an object into the requested memory. However, there's another kind of `new` operator that doesn't request memory but uses an existent one to build the object in. That is the `placement new`. And what is the syntax for it?

{% highlight c++ %}
Class *c = new (pointer) Class(args);
{% endhighlight %}

Where `Class` is the class you want to build, `pointer` is a pointer to some writable memory and `args` is a collection of arguments to pass to the constructor.

With this in mind, we just need to build our first chunk in our memory! Let's add it to our constructor so it looks like:

{% highlight c++ %}
cMemoryManager::cMemoryManager(unsigned int bytes, eThrashing thrashing) :
    m_memory(nullptr),
    m_freeBytesCount(bytes - sizeof(cMemoryChunk)),
    m_totalBytesCount(bytes),
    m_thrashing(thrashing)
{
    m_memory = ::new unsigned char[bytes];

    // optional thrashing
    if (static_cast<int>(m_thrashing) & static_cast<int>(eThrashing::ON_INITIALIZATION))
    {
        memset(m_memory, static_cast<int>(eThrashingValue::ON_INITIALIZATION), m_totalBytesCount);
    }

    // first chunk
    new (m_memory) cMemoryChunk(m_freeBytesCount);
}
{% endhighlight %}

As you can see, we've added a new variable to our `MemoryManager` that holds the amount of memory that's still free to be used. We'll update it when we add allocations and deallocations.

Okay, let's check what happened to our memory now that we've added the chunk! Let's dump the contents of a x86 build:

{% highlight text %}
00137218:  00:CD:CD:CD:30:00:00:00:00:00:00:00:00:00:00:00  ....0...........
00137228:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00137238:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
00137248:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

Now the first row of the dump has data! But which data? Let's study it!  
It seems like we've used 16 bytes. Do you know what does `sizeof(cMemoryChunk)` yield in this build? Yeah, you guessed right: 16 bytes. Do you remember which members were defined in the `MemoryChunk` structure?

{% highlight c++ %}
struct cMemoryChunk
{
    bool m_isInUse;             // sizeof(bool)           == 1
    unsigned int m_bytes;       // sizeof(unsigned int)   == 4

    cMemoryChunk *m_previous;   // sizeof(cMemoryChunk *) == 4 (x86 build)
    cMemoryChunk *m_next;       // sizeof(cMemoryChunk *) == 4 (x86 build)
};
{% endhighlight %}

Woah, wait a second! If we sum up the individual sizes of the members we don't get the total of 16 bytes! That's because of _memory padding_.

We start our structure with a `bool`, which takes 1 byte. Then we have an `unsigned int`, which takes 4 bytes. The compiler will then add padding (extra bytes) before this member because their alignment requirements differ and the `unsigned int` one is larger than the `bool` one. That's why, in our case, we're spending 4 bytes to store a `bool` (and wasting 3 of them!).

What else can we learn from the first row of the dumped memory? Let's have a look at it again, but this time with the sizes we've seen separated:

{% highlight text %}
00:CD:CD:CD -> m_isInUse
30:00:00:00 -> m_bytes
00:00:00:00 -> m_previous
00:00:00:00 -> m_next
{% endhighlight %}

As we can see, there's some memory left unchanged with the `0xCD` value: the one used to pad members. `0x00 == 0`, which is our `false` value for the `m_isInUse` member. `0x30 == 48`, which is the correct number of free bytes we have in our memory (remember we have a total of 64 bytes and the chunk is 16 bytes). Both `m_previous` and `m_next` point to `nullptr`, which is `0x0000000`.

Finally, there's something else worth mentioning about the dump: the machine it was executed uses [little endian](https://en.wikipedia.org/wiki/Endianness) ordering. If we were to represent `48` in hexadecimal with 4 bytes we'd use `0x0000030`. However, we can see it's stored as `30:00:00:00`! In little endian architectures, the least significant byte is written first and the most significant one is written last. That's why we see it _flipped_ in memory.

I guess that's all for this entry in the series! I hope you're enjoying it! In the next post we'll start manipulating the chunks in our memory.

Thanks for reading!