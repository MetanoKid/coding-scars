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

I bet your application creates some kind of log file that you inspect _manually_. Or it uses a data file with a well-known structure.

Have you ever thought _Oh dear, this wall of text is unreadable! If only I had some highlighting_? Beg no more, because we're making your dearest dreams come true!

# The scenario

Let's say this is a screenshot of your typical log file when you open it in Sublime Text 3:

![Colorless log file in Sublime Text 3]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/colorless-log-file.png){: .align-center}

I'd say it is hard to get an idea of what's really going on unless you are so into the format that you can _see blonde, brunette, redhead_. What if we could improve it so we highlight some interesting parts?

![Colorful log file in Sublime Text 3]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/colorful-log-file.png){: .align-center}

Okay, maybe you don't like the colors or maybe you would've highlighted other stuff. That's not the point, because we'll be learning how to achieve this result so you can roll your own!

# Sublime Text 3

First of all, you need to get yourself a copy of [Sublime Text 3](https://www.sublimetext.com/3){:target="_blank"}. If you haven't heard of this awesome text editor, head over to their home page and learn some of its interesting features.

# Syntax files

Sublime Text lets you create your own syntax definitions and its highlighting through their own data files. Each syntax definition mainly consists of 2+1 files:

  * **sublime-syntax** file: defines the structure of the syntax you are targetting.
  * **tmTheme** file: defines styling for each capture you performed with the previous file.
  * **sublime-settings** file: allows the user to create some properties for when the syntax is in use.

We'll walk through all of them as we progress through the following section.

# Case study: unreadable log files

Okay, so this is the sample log file we're using:

{% highlight text %}
[I][LUA|COMP][4.59023] Compiling Lua file 'Enemies/AwesomeEnemy/Load.lua'
[I][LOC][5.36767] Adding localization key 'MENU|PAD|ACCEPT'
[I][LOC][5.40064] Adding localization key 'HUD|LIFE'
[D][FX][5.71379] Creating partile pool 'FX/Particles/AwesomeParticle'
[I][LUA|COMP][5.87050] Compiling Lua file 'Objects/AwesomeObject/Load.lua'
[W][AI][6.57599] Entity 'AI|AwesomeEnemy_04' trying to find path but none available.
[E][AI][7.51715] Entity 'AI|AwesomeEnemy_06' trying to find path to 'Player|AwesomePlayer_01' but it's unreachable.
[F][ANM][8.06461] Animation 'AwesomeAttack' of 'Player|AwesomePlayer_01' not found in compiled data.
[W][FX][8.35198] Particle pool 'AwesomeParticle_03' using 27 of 32 particles.
[D][CMBT][9.68470] Entity 'Player|AwesomePlayer_03' is now targetting 'AI|AwesomeEnemy_03'.
[E][LOC|FMT][10.13165] Unrecognized localization key format 'MENU#PAD|CANCEL'.
[F][LUA|COMP][15.34108] Wrong encoding in file 'Enemies/AwesomeEnemy/Attacks.lua' (expecting UTF-8, found ISO-8859-1).
{% endhighlight %}

As we can see, there's a common pattern going on:

{% highlight text %}
[log_level][category][timestamp] Log data
{% endhighlight %}

Let's start with a simple syntax definition and work from there.

## Bootstrap

First of all, we're going to create the 2+1 files we mentioned before.

Navigate to Sublime Text's `Packages` folder (`%appdata%\Sublime Text 3\Packages` in Windows, `~/.config/sublime-text-3/Packages` in Linux) and create a folder called `AwesomeCodingScarsLog`. Let's now add some _barebones_ files inside.

### AwesomeCodingScarsLog.sublime-syntax

Create it and paste this code:

{% highlight yaml %}
%YAML 1.2
---
scope: acsl
contexts:
  main:
    - match: '.+'
{% endhighlight %}

Here we'll define our syntax rules.

### AwesomeCodingScarsLog.tmTheme

Create it and paste this code:

{% highlight xml %}
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>name</key>
  <string>AwesomeCodingScarsLog</string>
  <key>settings</key>
  <array>
    <dict>
      <key>settings</key>
      <dict>
        <key>background</key>
        <string>#272822</string>
        <key>caret</key>
        <string>#F8F8F0</string>
        <key>foreground</key>
        <string>#F8F8F2</string>
        <key>invisibles</key>
        <string>#3B3A32</string>
        <key>lineHighlight</key>
        <string>#3E3D32</string>
        <key>selection</key>
        <string>#49483E</string>
        <key>findHighlight</key>
        <string>#FFE792</string>
        <key>findHighlightForeground</key>
        <string>#000000</string>
        <key>selectionBorder</key>
        <string>#222218</string>
        <key>activeGuide</key>
        <string>#9D550FB0</string>

        <key>bracketsForeground</key>
        <string>#F8F8F2A5</string>
        <key>bracketsOptions</key>
        <string>underline</string>

        <key>bracketContentsForeground</key>
        <string>#F8F8F2A5</string>
        <key>bracketContentsOptions</key>
        <string>underline</string>

        <key>tagsOptions</key>
        <string>stippled_underline</string>
      </dict>
    </dict>
    <!-- our custom styles here -->
  </array>
</dict>
</plist>
{% endhighlight %}

This is the base file for the Monokai color scheme. Here we'll define our styling.

### AwesomeCodingScarsLog.sublime-settings

Create it and paste this code:

{% highlight json %}
{
  "color_scheme": "Packages/AwesomeCodingScarsLog/AwesomeCodingScarsLog.tmTheme",
}
{% endhighlight %}

This defines settings that override current ones when this syntax is selected. It tells Sublime Text to use our `.tmTheme` automatically when we select the syntax, so the styling is kept separate in that file.

### Set up sample log file

Open Sublime Text with the sample log file we mentioned before and select the syntax we're going to define. You can do it by either pressing `Ctrl+Shift+P` and then writing `Syntax AwesomeLog` in the field that appears on screen, or you can go to the bottom right corner and select the syntax manually from the list.

When you can read `AwesomeCodingScarsLog` in the bottom right corner of Sublime Text while the focus is on our sample log file, you are ready to continue.

## First step: understand the format

Open `AwesomeCodingScarsLog.sublime-syntax`. Let's check what we pasted previously:

{% highlight yaml %}
%YAML 1.2
---
scope: acsl
contexts:
  main:
    - match: '.+'
{% endhighlight %}

First lines declare it's a YAML file. It's mandatory for the syntax to be parsed.

The `scope` property defines a name that's assigned to a match when applying styling. In this case, it's the default styling for the syntax (`source` is defined in Sublime Text's chain of scopes). A `scope` can have _nesting_, specifying scopes from least to most specific. If you want to know more, check [Sublime Text's official docs](https://www.sublimetext.com/docs/3/scope_naming.html){:target="_blank"}.

After the global `scope` definition we find the `contexts` definition. It is a map of context definitions that act like a stack. Starting from the `main` context, it tries to `match` your file against some regular expressions that can modify this stack. In our case, we'll only work with the `main` one.

Each `context` has, in turn, a list of `match` entries that define the regular expressions that will be checked against the file. When a match is found we'll assign `scopes` to apply styling.

So, let's add the first one!

## Everything's unexpected

This step is a temporal one that we'll use to ensure we're on the right track as we go.

Modify the only entry in the `main` `context` so it is:

{% highlight yaml %}
# unexpected
- match: '.+'
  scope: acsl.unexpected
{% endhighlight %}

This means we're tagging everything with the `ascl.unexpected` style. However, it's still not defined. Let's fix that!

Open `AwesomeCodingScarsLog.tmTheme` and add this definition in the place where we had a comment:

{% highlight xml %}
<dict>
  <key>name</key>
  <string>Unexpected</string>
  <key>scope</key>
  <string>acsl.unexpected</string>
  <key>settings</key>
  <dict>
    <key>background</key>
    <string>#FF0000</string>
  </dict>
</dict>
{% endhighlight %}

With this, now we've got this lovely file:

![Everything's unexpected]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/everything-is-unexpected.png){: .align-center}

This is our starting point, because we'll have a nice red background on everything we haven't matched.

## Log levels

Now it's time for us to match something: the log levels. We know the format is `[log_level]` and that they are either `D` (debug), `I` (info), `W` (warning), `E` (error) or `F` (fatal).

In the `.sublime-syntax` file we're going to define matches for these, so inside the `main` context but **before** the `acsl.unexpected` match (it's a cascade), insert the following code:

{% highlight yaml %}
# debug
- match: '^(\[D\])(.+)$'
  scope: acsl.line
  captures:
    1: acsl.debug
{% endhighlight %}

We're capturing the `[D]` log level and the rest of the line. The `scope` property is applied to the whole match and the `captures` list defines specific scopes for each capture group in the regular expression. This way, the `[D]` tag will have the `acsl.debug` scope and the rest of the capture will have the `acsl.line` one.

This will yield this highlighting:

![Everything's unexpected but Debug]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/everything-is-unexpected-but-debug.png){: .align-center}

Repeat this match with the rest of the tags (using `acsl.` + `info`, `warning`, ...; remember it's a cascade!) and we'll have the following highlighting:

![Nothing is unexpected]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/nothing-is-unexpected-everything-is-unstyled.png){: .align-center}

### Styling log levels

So, now that we've captured some stuff in our file we have to add some highlighting. Let's start with the `acsl.debug` scope. In the `.tmTheme` file, where we left a comment, paste this code:

{% highlight xml %}
<dict>
  <key>name</key>
  <string>Debug</string>
  <key>scope</key>
  <string>acsl.debug</string>
  <key>settings</key>
  <dict>
    <key>foreground</key>
    <string>#16ACBA</string>
  </dict>
</dict>
{% endhighlight %}

Do it again for each other log level with the following colors:

  * `acsl.info`: #00B764
  * `acsl.warning`: #EDD436
  * `acsl.error`: #A50101
  * `acsl.fatal`: #FF0000

You'll now have this style:

![Styled log levels]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/styled-log-levels.png){: .align-center}

Great job! What if we extend the style in the log levels to the rest of the tags before the real log line?

### Styling tag and timestamp

Back in the `.sublime-syntax` file, find the `debug` match and update it like so:

{% highlight yaml %}
# debug
- match: '^(\[D\])(\[.+\])(\[.+\])(.+)$'
  scope: acsl.line
  captures:
    1: acsl.debug
    2: acsl.debug
    3: acsl.debug
{% endhighlight %}

Update all other matches to account for the new `match` and `captures` additions and you'll have this highlighting:

![Styled tags]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/styled-tags.png){: .align-center}

Nice! Isn't it easier to see which kind of messages you're having in the file?

### Styling important data

Before we call it a day, we'd like to highlight everything that's between the single quotes because, for us, they are important and deserve attention. Let's add this `match` **after** all of our log level `match` definitions:

{% highlight yaml %}
# singly quoted
- match: "'([^']+)'"
  captures:
    1: acsl.singly-quoted
{% endhighlight %}

And this style:

{% highlight xml %}
<dict>
  <key>name</key>
  <string>Singly quoted</string>
  <key>scope</key>
  <string>acsl.singly-quoted</string>
  <key>settings</key>
  <dict>
    <key>foreground</key>
    <string>#FF6811</string>
  </dict>
</dict>
{% endhighlight %}

We save and... Nothing changes. Why is that?

Remember we said it was a cascade? The first `match` that works will stop the tests. Our matches include not only the tags before the log data but the whole line. Because of that, our new style won't ever be matched!

Let's update the `debug` match to be like this:

{% highlight yaml %}
# debug
- match: '^(\[D\])(\[.+\])(\[.+\])'
  scope: acsl.debug
{% endhighlight %}

It doesn't care about anything else than the tags before the log data. Notice how we've dropped the `$` symbol and how we've ditched the `captures` list altogether: everything in the capture will have the same style.

Okay, we save again and... We see this:

![Unexpected unexpectation]({{ site.baseurl }}/assets/images/per-post/sublime-syntax-highlighting/unexpected-unexpectation.png){: .align-center}

Oh, no! What's going on?

[Sublime Text docs](https://www.sublimetext.com/docs/3/syntax.html){:target="_blank"}.