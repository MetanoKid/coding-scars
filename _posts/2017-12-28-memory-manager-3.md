---
layout: single
title: "Memory Management in C++: deallocation"
excerpt: Continues the series with the basic memory deallocation for the manager
author: Meta
category: Computer Science
tags:
  - Programming
  - Memory Management
  - Videogames development
  - Memory leaks
series: Memory Management in C++
---

Hello again, reader, and welcome back to the series on Memory Management in C++!

In the previous post we went through the process of a basic allocation for our Memory Manager. Via memory dumps, we checked how the memory was laid out as we kept performing allocations. This time we'll find out how to recover that memory and avoid memory leaks.

Ready, set, go!

# Memory after some allocations

If you remember from last post, we ended up having this test case:

{% highlight c++ %}
cMemoryManager memoryManager(80);

void *firstAllocation = memoryManager.allocate(sizeof(unsigned int));
void *secondAllocation = memoryManager.allocate(sizeof(int) * 4);

std::cout << memoryManager.dump() << std::endl;

unsigned int *firstAsUInt = static_cast<unsigned int *>(firstAllocation);
int *secondAsInt = static_cast<int *>(secondAllocation);

*firstAsUInt = 100000000;
secondAsInt[0] = 10;
secondAsInt[2] = -10;

std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

And that yielded this memory layout:

{% highlight text %}
0106CFF8:  01:CD:CD:CD:04:00:00:00:00:00:00:00:0C:D0:06:01  ................
0106D008:  AA:AA:AA:AA:01:CD:CD:CD:10:00:00:00:F8:CF:06:01  ................
0106D018:  2C:D0:06:01:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA  ,...............
0106D028:  AA:AA:AA:AA:00:CD:CD:CD:0C:00:00:00:0C:D0:06:01  ................
0106D038:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................

0106CFF8:  01:CD:CD:CD:04:00:00:00:00:00:00:00:0C:D0:06:01  ................
0106D008:  00:E1:F5:05:01:CD:CD:CD:10:00:00:00:F8:CF:06:01  ................
0106D018:  2C:D0:06:01:0A:00:00:00:AA:AA:AA:AA:F6:FF:FF:FF  ,...............
0106D028:  AA:AA:AA:AA:00:CD:CD:CD:0C:00:00:00:0C:D0:06:01  ................
0106D038:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

Graphically, it means we've got this scenario:

![Memory after some allocations]({{ '/' | absolute_url }}/assets/images/per-post/memory-manager-3/memory-after-allocations.png){: .align-center}

So, let's try to find out how we can deallocate these chunks!

# Deallocation signature

First of all, we need to know what's the signature of our deallocation function. How about this one?

{% highlight c++ %}
void deallocate(void *address);
{% endhighlight %}

We only take a pointer to memory, which should have been previously returned by a call to `allocate`.

# Deallocation method

The idea is as follows: ensure we've received a valid pointer, find the chunk that contains that memory and deallocate it. Or, in code:

{% highlight c++ %}
void cMemoryManager::deallocate(void *address)
{
    const unsigned char *addressToDeallocate = static_cast<unsigned char *>(address);

    bool isInRange = isAddressInMemoryRange(addressToDeallocate);
    if (isInRange)
    {
        cMemoryChunk *chunk = findChunkForUserMemory(addressToDeallocate);
        if (chunk != nullptr)
        {
            deallocateChunk(chunk);
        }
    }
}
{% endhighlight %}

Let's now find out what these methods do individually.

## Range check

So, first of all, we've got to implement `isAddressInMemoryRange`. Because we're the ones managing the memory, we know where that memory starts and how many chunks it's divided into.

Let's use this knowledge to decide whether the given `address` is even part of our managed memory.

{% highlight c++ %}
bool cMemoryManager::isAddressInMemoryRange(const unsigned char *address) const
{
    // deallocating nullptr is allowed, we just do nothing
    if (address == nullptr)
    {
        return false;
    }

    // is it in range of our controlled memory?
    if (address < m_memory || address >= m_memory + m_totalBytesCount)
    {
        return false;
    }

    // is it within the first chunk header?
    if (address - sizeof(cMemoryChunk) < m_memory)
    {
        return false;
    }

    return true;
}
{% endhighlight %}

Alright, step by step!

