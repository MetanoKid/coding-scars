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

You know what? Testing your software automatically is **awesome**. Being able to run a set of tests that can tell you whether you've broken some functionality while you were updating your systems is a great tool. The sooner you detect bugs, the better. Not to mention the pleasure of seeing all them pass!

Testing is a very large field in Computer Science and there's a whole set of jobs related to it. Have you ever heard of _Unit Tests_, _Integration Tests_, _Test-Driven Development_, _Behavior-Driven Development_, _Continuous Integration_, ...? Those are all related to this field.

However, you can't test _everything_ in a simple or a cheap way. It might take more time to implement your systems so they can be tested than actually making the systems work. There are some functionalities with special testing needs like those related to net communication or real-time interaction.

Okay, yeah, there are some tools you can use in those scenarios like using mocks or fake UI interactions. The reality is that you have some kind of QA department who will be responsible of finding all of the bugs you've introduced in the application.

Let me tell you something: automatic testing in videogames is hard and rarely widespreaded (that's a generalization, and generalizations are evil!). You could test some of the systems separately. Maybe you can test your data structures, or your weapons system, or the puzzles in the game, or even your movement system. But, the amount of work it involves to create a meaningful test suite is huge. And yet, you could only use it for a subset of the whole project. At the end of the day, you still rely on your QA team to help you.

I'm not very used to creating automatic testing myself, so I'll try to explain the process I'd use to build a simple system with tests to validate it.

# TDD and BDD

Test-Driven Development (TDD) stands for the process in which developers follow these general steps when developing a system:

  * The developer understands the feature that needs to be implemented.
  * A new test is created to define that feature, creating the minimum code required to make it run.
  * All tests are ran, and this one **must** fail.
  * Only the minimum code that makes the test pass is added.
  * Ensure all the tests pass, including this one.
  * Refactor the code to improve it (remove duplication, clean it up, ...).

On the other hand, Behavior-Driven Development (BDD) is a methodology built on top of TDD. While TDD focuses on individual tests that check working functionalities, BDD focuses on the _behavior_ of a testing unit (a collection of tests related to one logic construct).

Let's be honest: I don't mind what TDD or BDD is, or what you should use. I just want my code tested with a readable format. I'm not being picky with terminology in this post. Let's just develop some cool stuff!

# Triple Triad

Back in 1999 a very remarkable videogame was released for the PlayStation: Final Fantasy VIII. I could describe the game or talk about why I like it so much, but we don't have that amount of time!

Inside the videogame there was a card game called _Triple Triad_. It had relatively simple rules ([described here](http://finalfantasy.wikia.com/wiki/Triple_Triad){:target="_blank"}) but you could spend hours playing it! The main reason to do so was to earn cards from your opponents and then mod them into items.

We'll try to build the logic for this card game in Scala using TDD/BDD.

## Rules

Triple Triad featured some base rules that applied throughout the game and some _situational_ ones related to some events (i.e. the region in which you played). We'll stick to the base ones. Let's describe them:

  * The `Board` is a 3x3 square grid.
  * All `Cells` in the grid start empty.
  * Each `Cell` has a `Color`.
  * A `Card` has four `Ranks`, each one assigned to one of its sides (`Top`, `Left`, `Bottom`, `Right`).
  * A `Rank` is a number in the range 1..10 (the game uses `A` for the number 10).
  * A `Card` can be placed in an empty `Cell`.
  * When a `Card` is placed, its `Cell`'s `Color` changes to the `Player`'s.
  * Each `Player` has a `Color`.
  * Each `Player` has a `Hand` of 5 `Cards`.
  * When a `Card` is placed, all horizontally and vertically neighbouring `Cards` are taken.
    * The `Ranks` of the `Cards` that are _in contact_ with each other are compared.
    * If the `Rank` in the just-placed `Card` is higher, the neighbouring `Card` _flips over_.
    * When a `Card` _flips over_, the `Color` in its `Cell` changes to the one in the `Player` that placed the `Card`.
  * The `Game` ends when all `Cells` have a `Card`.
  * The winner is the `Player` whose `Color` is most repeated throughout the `Cells`.

Have you noticed? By describing the game we've already found some nouns and some verbs that look like stuff we'll use to create our system.

Let me show you a sample screenshot of a typical game, instead of drawing a diagram to understand the system:

![Triple Triad example game]({{ site.baseurl }}/assets/images/per-post/testing-triple-triad/triple-triad-example-game.jpg){: .align-center}

You can see there are two players: red and blue. Their cards are colored instead of cells as we mentioned (which we can't see because cards are on top of them!). On the top left of all cards you can see the ranks that are associated to each card's side. There's also an icon on some cards's top right side that we'll skip for now (teaser: it's the element of the card).

So, now that we mostly know how the system works, let's start creating the logic in a TDD/BDD way!

# Triple Triad's game logic