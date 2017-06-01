---
layout: single
title: State Pattern
author: Meta
category: Computer Science
tags:
  - Programming
  - Design Patterns
  - Finite State Machines
  - Gang of Four
---

In this _coding scar_ we'll talk about one of the Gang of Four's object-oriented patterns: the [State pattern](https://en.wikipedia.org/wiki/State_pattern).

You are programming a [RTS](https://en.wikipedia.org/wiki/Real-time_strategy) videogame with some AIs. One of those is a basic unit: the harvester. You decide to find _inspiration_ in other videogames, and you come across StarCraft.

# StarCraft's harvester

The original StarCraft Terran's worker unit (the SCV) can store resources (minerals and gas). It can move through the map, gather those resources, build new structures, ...

We'll simplify it so we can illustrate the concepts. This is the behavior we're interested in, for now:

  * Idle: just standing, doing nothing.
  * Moving to a point: the player has commanded it to move to a point, and it's on the way.
  * Moving to a target: very similar to the previous one, but will interact with the target when it arrives to it.
  * Gathering mineral/gas: resources are extracted periodically when gathering. The SCV will continue doing this until it reaches its full load.
  * Deposit resources: once the SCV reaches the correct building the loaded resources are periodically removed from the unit's tank.

Now you know what your unit will be doing, and because you _think_ you know how to implement it, you start your favourite IDE and start coding right away.

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

Easy peasy. What's next?

# Naive implementation

You believe you can code this unit's behavior without designing it first, so you start thinking about the parts of the behaviour one by one.

### Idle

Arguably the easier part: the SCV can be standing still doing nothing. Okay, so we fill in our `SCV::update` function like so:

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

Okay, so now the unit can move and stay idle. You are on fire. _Who needs to design their systems, anyway?_ What's next?

### Moving to target

Assume our target is an entity in our hypothetical world. The resources this unit has to collect and the buildings where those resources can be deposited would be those entities. We don't mind if our architecture is component-based or hierarchy-based or whatever. We're assuming our SCV can `interact` with one of these `Entity`. One could then have:

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

This is starting to smell a little, huh? But you are tough and a little smell isn't turning you out.

### Gathering and depositing resources

Okay, we've got our SCV moving through the world and interacting with stuff. Let's say it can interact with two types of entities: resources and buildings to deposit them. Let's also assume it takes some time for the unit to fill its tank up and to empty it out. Something like:

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

Take a look at this function. It isn't close to being beautiful: it's long, performs a lot of different logic, it's got a lot of nesting... We can do better! But before you can think of a better way, you realize you can't command your unit to do anything.

### Interaction

Say our unit has a way of taking commands and we don't mind where those commands come from (user interaction, other systems within the game, the unit itself, ...). You roll up your sleeves and create this sample hierarchy:

{% highlight c++ %}
struct Action
{
    virtual unsigned int getID() const = 0;
};

struct MoveToPointAction : public Action
{
    MoveToPointAction(const Vector2 &point) :
        Action(), m_point(point)
    {
    }

    Vector2 m_point;
};
{% endhighlight %}

And now the method in your unit to execute these actions:

{% highlight c++ %}
void executeAction(const Action *action)
{
    if (auto moveToPoint = rtti_cast<const MoveToPointAction *>(action))
    {
        if (!m_depositingResource && !m_gatheringResource)
        {
            if (m_movingToTarget)
            {
                m_movingToTarget = false;
                m_targetEntity = nullptr;
            }

            m_point = moveToPoint->m_point;
            m_movingToPoint = true;
        }
    }
}
{% endhighlight %}

Ugh.

For clarification, we cast the action we've been passed to get the `Action` we're interested in (suppose _rtti_cast_ is your very own RTTI implementation, or just uses _dynamic_cast_, we don't mind).

That's just one of the actions the unit can take! It can also `MoveToEntity` or even `FleeFromTarget` if an enemy is coming. Now you take a deep breath and remember your old self not designing the system with some pen and paper.

Let's start again. Mostly.

# Stateless states

Gang of Four's State pattern defines that a given class has an instance of a `State` to which the logic is delegated. But before we implement the real object-oriented pattern, let's create a hybrid with an imperative approach. While it might not look as useful for now, it will help us to better understand the program's flow.

The previous `update` and `executeAction` functions were tangled, so our goal is to basically keep the same functions but cut into different pieces.

Let's define a `State` as:

{% highlight c++ %}
struct State
{
    typedef std::function<void(SCV*, float)> TOnUpdate;
    typedef std::function<void(SCV*, const Action *)> TOnAction;

    State(TOnUpdate onUpdate, TOnAction onAction) :
        m_onUpdate(onUpdate), m_onAction(onAction)
    {
    }

    TOnUpdate m_onUpdate;
    TOnAction m_onAction;
};
{% endhighlight %}

This is a _stateless_ state: it doesn't hold any data, just a pointer to its `update` and `executeAction` functions provided during construction. The only thing we're missing is the delegation of the `SCV::update` and `SCV::executeAction` functions to the current state's:

{% highlight c++ %}
void update(float deltaTime)
{
    m_state->m_onUpdate(this, deltaTime);
}

void executeAction(const Action *action)
{
    m_state->m_onAction(this, action);
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

Now we can create and set states with different functions to control flow. Something like:

{% highlight c++ %}
SCV()
{
    setState(new State(&SCV::updateOnIdle, &SCV::executeActionOnIdle));
}

void updateOnIdle(float deltaTime)
{
    // ...
}

void executeActionOnIdle(const Action *action)
{
    if (auto moveToPoint = rtti_cast<const MoveToPointAction *>(action))
    {
        m_point = moveToPoint->m_point;
        setState(new State(&SCV::updateOnMovingToPoint,
                           &SCV::executeActionOnMovingToPoint));
    }
}

void updateMovingToPoint(float deltaTime)
{
    if (reachedPoint(m_point))
    {
        setState(new State(&SCV::updateOnIdle,
                           &SCV::executeActionOnIdle));
    }
    else
    {
        moveTowards(m_point);
    }
}
{% endhighlight %}

You get the point.

Okay, but still this code has a major flaw we want to solve: all member variables are potentially shared between states (not to mention creating and destroying states everytime!).

What if we explore the real Gang of Four's State pattern already?

# Stateful states

As with all of the Gang of Four's patterns, we're going for a full object-oriented design: each state will become a class on its own that handles the logic in one part of the behavior. As before, we'll have a single state as a member object in the SCV class.

All states will have a common interface: the `update` and `executeAction` functions, same as before.

The superclass for all of the states would be:

{% highlight c++ %}
struct State
{
    virtual void update(SCV *scv, float deltaTime) = 0;
    virtual void executeAction(SCV *, const Action *action) = 0;
};
{% endhighlight %}

Let's now define some of the states we've already mentioned.

### Idle

{% highlight c++ %}
struct Idle : public State
{
    Idle() : State()
    {
    }

    void update(SCV *scv, float deltaTime) override
    {
        // Idle: do nothing
    }

    void executeAction(SCV *scv, const Action *action) override
    {
        if (auto moveToPoint = rtti_cast<const MoveToPointAction *>(action))
        {
            scv->setState(new MovingToTarget(moveToPoint->m_point));
        }
    }
};
{% endhighlight %}

Way better, don't you think?

### Gathering

{% highlight c++ %}
struct Gathering : public State
{
    Gathering(float gatheringTime) : State(), m_remainingTime(gatheringTime)
    {
    }

    void update(SCV *scv, float deltaTime) override
    {
        m_remainingTime -= deltaTime;
        if (m_remainingTime <= 0.0f)
        {
            scv->fillUpTank();
            scv->moveTowards(scv->getResourceBuilding());
        }
    }

    void executeAction(SCV *scv, const Action *action) override
    {
        if (auto moveToPoint = rtti_cast<const MoveToPointAction *>(action))
        {
            scv->setState(new MovingToTarget(moveToPoint->m_point));
        }
    }

private:
    float m_remainingTime;
};
{% endhighlight %}

See that `moveTowards` function? It implicitly changes the state of the SCV. It could be implemented like:

{% highlight c++ %}
void moveTowards(const Entity *entity)
{
    setState(new MovingToTarget(entity));
}
{% endhighlight %}

Do you start to see the benefits of using _stateful_ states? Our SCV class would be reduced to having the `State` it's in and whatever other properties that are relevant for the unit (i.e. the amount of a loaded resources). We don't have common properties to hold logic that is specific to one state.

Each `State`, then, is responsible for taking care of performing its own logic with its own properties, separatedly from other `States`. This helps readability and maintainability as execution flow is held in the currently active state and we can only access the state's data or SCV's common one (i.e. previously mentioned loaded resources).

# Setting state revisited

Alright, so now that we know how we're structuring our code, let's think about code flow once again. Since we're keeping all of the logic that's related to a state in itself, we'd like to detect when we're entering/exiting a state so we can have extra logic (i.e. setting an animation, playing a sound, notifying other systems, ...).

For that, we'll have to modify our `State` to have two extra methods: `onEnter` and `onExit`.

{% highlight c++ %}
struct State
{
    virtual void onEnter(SCV *scv, const State *previous) = 0;
    virtual void update(SCV *scv, float deltaTime) = 0;
    virtual void onExit(SCV *scv, const State *next) = 0;

    virtual void executeAction(SCV *scv, const Action *action) = 0;
};
{% endhighlight %}

And we'll have to modify our `setState` method to account for these functions:

{% highlight c++ %}
void setState(State *state)
{
    if (m_state != nullptr)
    {
        m_state->onExit(this, state);
    }

    const State *previous = m_state;
    m_state = state;
    m_state->onEnter(this, previous);

    delete previous;
}
{% endhighlight %}

Of course, we could've passed our `SCV` instance in the `State` constructor rather than each function, but for the sake of simplicity we've kept it this way.

Now, we could set some animation when we enter the `Idle` state, hide the unit when entering the `Depositing` state and showing it again when exiting it, or having different logic when we are coming from/going to certain states (i.e. drop currently loaded resources if going to `FleeingFromEntity` because we're scared but keeping them if going to `MovingToTarget`).

# Bonus: other applications

Keeping state using this pattern isn't restricted to videogames and AI only, but it isn't a silver bullet either! Let's have a look at a couple of interesting uses:

### Mouse interaction

This can also be applied to fingers in a touch screen. You can separate your logic into two states: `Moving` and `Dragging`. Maybe you can have:

{% highlight c++ %}
struct Moving : public State
{
    Moving() : State()
    {
    }

    void onEnter(DragAndDrop *dragAndDrop, const State *previous) override
    {
    }

    void update(DragAndDrop *dragAndDrop, float deltaTime) override
    {
    }

    void onExit(DragAndDrop *dragAndDrop, const State *previous) override
    {
    }

    void executeAction(DragAndDrop *dragAndDrop, const Action *action) override
    {
        if(auto click = rtti_cast<const ClickAction *>(action))
        {
            Entity *entity = getEntityAt(click.getPosition());
            dragAndDrop->setState(new Dragging(clickedEntity));
        }
    }
};

struct Dragging : public State
{
    Dragging(Entity *draggedEntity) : State(), m_entity(draggedEntity)
    {
    }

    void onEnter(DragAndDrop *dragAndDrop, const State *previous) override
    {
        if(m_entity != nullptr)
        {
            m_entity->setBeingDragged(true);
        }
    }

    void update(DragAndDrop *dragAndDrop, float deltaTime) override
    {
        if(m_entity != nullptr)
        {
            m_entity->setPosition(getCurrentMousePosition());
        }
    }

    void onExit(DragAndDrop *dragAndDrop, const State *previous) override
    {
        if(m_entity != nullptr)
        {
           m_entity->setBeingDragged(false);
        }
    }

    void executeAction(DragAndDrop *dragAndDrop, const Action *action) override
    {
        if(auto releaseClick = rtti_cast<const ReleaseClickAction *>(action))
        {
            dragAndDrop->setState(new Moving());
        }
    }
};
{% endhighlight %}

### Net processes

Say you're performing net requests and want to keep track of its state. You could control it with some states: `SendingRequest`, `RequestTimedOut`, `WaitingForResponse`, `ResponseReceived`, `ResponseTimedOut`, ...

Maybe some of them keep a timer to check for timeouts, or keep request/response communication progress. You name it!

### Menu navigation

Have you ever thought about user navigation between menus? User is presented with the main one, then interacts to go to some other menu. Yes, those are `States` as well! Each one manages its logic and has its own properties, so it fits our pattern.

But, what about going back to the previous menu? You could have a hardcoded graph of which menu is the _previous_ of another one. Or you could have a [Pushdown Automaton](https://en.wikipedia.org/wiki/Pushdown_automaton)!

In a nutshell, it has a stack of `States` so you _push_ one when you enter a new menu and then _pop_ it when you exit it and you are again in the previous one. But that's for a future _coding scar_, don't rush it :)

Thank you for reading!