We're allowing calls to `deallocate` with a pointer that's `nullptr`. This is part of C99 standard in the `free` function, so we'll use it as well.

Next, we check whether the pointer we've received is in the range of our managed memory. We know where it starts, we know how long it is, so we can compare those with the given pointer because they're just numbers (memory positions).

Finally, we also check the pointer isn't within the first memory chunk header: no user memory can be part of a chunk header.

## Find chunk

Now we know the address is in fact part of our managed memory, it's time to find which chunk it belongs to. Remember that, in this approach we're using, user memory is laid out right after its chunk header.

So, we need to iterate over the chunks we've got until we find the one that contains this address.

{% highlight c++ %}
cMemoryChunk *cMemoryManager::findChunkForUserMemory(const unsigned char *address) const
{
    // iterate over chunks to find whether the pointer is a valid chunk
    cMemoryChunk *chunk = reinterpret_cast<cMemoryChunk *>(m_memory);
    const unsigned int chunkSize = sizeof(cMemoryChunk);

    while (chunk != nullptr)
    {
        const unsigned char *chunkAddress = reinterpret_cast<unsigned char *>(chunk);

        // is the given pointer at an invalid address (mid-chunk, mid-user memory)
        if (address < chunkAddress)
        {
            return nullptr;
        }

        // is this chunk the one that holds the memory we're given?
        if (chunkAddress + chunkSize == address)
        {
            // we found the chunk, and it must be in use so we can deallocate it!
            if (!chunk->m_isInUse)
            {
                return nullptr;
            }

            break;
        }

        chunk = chunk->m_next;
    }

    return chunk;
}
{% endhighlight %}

Again, when we want to iterate over chunks we have to `reinterpret_cast<cMemoryChunk>` the pointer to the raw memory we manage so we can access its members more easily.

A valid pointer is the one whose chunk header is located at `address - sizeof(cMemoryChunk)` or, graphically:

![Valid user memory pointer]({{ '/' | absolute_url }}/assets/images/per-post/memory-manager-3/valid-user-memory-pointer.png){: .align-center}

Oh, and don't forget a valid chunk to deallocate is the one that's already in use! We can't deallocate a free one.

## Naive deallocation

Alright, so now that we've found the chunk we want to deallocate, it's time to perform the deallocation itself! How do we do it?

What makes one of our chunks be _allocated_? You guessed right, the `m_isInUse` member! We could implement `deallocateChunk` like so:

{% highlight c++ %}
void cMemoryManager::deallocateChunk(cMemoryChunk *chunk)
{
    chunk->m_isInUse = false;
}
{% endhighlight %}

Boom! Deallocated! So easy!

Or is it?

# Testing deallocation

Okay, now that we've implemented the `deallocate` method it's time to test it out. Let's perform some tests.

## Testing range checks

Let's do this:

{% highlight c++ %}
cMemoryManager memoryManager(48);

void *allocatedMemory = memoryManager.allocate(sizeof(int));
int *allocatedInt = static_cast<int *>(allocatedMemory);
*allocatedInt = 145;

std::cout << memoryManager.dump() << std::endl;

unsigned char *rawAllocatedMemory = static_cast<unsigned char *>(allocatedMemory);
memoryManager.deallocate(nullptr);                    // nullptr
memoryManager.deallocate(rawAllocatedMemory - 1);     // mid chunk header
memoryManager.deallocate(rawAllocatedMemory + 1);     // mid user data
memoryManager.deallocate(rawAllocatedMemory - 60000); // out of range
memoryManager.deallocate(rawAllocatedMemory + 60000); // out of range

std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

Which dumps:

{% highlight text %}
00680510:  01:CD:CD:CD:04:00:00:00:00:00:00:00:24:05:68:00  ............$.h.
00680520:  91:00:00:00:00:CD:CD:CD:0C:00:00:00:10:05:68:00  ..............h.
00680530:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................

00680510:  01:CD:CD:CD:04:00:00:00:00:00:00:00:24:05:68:00  ............$.h.
00680520:  91:00:00:00:00:CD:CD:CD:0C:00:00:00:10:05:68:00  ..............h.
00680530:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

As you can see, the memory is left untouched as all of the range checks didn't allow the deallocation algorithm to continue. Great job!

## Testing naive deallocation

