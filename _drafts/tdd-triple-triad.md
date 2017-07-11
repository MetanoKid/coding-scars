---
layout: single
title: "TDD/BDD by example: FFVIII's Triple Triad"
excerpt: Let's learn how TDD works by building the logic behind FFVIII's Triple Triad card game
author: Meta
category:
tags:
  - Videogames development
  - Testing
  - Test-Driven Development
  - Behavior-Driven Development
---

You know what? Testing your software with one command is **awesome**. Being able to run a set of tests that can tell you whether you've broken some functionality while you were updating your systems is a great tool. The sooner you detect bugs, the better. Not to mention the pleasure of seeing all them pass!

Testing is a very wide field in Computer Science and there's a whole set of jobs related to it. Have you ever heard of _Unit Tests_, _Integration Tests_, _Test-Driven Development_, _Behavior-Driven Development_, _Continuous Integration_, ...? Those are all related to this field.

However, you can't test _everything_ in a simple or a cheap way. It might take more time to implement your systems so they can be tested than actually making the systems work. There are some functionalities with special testing needs like those related to net communication or real-time interaction.

Okay, yeah, there are some tools you can use in those scenarios like using mocks or fake UI interactions. The reality is that you will end up having some kind of QA department who will be responsible of finding all of the bugs you've introduced in the application.

