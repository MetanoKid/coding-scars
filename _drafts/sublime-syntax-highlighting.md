---
layout: single
title: "Leveraging your data files with Sublime Text"
excerpt: Learn how to use Sublime Text syntax definitions to help you with your custom file formats
author: Meta
category: Toolbox
tags:
  - Sublime Text 3
  - Syntax highlighting
  - Videogames development
---

I bet you have some kind of log file that you open with a text editor. Or a file that defines some data for your application. And I bet those have some well-defined structure.

Have you ever thought _Oh dear, this wall of text is unreadable! If only I had some highlighting_? Beg no more, because we're making your dearest dreams come true!

# Unreadable log files

Let's say this is a screenshot of your typical log file when you open it in Sublime Text 3:

![Colorless log file in Sublime Text 3]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/colorless-log-file.png){: .align-center}

I'd say it is hard to get an idea of what's really going on in. What if we could get something like this?

![Colorful log file in Sublime Text 3]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/colorful-log-file.png){: .align-center}

Okay, maybe you don't like the colors or maybe you would've highlighted other stuff. That's what we'll be learning to modify here so you can roll your own!

## Sublime Text 3

First of all, you need to get yourself a copy of [Sublime Text 3](https://www.sublimetext.com/3){:target="_blank"}.