What about this one?

{% highlight c++ %}
cMemoryManager memoryManager(48);

void *allocatedMemory = memoryManager.allocate(sizeof(int));
int *allocatedInt = static_cast<int *>(allocatedMemory);
*allocatedInt = 145;
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(allocatedMemory);
std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

{% highlight text %}
03231978:  01:CD:CD:CD:04:00:00:00:00:00:00:00:8C:19:23:03  ..............#.
03231988:  91:00:00:00:00:CD:CD:CD:0C:00:00:00:78:19:23:03  ............x.#.
03231998:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................

03231978:  00:CD:CD:CD:04:00:00:00:00:00:00:00:8C:19:23:03  ..............#.
03231988:  91:00:00:00:00:CD:CD:CD:0C:00:00:00:78:19:23:03  ............x.#.
03231998:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
{% endhighlight %}

Okay, has anything changed? You are right, `0x03231978` had value `0x01` and now it has `0x00` which is the `m_isInUse` member of our chunk header! Awesome!

## Allocating after deallocation

Okay, let's now allocate again after a deallocation to see how it behaves:

{% highlight c++ %}
cMemoryManager memoryManager(64);

void *firstAllocatedMemory = memoryManager.allocate(sizeof(int));
int *firstAllocatedInt = static_cast<int *>(firstAllocatedMemory);
*firstAllocatedInt = 145;
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(firstAllocatedMemory);
std::cout << memoryManager.dump() << std::endl;

void *secondAllocatedMemory = memoryManager.allocate(sizeof(int) * 2);
int *secondAllocatedInt = static_cast<int *>(secondAllocatedMemory);
secondAllocatedInt[0] = 4;
secondAllocatedInt[1] = 8;
std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

{% highlight text %}
0285DC40:  01:CD:CD:CD:04:00:00:00:00:00:00:00:54:DC:85:02  ............T...
0285DC50:  91:00:00:00:00:CD:CD:CD:1C:00:00:00:40:DC:85:02  ............@...
0285DC60:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
0285DC70:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................

0285DC40:  00:CD:CD:CD:04:00:00:00:00:00:00:00:54:DC:85:02  ............T...
0285DC50:  91:00:00:00:00:CD:CD:CD:1C:00:00:00:40:DC:85:02  ............@...
0285DC60:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................
0285DC70:  CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................

0285DC40:  00:CD:CD:CD:04:00:00:00:00:00:00:00:54:DC:85:02  ............T...
0285DC50:  91:00:00:00:01:CD:CD:CD:08:00:00:00:40:DC:85:02  ............@...
0285DC60:  6C:DC:85:02:04:00:00:00:08:00:00:00:00:CD:CD:CD  l...............
0285DC70:  04:00:00:00:54:DC:85:02:00:00:00:00:CD:CD:CD:CD  ....T...........
{% endhighlight %}

What's up this time? The first dump shows the first allocation:

{% highlight text %}
m_isInUse   m_bytes     m_previous  m_next           user data
---------   -------     ----------  ------           ---------
01:CD:CD:CD 04:00:00:00 00:00:00:00 54:DC:85:02      91:00:00:00
00:CD:CD:CD 1C:00:00:00 C0:04:8A:00 00:00:00:00      -
{% endhighlight %}

While the second one shows the same thing with a `0x00` in the `m_isInUse` member for the first chunk.

However, the third one shows this layout:

{% highlight text %}
m_isInUse   m_bytes     m_previous  m_next           user data
---------   -------     ----------  ------           ---------
00:CD:CD:CD 04:00:00:00 00:00:00:00 54:DC:85:02      -
01:CD:CD:CD 08:00:00:00 40:DC:85:02 6C:DC:85:02      04:00:00:00 08:00:00:00
00:CD:CD:CD 04:00:00:00 54:DC:85:02 00:00:00:00      -
{% endhighlight %}

Or, graphically, we have this:

![Fragmented memory]({{ '/' | absolute_url }}/assets/images/per-post/memory-manager-3/fragmented-memory.png){: .align-center}

So, before performing the second allocation we had a free chunk with 4 bytes, and another free chunk with 28 bytes. We wanted to allocate 8 bytes, which couldn't fit in the first free chunk so we had to carve them out of the second one.