Let me tell you something: automatic testing in videogames is hard and rarely widespreaded (that's a generalization, and generalizations are evil!). Of course you could test some of the systems separately. Maybe you can test your data structures, or your weapons system, or the puzzles in the game, or even your movement system. But the amount of work it requires to be able to create a meaningful test suite is huge. And yet, you could only use it for a subset of the whole project. At the end of the day, you still rely on your QA team to help you. Give some love to your QA team from time to time.

I'm not very used to creating automatic testing myself, but I've used it sparingly over the years. I'll try to explain the process I'd use to build a simple game system with tests to validate it.

# TDD and BDD

Test-Driven Development (TDD) stands for the development process in which developers follow these general steps:

  * The developer understands the feature that needs to be implemented.
  * A new test is created to define that feature, creating the minimum code required to make it run.
  * All tests are ran, and this one **must** fail.
  * Only the minimum code that makes the test pass is added.
  * All tests must pass now, including this one.
  * The developer refactors the code to improve it (remove duplication, clean it up, ...).

On the other hand, Behavior-Driven Development (BDD) is a methodology built on top of TDD. While TDD focuses on individual tests that check working functionalities and inputs/outputs, BDD focuses on the _behavior_ of a testing unit (a collection of tests related to one logic construct).

Let's be honest: I don't mind what TDD or BDD is, or what you should use. I just want my code tested with a readable format. I'm not being picky with terminology in this post. Let's just develop some cool stuff!

# Triple Triad

Back in 1999 a very remarkable videogame was released for the PlayStation: Final Fantasy VIII. I could describe the game or talk about why I like it so much, but it might take some more time than the one we have for this post!

In the videogame there was a card game called _Triple Triad_. It had relatively simple rules ([described here](http://finalfantasy.wikia.com/wiki/Triple_Triad){:target="_blank"}) but you could spend hours playing it! The main reason to do so was to earn cards from your opponents and then mod them into items (some of those were unique to this system).

We'll try to build the logic for this card game in Scala using TDD/BDD.

## Rules

Triple Triad featured some base rules that applied throughout the game and some _situational_ ones related to some events (i.e. the region in which you played). We'll stick to the base ones for now.

Let's have a look at a screenshot of a typical game:

![Triple Triad example game]({{ site.baseurl }}/assets/images/per-post/testing-triple-triad/triple-triad-example-game.jpg){: .align-center}

This would be our _design diagram_, instead of drawing one ourselves.

Keep the screenshot in mind as I outline the rules:

  * The `Board` is a 3x3 square grid.
  * All `Cells` in the grid start empty.
  * Each `Cell` has a `Color`.
  * A `Card` has four `Ranks`, each one assigned to one of its sides (`Top`, `Left`, `Bottom`, `Right`).
  * A `Rank` is a number in the range \[1, 10\] (the game uses `A` for the number 10).
  * A `Card` can be placed in an empty `Cell`.
  * When a `Card` is placed, its `Cell`'s `Color` changes to the `Player`'s that owns the placed card.
  * Each `Player` has a `Color`.
  * Each `Player` has a `Hand` of 5 `Cards`.
  * When a `Card` is placed, all horizontally and vertically neighbouring `Cards` are taken.
    * The `Ranks` of the `Cards` that are _in contact_ with each other are compared.
    * If the `Rank` in the just-placed `Card` is higher, the neighbouring `Card` _flips over_.
    * When a `Card` _flips over_, the `Color` in its `Cell` changes to the one in the `Player` that placed the `Card`.
    * This continues until no cards can be _flipped over_.
  * The `Game` ends when all `Cells` have a `Card`.
  * The winner is the `Player` whose `Color` is most repeated throughout the `Cells`, including the number of `Cards` still in its `Hand`.

Have you noticed? By describing the game we've already found some nouns and some verbs that look like stuff we'll use to create our system. That's a great sign!

Take a look at the screenshot again. You can see there are two players: red and blue. Their cards are colored instead of cells as we mentioned (which we can't see because cards are on top of them!). You can see the ranks of the cards on their top left side. There's also an icon on some cards's top right side that we'll skip for now (spoiler: it's the element of the card).

So, now that we mostly know how the system works, let's start creating the logic in a TDD/BDD way!

## Language and libraries

This time, we'll be using Scala to illustrate the concepts in this post. It's is a JVM-based language that mixes Object-Oriented Programming and Functional Programming in a very nice way. I'm not a professional Scala developer (not even close!) but I like its readability and the benefits of being _immutable-by-default_. If you want to follow along, head to [the official Scala site](https://www.scala-lang.org/){:target="_blank"} to learn how to set it up on your computer.

We'll be using [ScalaTest](http://www.scalatest.org/install){:target="_blank"} to help us with our TDD/BDD implementation, so you should also go to its site to know how to configure it in case you're following along. Also, you can read [this interesting post](https://semaphoreci.com/community/tutorials/a-hands-on-introduction-to-scalatest){:target="_blank"} on how to use ScalaTest more in depth than we'll do.

## Game logic

So, let's go item by item through the list of rules.

### An empty Board

Let's take a look back at the feature list. It started as:

  * The `Board` is a 3x3 square grid.

So that's the first thing we'll build.

#### TDD checklist: create a test, make it run

Let's start by creating this test specification:

{% highlight scala %}
class DefaultBoardSpec extends FlatSpec with Matchers {
  behavior of "A Board"
  
  it should "start empty" in {
    Board().isEmpty should be (true)
  }
}
{% endhighlight %}

Doesn't it read like an open book? That's the magic of ScalaTest's `FlatSpec` and `Matchers`! Let's go through the test explaining what's going on.

First of all we've got the definition of our `DefaultBoardSpec`, which is a testing unit for our `Board`.  
The `behavior of "A Board"` line defines a _title_ for all of the tests; it's just like a name for our testing unit.  
Each `it should "..." in` line will define a test in our unit, so we can check individual features.  

If we were to run this code, it wouldn't compile. What's a `Board`? If we remember the TDD checklist we mentioned before, we now have to make the test compile with the minimal needed code.

{% highlight scala %}
case class Board() {
  def isEmpty: Boolean = ???
}
{% endhighlight %}

Now it compiles. And what's `???`, you ask? It's a method accessible from all compilation units in Scala that just throws a `NotImplementedError` exception when invoked. It's very useful to stub methods like this!

#### TDD checklist: ensure new test fails

Let's test it, then!

{% highlight scala %}
sbt test
{% endhighlight %}

This is the output:

{% highlight text %}
[info] DefaultBoardSpec:
[info] A Board
[info] - should start empty *** FAILED ***
[info]   scala.NotImplementedError: an implementation is missing
[info]   ...
[info] Run completed in 297 milliseconds.
[info] Total number of tests run: 1
[info] Suites: completed 1, aborted 0
[info] Tests: succeeded 0, failed 1, canceled 0, ignored 0, pending 0
[info] *** 1 TEST FAILED ***
{% endhighlight %}

Sure enough, it fails! We're on the right track. What's next?

#### TDD checklist: make it pass, minimum code

Alright, let's update our `isEmpty` method so it makes the test pass:

{% highlight scala %}
case class Board() {
  def isEmpty: Boolean = true
}
{% endhighlight %}

And now let's ensure this code makes the test pass. Now, the output is:

{% highlight text %}
[info] DefaultBoardSpec:
[info] A Board
[info] - should start empty
[info] Run completed in 284 milliseconds.
[info] Total number of tests run: 1
[info] Suites: completed 1, aborted 0
[info] Tests: succeeded 1, failed 0, canceled 0, ignored 0, pending 0
[info] All tests passed.
{% endhighlight %}

Awesome! It passes!

#### TDD checklist: refactor code

Let's make use of a Scala's [companion object](http://docs.scala-lang.org/tutorials/tour/singleton-objects.html){:target="_blank"} to define a `Default` `Board`, like so:

{% highlight scala %}
object Board {
  val Default = Board()
}
{% endhighlight %}

So now we can use `Board.Default` to always refer to the same instance with the default configuration. We can now rewrite our test as:

{% highlight scala %}
behavior of "A Default Board"

it should "start empty" in {
  Board.Default.isEmpty should be (true)
}
{% endhighlight %}

### Board as a square grid

Okay, now that we've seen how we define our `Board` we'll model it as a 3x3 square grid. This time I won't be listing all the steps in the TDD checklist and may skip some of them.

Here are our tests:

{% highlight scala %}
it should "have 3 rows" in {
  Board.default.rows should be (3)
}

it should "have 3 columns" in {
  Board.default.columns should be (3)
}

it should "have 9 Cells" in {
  Board.default.cellCount should be (9)
}
{% endhighlight %}

Let's model our `Board` to have a `List[Cell]` to model the grid. And what's a `Cell`, you say? For now, it's just:

{% highlight scala %}
case class Cell()
{% endhighlight %}

Now we can update our `Board` definition to be:

{% highlight scala %}
object Board {
  val Default = Board(3, 3)
}

case class Board(rows: Int, columns: Int) {
  private val cells: List[Cell] = List.fill(rows * columns)(Cell())
  
  lazy val cellCount: Int = cells.size
  def isEmpty: Boolean = true
}
{% endhighlight %}

Which makes all tests pass:

{% highlight text %}
[info] DefaultBoardSpec:
[info] A Default Board
[info] - should start empty
[info] - should have 3 rows
[info] - should have 3 columns
[info] - should have 9 Cells
[info] Run completed in 340 milliseconds.
[info] Total number of tests run: 4
[info] Suites: completed 1, aborted 0
[info] Tests: succeeded 4, failed 0, canceled 0, ignored 0, pending 0
[info] All tests passed.
{% endhighlight %}

### Empty Cells

The next item in our rules list is:

  * All `Cells` in the grid start empty.

Let's start with the test:

{% highlight scala %}
class DefaultCellSpec extends FlatSpec with Matchers {
  behavior of "A Default Cell"
  
  it should "start empty" in {
    Cell.Default.isEmpty should be (true)
  }
}
{% endhighlight %}

As you can see, we've created a separate testing unit for our `Cell`. Apart from that, it's basically analogous to the `DefaultBoardSpec`. Now, it must compile.

{% highlight scala %}
object Cell {
  val Default = Cell() 
}

case class Cell() {
  def isEmpty: Boolean = ???
}
{% endhighlight %}

Does it fail?

{% highlight text %}
[info] DefaultCellSpec:
[info] A Default Cell
[info] - should start empty *** FAILED ***
[info]   scala.NotImplementedError: an implementation is missing
[info]   ...
[info] DefaultBoardSpec:
[info] A Default Board
[info] - should start empty
[info] - should have 3 rows
[info] - should have 3 columns
[info] - should have 9 Cells
[info] Run completed in 541 milliseconds.
[info] Total number of tests run: 5
[info] Suites: completed 3, aborted 0
[info] Tests: succeeded 4, failed 1, canceled 0, ignored 0, pending 0
[info] *** 1 TEST FAILED ***
{% endhighlight %}

Yes, it does. Can we fix it?

{% highlight scala %}
case class Cell() {
  def isEmpty: Boolean = true
}
{% endhighlight %}

{% highlight text %}
[info] DefaultCellSpec:
[info] A Default Cell
[info] - should start empty
[info] DefaultBoardSpec:
[info] A Default Board
[info] - should start empty
[info] - should have 3 rows
[info] - should have 3 columns
[info] - should have 9 Cells
[info] Run completed in 529 milliseconds.
[info] Total number of tests run: 5
[info] Suites: completed 3, aborted 0
[info] Tests: succeeded 5, failed 0, canceled 0, ignored 0, pending 0
[info] All tests passed.
{% endhighlight %}

Yes, we did it! Great job! Now, for the refactor.

Have you noticed we've defined `Board.isEmpty` and `Cell.isEmpty` but they aren't related yet? We're going to do it now. Let's rewrite `Board.isEmpty` as:

{% highlight scala %}
def isEmpty: Boolean = cells.forall(_.isEmpty)
{% endhighlight %}

All tests pass with this refactor, so we're very happy!

-------------------------

You're getting the glimpse of TDD, aren't you? :)

I know you're thinking: _I like the concept, but it looks so cumbersome to create a simple feature_. That's mostly because we've been illustrating the concept behind it step by step with very simple features that wouldn't require this whole process most of the times.

Still, having these tests will prove helpful in the future even if we didn't follow the whole TDD checklist for each one of them.

In the next post we'll continue building the logic of Triple Triad but we'll reduce the explanation to implement each feature to the test and then the code that makes it pass.

Thanks for reading!
