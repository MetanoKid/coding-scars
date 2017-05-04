---
layout: single
title: X-Macros in C/C++
excerpt: Macros aren't always as Evil as they say
category: general
tags:
  - C
  - C++
---

Okay, okay. Macros are obscure and [Evil](http://stackoverflow.com/a/14041847/1257656), but they can be really useful when you want to generate code easily.  
X-Macros have been in use for [a long while now](http://www.drdobbs.com/the-new-c-x-macros/184401387), but don't seem to be well known these days. So let's see how they can help us.

## The scenario

Suppose you've defined an enumeration with some colors you support in your application, like so:

{% highlight c++ %}
enum class Color
{
    RED,
    BLUE,
    GREEN,
};
{% endhighlight %}

You use them throughout your code but then you need to have their string representation, maybe because you have to output them in a debug view. So you decide to create a separate _sibling_ array of strings that match the defined values, with a function that retrieves that representation:

{% highlight c++ %}
static const char *COLORS_AS_STRING[] =
{
    "RED",
    "BLUE",
    "GREEN"
};

const char *colorToString(Color color)
{
    return COLORS_AS_STRING[static_cast<int>(color)];
}
{% endhighlight %}

You are happy with your solution and call it a day.  
But then, the inevitable happens.

## Evolution

Your solution is so solid and works so nicely that you start adding colors all over the place. Let's add one for now:

{% highlight c++ %}
enum class Color
{
    RED,
    BLUE,
    GREEN,
    YELLOW,
};
{% endhighlight %}

It forces you to add a new entry to your array of string representations or you'll have issues when you call `colorToString(Color::YELLOW)`.  
Yikes, you must remember to add code in two places!

### New requisite: non-sequential IDs

You weren't done drying your sweat when somebody decides the enumeration won't start at 0 and keep counting from that because that's not semantic enough for your domain. So now have:

{% highlight c++ %}
enum class Color
{
    RED    =  0,
    BLUE   =  3,
    GREEN  =  7,
    YELLOW = 12,
};
{% endhighlight %}

Oh noes! Your clever _sibling_ array of strings can't be used anymore!

### The naive solution

Okay, okay, don't panic. Let's just create a `switch` block and forget about the array, huh?

{% highlight c++ %}
const char *colorToString(Color color)
{
    switch(color)
    {
    case Color::RED:
        return "RED";
    case Color::BLUE:
        return "BLUE";
    case Color::GREEN:
        return "GREEN";
    case Color::YELLOW:
        return "YELLOW";
    }

    return nullptr;
}
{% endhighlight %}

Phew, it's solved and you can clearly see what's happening.  
But then you add yet another color to your enum. You better remember to add a new `case` block. Jeez, this is smelling.

### New requisite: string to enum

You've got used to the smell and you think _Know what? It would be great if we could reference these colors from a data file by using their names_. Your fingers still sweating, you create this function:

{% highlight c++ %}
Color stringToColor(const char *colorName)
{
    if (strcmp(colorName, "RED") == 0)
    {
        return Color::RED;
    }
    
    if (strcmp(colorName, "BLUE") == 0)
    {
        return Color::BLUE;
    }

    // ...

    return Color::INVALID;
}
{% endhighlight %}

Note that we've added a new `INVALID` value in the process. Remember to add that one wherever necessary!

Right, so now you add a new color, say `Color::MAGENTA`. You have to:

  * Add the value to the enumeration.
  * Remember to add a `case` in the `colorToString` function.
  * Remember to add an `if` in the `stringToColor` function.

Oh man, this is so error prone.

## X-Macros to the rescue

Let's start again, but this time we'll define a Macro with all the colors:

{% highlight c++ %}
#define Colors \
    X( RED   ) \
    X( BLUE  ) \
    X( GREEN )
{% endhighlight %}

`Colors` is a Macro that generates nothing by itself: it's just a list of invocations to another Macro `X` with some data. Let's use it to create the enumeration we want:

{% highlight c++ %}
enum class Color
{
#define X(ID) ID,
    Colors
#undef X
};
{% endhighlight %}

And we've got it.

### Er... what?

Within the enumeration we've defined Macro `X`, which receives an argument (the color from the list) and translates it to `ID,`. After that, we remove this definition of `X` so no other code after this one knows about it and has unexpected results. Let's expand the code similarly to what the preprocessor would do:

{% highlight c++ %}
enum class Color
{
RED,BLUE,GREEN,
};
{% endhighlight %}

Okay, cool, but what about the string representation? Let's define the function:

{% highlight c++ %}
const char *colorToString(Color color)
{
    switch (color)
    {
#define X(ID) case Color::ID: return #ID;
        Colors
#undef X
    };
    
    return nullptr;
}
{% endhighlight %}

We've defined a new version of `X` which, this time, expands to `case Color::ID: return #ID;`. Again, if we expand the code we have:

{% highlight c++ %}
const char *colorToString(Color color)
{
    switch (color)
    {
case Color::RED: return "RED";case Color::BLUE: return "BLUE";case Color::GREEN: return "GREEN";
    };
    
    return nullptr;
}
{% endhighlight %}

Yeah, it's hard to read, but we don't mind as it's generated under the hood for us and the compiler doesn't care about spacing.

Great, you're filled with happiness and smile at your solution. Then, the inevitable happens.

## Evolution

You want to add a new color and your legs shake in fear. So you modify the `Colors` macro to include it, like so:

{% highlight c++ %}
#define Colors  \
    X( RED    ) \
    X( BLUE   ) \
    X( GREEN  ) \
    X( YELLOW )
{% endhighlight %}

Now you invoke `colorToString(Color::YELLOW)` and... it works! Automatically, both the `X` macro within the `enum` and the one within `colorToString` included new code for your new color! We didn't have to remember adding it, so that's good.

### New requisite: non-sequential IDs

We're still celebrating our intelligence when somebody decides the enumeration won’t start at 0 and keep counting from that because that’s not semantic enough for your domain. To do that, you modify `Colors` this way:

{% highlight c++ %}
#define Colors      \
    X( RED,     0 ) \
    X( BLUE,    3 ) \
    X( GREEN,   7 ) \
    X( YELLOW, 12 )
{% endhighlight %}

And now, we have to modify the definitions of `X`. So we have:

{% highlight c++ %}
enum class Color
{
#define X(ID, VALUE) ID = VALUE,
    Colors
#undef X
};

const char *colorToString(Color color)
{
    switch (color)
    {
#define X(ID, VALUE) case Color::ID: return #ID;
        Colors
#undef X
    };
    
    return nullptr;
}
{% endhighlight %}

Note that we aren't using the second argument of `X` in `colorToString` because we aren't interested in it.  
A call to `static_cast<int>(Color::GREEN)` would yield the expected `7` result.

Alright, we're not sweating yet, that's good.

### New requisite: string to enum

We're back to loading data from a file that uses the string representations of our enumeration. This would be the function that does the trick:

{% highlight c++ %}
Color stringToColor(const char *colorName)
{
#define X(ID, VALUE) if(strcmp(colorName, #ID) == 0) return Color::ID;
    Colors
#undef X

    return Color::INVALID;
}
{% endhighlight %}

Yes, it's still the same code but you don't have to mantain it manually whenever a new element is added.

If you've been reading carefully, there's a new element in the enumeration called `INVALID`. This one is an internal one, not an user-defined one. So, we'd have to add it to the enumeration itself, not as an item in `Colors`:

{% highlight c++ %}
enum class Color
{
#define X(ID, VALUE) ID = VALUE,
    Colors
    INVALID
#undef X
};
{% endhighlight %}

### The litmus test

So far we've defined a Macro called `Colors` that does nothing by itself, an enumeration `Color` that defines its own version of `X`, a function `colorToString` that also defines its own version of `X` and a function `stringToColor` that defines yet another version of `X`. That looks complex, right? Let's put it to a test by adding a new color!

We add a new entry in the `Colors` Macro:

{% highlight c++ %}
#define Colors       \
    X( RED,      0 ) \
    X( BLUE,     3 ) \
    X( GREEN,    7 ) \
    X( YELLOW,  12 ) \
    X( MAGENTA, 15 )
{% endhighlight %}

And **that's it**. Everything else just works.

{% highlight c++ %}
printf("%i\n", static_cast<int>(Color::MAGENTA));               // 15
printf("%s\n", colorToString(Color::MAGENTA));                  // MAGENTA
printf("%i\n", static_cast<int>(stringToColor("MAGENTA")));     // 15
{% endhighlight %}

We didn't have to remember to add anything else than the new color. Very similar to adding a new entry to an actual enumeration.  
Now we're smiling and very happy :)

## The downsides

Like everything else, _with great power comes great responsibility_. By using X-Macros:

  * You lose the ability to debug any expansion of `X`: be careful with having complex definitions that can fail in many places. Test those definitions standalone before wrapping them into a X-Macro.
  * You're giving your team a hard time: chances are they aren't used to X-Macros, so they could feel lost until they understand what's going on.
  * You shouldn't forget you haven't written the whole code, but it's there! If you perform costly computations within the expansions of `X`, those won't magically disappear!
  * You can get dragged into the hype train and start using this feature all over the place. Remember: this isn't a _silver bullet_.

## Bonus: interesting usage

Alright, so I've convinced you that X-Macros are useful but what can you do with them apart from having the string representation of an enumeration? Let's talk about one.

### Bulk member variables definition

Have you ever forgot to initialize a member variable in the constructor? Maybe you wanted to have automatic getters and setters for every member you defined? This could do the trick for you:

{% highlight c++ %}
class cMyClass
{
    // list of all the members available for this class
#define MyClass_Members                      \
    PUB( integerMember, int,         0     ) \
    PRI( stringMember,  std::string, ""    ) \
    PRO( boolMember,    bool,        false )

    // create members with their defined access modifiers
#define MEMBER(ACCESS_MODIFIER, MEMBER_NAME, TYPE, DEFAULT) ACCESS_MODIFIER: TYPE MEMBER_NAME;
#define PUB(MEMBER_NAME, TYPE, DEFAULT) MEMBER(public,    MEMBER_NAME, TYPE, DEFAULT)
#define PRI(MEMBER_NAME, TYPE, DEFAULT) MEMBER(private,   MEMBER_NAME, TYPE, DEFAULT)
#define PRO(MEMBER_NAME, TYPE, DEFAULT) MEMBER(protected, MEMBER_NAME, TYPE, DEFAULT)
    MyClass_Members
#undef MEMBER
#undef PUB
#undef PRI
#undef PRO

    // constructor with auto-generated initializations
#define INITIALIZER(MEMBER_NAME, DEFAULT) MEMBER_NAME = DEFAULT;
#define PUB(MEMBER_NAME, TYPE, DEFAULT) INITIALIZER(MEMBER_NAME, DEFAULT)
#define PRI(MEMBER_NAME, TYPE, DEFAULT) INITIALIZER(MEMBER_NAME, DEFAULT)
#define PRO(MEMBER_NAME, TYPE, DEFAULT) INITIALIZER(MEMBER_NAME, DEFAULT)
public:
    MyClass()
    {
        MyClass_Members
    }
#undef INITIALIZER
#undef PUB
#undef PRI
#undef PRO

    // getter and setter generation
#define GETTER_SETTER(MEMBER_NAME, TYPE)                              \
    const TYPE &get_##MEMBER_NAME() const { return MEMBER_NAME; }     \
    void set_##MEMBER_NAME(const TYPE &value) { MEMBER_NAME = value; }
#define PUB(MEMBER_NAME, TYPE, DEFAULT) GETTER_SETTER(MEMBER_NAME, TYPE)
#define PRI(MEMBER_NAME, TYPE, DEFAULT) GETTER_SETTER(MEMBER_NAME, TYPE)
#define PRO(MEMBER_NAME, TYPE, DEFAULT) GETTER_SETTER(MEMBER_NAME, TYPE)
    MyClass_Members
#undef GETTER_SETTER
#undef PUB
#undef PRI
#undef PRO
};
{% endhighlight %}

So now you could do stuff like:

{% highlight c++ %}
cMyClass c;
    
printf("%i\n", c.get_integerMember());          // 0
printf("'%s'\n", c.get_stringMember().c_str()); // ''

c.set_integerMember(45);
c.set_stringMember("Hi!");

printf("%i\n", c.get_integerMember());          // 45
printf("'%s'\n", c.get_stringMember().c_str()); // 'Hi!'
{% endhighlight %}

One of the downsides is having to define all of your members within the X-Macro, and that's where macros can make your code uglier.

Thanks for reading!