Now we have three chunks: a free one with 4 bytes, an in-use one with 8 bytes and a free one with 4 bytes. Or:

{% highlight text %}
3 x chunk headers (16 B) + 4 B (free) + 8 B (in-use) + 4 B (free) = 64 B
{% endhighlight %}

What if we now `deallocate` this second chunk? What will be the memory layout then?

# Memory fragmentation

If we continued allocating and deallocating chunks we'd end up having a lot of free chunks with different sizes. It is sure to happen that, eventually, we'll try to allocate a number of bytes but no existent chunk would have enough free ones to hold them. Even if all of the chunks were set as free!

When this happens, we say the memory is _fragmented_. We need to try to avoid this situation as much as we can or we'll be, in fact, wasting memory. Can you think of a way of reducing fragmentation?

# Deallocation revisited

Let's reimplement `deallocateChunk` with another strategy: try to merge any preceding and following chunks which are free. This way, we avoid having two free chunks next to each other and maximize the memory we're recovering from a deallocation.

## Preceding chunk

{% highlight c++ %}
void cMemoryManager::deallocateChunk(cMemoryChunk *chunk)
{
    const unsigned int chunkSize = sizeof(cMemoryChunk);

    cMemoryChunk *chunkToStartDeallocation = chunk;
    cMemoryChunk *previousChunk = chunk->m_previous;
    cMemoryChunk *nextChunk = chunk->m_next;
    unsigned int newChunkFreeBytes = chunk->m_bytes;

    // update total free bytes count
    m_freeBytesCount += chunk->m_bytes;

    // got a free chunk before it?
    if (previousChunk != nullptr && !previousChunk->m_isInUse)
    {
        chunkToStartDeallocation = previousChunk;
        previousChunk = previousChunk->m_previous;

        // we're using the bytes from the previous chunk
        newChunkFreeBytes += chunkToStartDeallocation->m_bytes;

        // also merging the header of the given chunk
        newChunkFreeBytes += chunkSize;

        // we've merged one chunk header
        // that's memory we didn't consider free until now
        m_freeBytesCount += chunkSize;
    }

    // ...
{% endhighlight %}

This time, this code is a bit harder to understand. Let's read it thoroughly.

First of all, we know this `cMemoryManager` acts as a [Doubly Linked List](https://en.wikipedia.org/wiki/Doubly_linked_list){:target="_blank"}. That means we've got a pointer to the previous chunk and another one to the next chunk. We must keep them pointing to the right places at all times.

When deallocating, we want to get the _left most_ chunk that's free (the one we're deallocating or its previous one) and know the number of bytes until the next in-use chunk. In `chunkToStartDeallocation` we store the _left most_ free chunk; in `previousChunk` we store the one previous to that.

As for the free bytes, we're recovering the in-use ones from the chunk we're given. When we have a free previous chunk, we also recover its bytes (which are already free) and our chunk header as it's being merged. A picture is worth a thousand words, so:

![Merging previous chunk]({{ '/' | absolute_url }}/assets/images/per-post/memory-manager-3/merging-previous-chunk.png){: .align-center}

Let's do the same with the next chunk, if there's any.

## Following chunk

{% highlight c++ %}
    // ...

    // got a free chunk after it?
    if (nextChunk != nullptr)
    {
        nextChunk->m_previous = chunkToStartDeallocation;

        if (!nextChunk->m_isInUse)
        {
            // we're recovering all of the bytes from the chunk, plus its header
            newChunkFreeBytes += nextChunk->m_bytes + chunkSize;

            // update pointers
            nextChunk = nextChunk->m_next;
            if (nextChunk != nullptr)
            {
                nextChunk->m_previous = chunkToStartDeallocation;
            }

            chunkToStartDeallocation->m_next = nextChunk;

            // we've merged one chunk header
            // that's memory we didn't consider free until now
            m_freeBytesCount += chunkSize;
        }
    }

    // ...
{% endhighlight %}

As opposed to the previous chunk, which is guaranteed to exist because of the way we're creating the chunks, we might not have a next chunk. If that happens, it means we're the last in the list of chunks.

When we have a following chunk, we have to let it know which chunk is its previous one (might have changed if we merged with the preceding one). Then, we might have to merge it as well if it's free.

When merging with the next chunk we have to update their pointers and take note of how many bytes we're recovering. Again, as many bytes as that chunk had (already free) and the header as we're merging it. Put it graphically, it is:

![Merging next chunk]({{ '/' | absolute_url }}/assets/images/per-post/memory-manager-3/merging-next-chunk.png){: .align-center}

Phew, we've wired everything together, so what is left?

## Creating free chunk

Finally, we have to create a new free chunk starting at the _left most_ free chunk and spanning as many bytes as necessary to fill the merged ones.

{% highlight c++ %}
    // ...
    
    // build a new free chunk
    unsigned char *freeChunkAddress = reinterpret_cast<unsigned char *>(chunkToStartDeallocation);
    cMemoryChunk *freeChunk = new (freeChunkAddress) cMemoryChunk(newChunkFreeBytes);

    // update pointers
    freeChunk->m_previous = previousChunk;
    freeChunk->m_next = nextChunk;

    // ...
{% endhighlight %}

Nice, now our chunk points to the correct chunks and everything is tied up together.

## Bonus: trashing on deallocation

Remember we had the ability to fill memory with some data so we can see the _state_ of the memory when dumping the contents? We can do the same when deallocating!

{% highlight c++ %}
    // ...

    // trashing on deallocation?
    if (static_cast<int>(m_trashing) & static_cast<int>(eTrashing::ON_DEALLOCATION))
    {
        memset(freeChunkAddress + chunkSize, static_cast<int>(eTrashingValue::ON_DEALLOCATION), freeChunk->m_bytes);
    }
}
{% endhighlight %}

