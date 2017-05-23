---
layout: single
title: Finite State Machines
author: Meta
category: Computer Science
tags:
  - Programming
  - Design Patterns
---

Let's talk about some Computer Science, alright?  
In this _coding scar_ we'll cover the Gang of Four's [State pattern](https://en.wikipedia.org/wiki/State_pattern).

# StarCraft's harvester

Let's take the original StarCraft Terran's worker unit (the SCV) as an example. This unit can store two types of resource: minerals and gas. It can move through the map, gather resources, build new structures, ...

We'll simplify it so we can illustrate the concepts. We'll stick to this behavior for the most part:

  * Idle: just standing, doing nothing.
  * Moving to a point: the player has commanded it to move to a point, and it's on the way.
  * Moving to a target: very similar to the previous one, but will interact with the target when it arrives to it.
  * Gathering mineral/gas: resources are extracted periodically when gathering. The SCV will continue doing this until it reaches its full load.
  * Deposit resources: once the SCV reaches the correct building the loaded resources are periodically removed from the unit's tank.

You're about to roll up your sleeves when you notice you're missing something...

# Simple game loop

First of all, we need a game loop in which our SCV can live. We're oversimplifying it, so assume we've got this one:

{% highlight c++ %}
void logicUpdate(float deltaTime)
{
    scv.update(deltaTime);
}

int main()
{
    while (true)
    {
        float deltaTime = getDeltaTime();
        logicUpdate(deltaTime);
    }

    return 0;
}
{% endhighlight %}

And let's say we define our SCV as:

{% highlight c++ %}
class SCV
{
public:
    void update(float deltaTime)
    {
        // do stuff
    }
};
{% endhighlight %}

Still with me? Let's get our hands dirty!

# Naive implementation

Okay, you now know the behavior of the unit and the game loop in which it will exist. And then you start thinking about how we're making this unit work. Let's explore the first thoughts step by step.

### Idle

Arguably the easier part of the behavior: the SCV can be standing still doing nothing. Okay, so we fill in our `SCV::update` function like so:

{% highlight c++ %}
void update(float deltaTime)
{
    // Idle: do nothing
}
{% endhighlight %}

Phew, not bad.

### Moving to a point

Since we're simplifying it, say we've got a way to define points in our world and a way for the unit to move there. You throw some code in and you've got:

{% highlight c++ %}
void update(float deltaTime)
{
    if(m_movingToPoint)
    {
        if (reachedPoint(m_point))
        {
            m_movingToPoint = false;
        }
        else
        {
            moveTowards(m_point);
        }
    }
    else
    {
        // ...
    }
}
{% endhighlight %}

Let's assume methods `reachedPoint` and `moveTowards` do what their names imply, performing the necessary calculations that we're skipping so we stay in track.

Okay, so now the unit can move and stay idle. What's next?

### Moving to target

Assume our target is an entity in our hypothetical world. The resources this unit has to collect and the buildings where those resources can be deposited would be those entities. We don't mind if our architecture is component-based or hierarchy-based or whatever the case is. We're assuming our SCV can `interact` with one of these `Entity`. One could then do:

{% highlight c++ %}
void update(float deltaTime)
{
    if(m_movingToPoint)
    {
        // ...
    }
    else if (m_movingToTarget)
    {
        if (reachedPoint(m_targetEntity->getPos()))
        {
            m_movingToTarget = false;
            interactWith(m_targetEntity);
        }
        else
        {
            moveTowards(m_targetEntity);
        }
    }
    else
    {
        // ...
    }
}
{% endhighlight %}

This is starting to smell a little, huh? Let's see how the remaining pieces would look like.

### Gathering and depositing resources

Okay, we've got our SCV moving through the world and interacting with stuff. Let's say it can interact with two types of entities: resources and building to deposit them. Let's also assume it takes some time for the unit to fill its tank up and to empty it out. Something like:

{% highlight c++ %}
void update(float deltaTime)
{
    if(m_movingToPoint)
    {
        // ...
    }
    else if (m_movingToTarget)
    {
        // ...
    }
    else if (m_gatheringResource)
    {
        m_gatheringTimeLeft -= deltaTime;
        if (m_gatheringTimeLeft <= 0.0f)
        {
            fillUpTank();
            m_gatheringResource = false;
            moveTowards(getResourceBuilding());
        }
    }
    else if (m_depositingResource)
    {
        // analogous to the previous one
    }
    else
    {
        // ...
    }
}
{% endhighlight %}

Take a look at this function. It isn't close to being beautiful: it's long, performs a lot of different logic, it's got a lot of nesting... We can do better!

# Stateless states

Gang of Four's State pattern defines that a given class has an instance of a state to which the logic is delegated. But before we implement the real object-oriented pattern, let's create a hybrid with the imperative approach. While it might not look as useful for now, it will help us to better understand the program's flow.

The previous `update` function was tangled, so our goal is to basically keep the same function but cut into different pieces.

Let's define a `State` as:

{% highlight c++ %}
struct State
{
    typedef std::function<void(SCV*, float)> TOnUpdate;

    State(TOnUpdate onUpdate) : m_onUpdate(onUpdate)
    {
    }

    TOnUpdate m_onUpdate;
};
{% endhighlight %}

This is a _stateless_ state: it doesn't hold any data, just a pointer to its _update_ function provided during construction. The only thing we're missing is the delegation of the `update` function to the current state's:

{% highlight c++ %}
void update(float deltaTime)
{
    m_state->m_onUpdate(this, deltaTime);
}
{% endhighlight %}

Alright! And how do we change states? We could define a simple method that sets them, nothing fancy:

{% highlight c++ %}
void setState(State *state)
{
    delete m_state;
    m_state = state;
}
{% endhighlight %}

Now we can create and set states with different update functions to control flow. Something like:

{% highlight c++ %}
SCV()
{
    setState(new State(&SCV::updateIdle));
}

void updateIdle(float deltaTime)
{
    // ...
}

void updateMovingToPoint(float deltaTime)
{
    if (reachedPoint(m_point))
    {
        setState(new State(&SCV::updateIdle));
    }
    else
    {
        moveTowards(m_point);
    }
}

void updateGathering(float deltaTime)
{
    // ...
}
{% endhighlight %}

You get the point.

Okay, but still this code has a major flaw we want to solve: all member variables are potentially shared between states (not to mention creating and destroying states everytime!). What if we explore the real Gang of Four's State pattern already?

# Stateful states
# Finite State Machines
# Hierarchical State Machines