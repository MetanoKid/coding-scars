---
layout: single
title: "TDD/BDD by example: FFVII's Triple Triad"
excerpt: Let's learn how TDD works by building the logic behind FFVIII's Triple Triad card game
author: Meta
category:
tags:
  - Videogames development
  - Testing
  - Test-Driven Development
  - Behavior-Driven Development
---

You know what? Testing your software automatically is awesome. Being able to run a set of tests that can tell you whether you've broken some functionality while you were updating your systems is a great tool. The sooner you detect bugs, the better.

Testing is a very large field in Computer Science and there's a whole set of jobs related to it. Have you ever heard of Unit Tests, Integration Tests, Test-Driven Development, Behavior-Driven Development, Continuous Integration, ...? Those are all related to this field.

However, you can't test _everything_ in a simple or a cheap way. There are some functionalities with special testing needs like those related to net communication or real-time interaction. Okay, yeah, there are some tools you can use in those scenarios like using mocks or fake UI interactions. The reality is that you have some kind of QA department who will be responsible of finding all of the bugs you've introduced in the application.

Let me tell you something: automatic testing in videogames is hard and rarely widespreaded (that's a generalization, and generalizations are evil!). You could test some of the systems separately. Maybe you can test your data structures, or your weapons system, or the puzzles in the game, or even your movement system. But, the amount of work it involves to create a meaningful test suite is huge. And yet, you could only use it for a subset of the system. At the end of the day, you still rely on your QA team to help you.

I'm not very used to creating automatic testing myself, so I'll try to explain the process I'd use to build a simple system with tests.

# TDD, BDD

Test-Driven Development (TDD) stands for the process in which developers follow these general steps:

  * The developer understands the feature that needs to be implemented.
  * A new test is created to define that feature.
  * All tests are ran, and this one must fail.
  * Only the minimum code that makes the test pass is created.
  * Ensure all the tests pass, including this one.
  * Refactor the code to improve it (remove duplication, clean it up, ...).

On the other hand, Behavior-Driven Development (BDD) is a methodology built on top of TDD. While TDD focuses on individual tests that check working functionalities, BDD focuses on the _behavior_ of a testing unit (a collection of tests related to one logic construct).

Let's be honest: I don't mind what TDD or BDD is, or what I should use. I just want my code tested with a readable format. I'm not being picky with testing terminology in this post. Let's just develop some cool stuff.

# Triple Triad