And that's it! We'll have the _newly-free_ bytes set to the given mask (`0xDD` in our case).

Should we put it to the test? _Yes, we should._

# Testing deallocation, again

This time, we'll test several scenarios in an attempt to cover all cases.

## Test: single chunk

{% highlight c++ %}
cMemoryManager memoryManager(48);

void *firstAllocatedMemory = memoryManager.allocate(sizeof(int));
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(firstAllocatedMemory);
std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

{% highlight text %}
00986410:  01:CD:CD:CD:04:00:00:00:00:00:00:00:24:64:98:00  ............$d..
00986420:  AA:AA:AA:AA:00:CD:CD:CD:0C:00:00:00:10:64:98:00  .............d..
00986430:  00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD:CD  ................

00986410:  00:CD:CD:CD:20:00:00:00:00:00:00:00:00:00:00:00  .... ...........
00986420:  DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
00986430:  DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
{% endhighlight %}

In the first dump we see what we're used to: an in-use chunk with 4 bytes, no previous chunk and a next pointer to another chunk that's free. This time, we're not using the memory we're allocating, hence those `0xAA` bytes you can see (our trashing mask when allocating).

What about the second dump? We've got a single chunk with its `m_isInUse` member set to `false`, `0x20` free bytes, previous and next chunk pointers are set to `nullptr`. Then, all of those 32 free bytes are set to `0xDD`: our trashing mask on deallocation so we can see it better.

That means we've merged together the chunk we've deallocated and the trailing free one.

Great job, test passed!

## Test: two chunks, deallocate head

{% highlight c++ %}
cMemoryManager memoryManager(64);

void *firstAllocatedMemory = memoryManager.allocate(sizeof(int));
void *secondAllocatedMemory = memoryManager.allocate(sizeof(int));
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(firstAllocatedMemory);
std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

{% highlight text %}
006A07D0:  01:CD:CD:CD:04:00:00:00:00:00:00:00:E4:07:6A:00  ..............j.
006A07E0:  AA:AA:AA:AA:01:CD:CD:CD:04:00:00:00:D0:07:6A:00  ..............j.
006A07F0:  F8:07:6A:00:AA:AA:AA:AA:00:CD:CD:CD:08:00:00:00  ..j.............
006A0800:  E4:07:6A:00:00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD  ..j.............

006A07D0:  00:CD:CD:CD:04:00:00:00:00:00:00:00:E4:07:6A:00  ..............j.
006A07E0:  DD:DD:DD:DD:01:CD:CD:CD:04:00:00:00:D0:07:6A:00  ..............j.
006A07F0:  F8:07:6A:00:AA:AA:AA:AA:00:CD:CD:CD:08:00:00:00  ..j.............
006A0800:  E4:07:6A:00:00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD  ..j.............
{% endhighlight %}

The first dump shows three chunks: an in-use one with 4 bytes (not modified, still with `0xAA`), an in-use one also with 4 bytes (also not modified, still with `0xAA`) and a free trailing one with 8 free bytes.

We deallocate the first allocation, so the first chunk now appears as free and its 4 bytes are set to `0xDD`. Because we didn't merge anything, all pointers are left untouched and we have: free chunk with 4 bytes, in-use chunk with 4 bytes, free chunk with 8 bytes.

One more?

## Test: two chunks, deallocate tail

{% highlight c++ %}
cMemoryManager memoryManager(64);

void *firstAllocatedMemory = memoryManager.allocate(sizeof(int));
void *secondAllocatedMemory = memoryManager.allocate(sizeof(int));
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(secondAllocatedMemory);
std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

{% highlight text %}
0328B328:  01:CD:CD:CD:04:00:00:00:00:00:00:00:3C:B3:28:03  ............<.(.
0328B338:  AA:AA:AA:AA:01:CD:CD:CD:04:00:00:00:28:B3:28:03  ............(.(.
0328B348:  50:B3:28:03:AA:AA:AA:AA:00:CD:CD:CD:08:00:00:00  P.(.............
0328B358:  3C:B3:28:03:00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD  <.(.............

0328B328:  01:CD:CD:CD:04:00:00:00:00:00:00:00:3C:B3:28:03  ............<.(.
0328B338:  AA:AA:AA:AA:00:CD:CD:CD:1C:00:00:00:28:B3:28:03  ............(.(.
0328B348:  00:00:00:00:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
0328B358:  DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
{% endhighlight %}

This test is basically the same as the first one, but this time we have a preceding chunk. That chunk is left untouched as our deallocated chunk is merged with the trailing one into a bigger chunk with `0x1C` free bytes.

## Test: two chunks, deallocate head then tail

This time, let's mix them together, in an attempt to perform a double merge in a single deallocation.

{% highlight c++ %}
cMemoryManager memoryManager(64);

void *firstAllocatedMemory = memoryManager.allocate(sizeof(int));
void *secondAllocatedMemory = memoryManager.allocate(sizeof(int));
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(firstAllocatedMemory);
std::cout << memoryManager.dump() << std::endl;

memoryManager.deallocate(secondAllocatedMemory);
std::cout << memoryManager.dump() << std::endl;
{% endhighlight %}

{% highlight text %}
005E7230:  01:CD:CD:CD:04:00:00:00:00:00:00:00:44:72:5E:00  ............Dr^.
005E7240:  AA:AA:AA:AA:01:CD:CD:CD:04:00:00:00:30:72:5E:00  ............0r^.
005E7250:  58:72:5E:00:AA:AA:AA:AA:00:CD:CD:CD:08:00:00:00  Xr^.............
005E7260:  44:72:5E:00:00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD  Dr^.............

005E7230:  00:CD:CD:CD:04:00:00:00:00:00:00:00:44:72:5E:00  ............Dr^.
005E7240:  DD:DD:DD:DD:01:CD:CD:CD:04:00:00:00:30:72:5E:00  ............0r^.
005E7250:  58:72:5E:00:AA:AA:AA:AA:00:CD:CD:CD:08:00:00:00  Xr^.............
005E7260:  44:72:5E:00:00:00:00:00:CD:CD:CD:CD:CD:CD:CD:CD  Dr^.............

005E7230:  00:CD:CD:CD:30:00:00:00:00:00:00:00:00:00:00:00  ....0...........
005E7240:  DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
005E7250:  DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
005E7260:  DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD:DD  ................
{% endhighlight %}

We already know what the first two dumps are about, so let's skip them.

In the third dump we've performed the double merge: a chunk which had free previous and next chunks. So, we have a single free chunk with `0x30` free bytes and whose previous and next chunks are `nullptr`. Those 48 free bytes are trashed to `0xDD`, and everyone is happy!

Awesome job!

---

So that's it! Now we know how to deallocate memory from our manager!

As usual, you can find the code we've used for this entry [here](https://github.com/{{ site.repository }}/tree/master/assets/code-samples/per-post/memory-manager-3){:target="_blank"}.

Thanks again for your time!