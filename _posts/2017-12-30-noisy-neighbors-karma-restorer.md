---
layout: single
title: "How sleep deprivation can lead to creativity"
excerpt: Being in a difficult situation leads you to use your imagination, like creating Noisy Neighbors Karma Restorer
author: Meta
category: Post-mortem
tags:
  - Node.js
  - Creativity
  - Programming
  - REST API
  - JavaScript
---

_Make yourself comfortable, dear reader, for I'm about to tell you a tale about my past self._

I love having side projects. I enjoy thinking about what thing I want to try out and setting a goal. This blog is one of them, in fact. These side projects are a great tool to learn something new, practice some of that acquired knowledge or create something that fits some arbitrary needs.

A while ago, back in 2015, we had some very noisy neighbors that prevented us from sleeping nicely for a year. Whether it was 1am, 4am on week days or 3pm on weekends didn't matter. Sometimes it lasted for 10 minutes, sometimes for over 2 hours. Day after day we were more tired and angry. It even affected our professional performance.

This time, let me share with you how I turned this situation into an opportunity to have a new side project.

# How it all started

_Every story has a beginning, and so does this one._

When we moved to a new apartment in a new town, the landlord never mentioned anything about any neighbors. We visited the apartment, the house was just what we were looking for. We didn't find anything wrong about it or the building. And it wasn't... For a week.

One late night, a young kid started screaming and crying in the dark. It was like having a kid next door, but was in fact in the apartment just over ours. The crying lasted an hour. _No problem, kids have nightmares and are afraid of darkness, he'll grow up._ We ended up learning this young kid was about 2 years old.

Days passed and the situation was repeating once every three days or so. Sometimes it lasted just a bit, sometimes it was over an hour. At 4am. When you get up at 7am. But it's alright, it was a kid and we couldn't control that. Not even the fact that his parents kept him in the bedroom right over us for the whole thing, day after day, instead of calming him somewhere else.

At times, in the silent night, we'd wake up and ask each other: _Is the kid crying? I can hear him._ Some of those times we weren't sure whether it was happening or it was psychosis.

We got ourselves some earplugs. We tried several flavours: foam earplugs, silicone earplugs; you name them, we tried them. We weren't even sure it was healthy using them so frequently, but we needed sleep.

_Damn kid_, we thought. But, was he the problem?

# The root of all Evil

This continued happening from time to time, but then we started to pay attention to what happened upstairs. Okay, the kid was noisy, but he was just a kid, you can't blame it on him. The problem were his parents, from the start!

We remember one day when his father woke up at 6am, went to the toilet and got a phone call. He started talking and I swear we could understand what his interlocutor was saying! He was using the speaker. In the toilet. At 6am! And that happened again some days later!

Then we realized our neighbors didn't stand each other. He didn't seem to give a damn about the kid, she didn't seem to have any patience with none of them. You couldn't even take a nap in the afternoon, the kid would be playing with his toys, running through the apartment making noise or being yelled at by his mother. Or maybe it was the mother yelling at the father.

For the record, they also laughed and seemed to have good times.

But then again, the father. Oh, the father. He had that characteristic smoker's cough, trying to scratch the itch from his throat. Did I mention the kid could cry for an hour? He could cough for several hours. I don't even think he let his wife and kid sleep.

We couldn't.

# With despair comes invention

Fast forward to 8 months after we moved. The noise continued and we were feeling so embarrased when we'd meet them in the elevator or the building. We were also noticing how irascible we were becoming because of the lack of sleep.

Some time before that I had watched this YouTube video:

<iframe width="560" height="315" src="https://www.youtube.com/embed/KnHYKVIbDcs?rel=0" frameborder="0" gesture="media" allow="encrypted-media" allowfullscreen></iframe>

And I loved how he managed to annoy his neighbors even when he wasn't home. And best of all, it was _reactive_! I didn't want anything this _hi-tech_, but I definitely wanted to build something for the same purpose. So I did.

# Noisy Neighbors Karma Restorer

The idea was to build a program to play very noisy songs to our neighbors intermittently during the day. Something like:

_Select a noisy song with a hard bass, play the first N seconds and then remain silent for M seconds. Repeat._

Then I could just leave home for work, leave it on and fulfill my vengeance. Say... _play the first 50 seconds of AWOLNATION's Sail, then stop for 15 minutes and repeat_.

<iframe width="560" height="315" src="https://www.youtube.com/embed/tgIqecROs5M?rel=0" frameborder="0" gesture="media" allow="encrypted-media" allowfullscreen></iframe>

That would include placing our subwoofer very close to the ceiling and upwards. It surely would be a show to watch. And to listen to! I can tell you it was impossible to stay in the room while it played.

## The tech

Okay, so I had a brand new side project. What did I want to learn?

I chose Node.js because I wanted to build a REST API to control it from an Android app. I'd open the app, hit a big _Play_ button with some pre-selected values and then leave for the day. Then came home, open the app again and press the big _Stop_ button. Simple! Or was it?

### First difficulty

I started browsing for Node packages that allowed MP3 playback. I read some of the README files, tried to test some of them, and finally selected [player](https://www.npmjs.com/package/player).

It even came with some examples, ready to try out!

{% highlight text %}
npm install player --save
node main.js
{% endhighlight %}

But it was stuck as soon as I used `require("player");`. I remember wasting a day on that. I ended up installing a fresh Ubuntu and trying there. It worked first try. I had my prequisite working.

### Basic REST API

First of all, I installed Express to build the server and bind the API. I'd allow the following services:

{% highlight text %}
GET /
GET /songs
POST /play
POST /stop
{% endhighlight %}

Nothing special here, just wanted the basic controls. These would be some example request/response for each service:

{% highlight json %}
> GET /

< 200 OK
{
  "running": false
}
{% endhighlight %}

{% highlight json %}
> GET /songs

< 200 OK
[
  "demo.mp3",
  "Sail - AWOLNATION.mp3",
  "Dark Horse - Katy Perry.mp3"
]
{% endhighlight %}

{% highlight json %}
> POST /play
{
  "song": "Sail - AWOLNATION.mp3",
  "duration": 50,
  "interval": 900,
  "timeToEnd": {
    "hours": 22,
    "minutes": 15
  }
}

< 201 Created
{% endhighlight %}

{% highlight json %}
> POST /stop

< 200 OK
{% endhighlight %}

Did you notice the `timeToEnd` field in the `POST /play` call? That field would be used to stop the playback when the given time in the day was reached. Suppose I was coming home late in the night and it was still playing.  
_I'm not a monster_.

So, I created a couple of new services to allow some extra tuning:

{% highlight text %}
POST /limit_time
POST /volume
{% endhighlight %}

### Testing the API

I installed a nice browser add-on called [Postman](https://www.getpostman.com/), now turned into a native app. It has improved over these years, but even back then it had everything I needed to test my project.

It would allow performing calls to a given URL with the parameters I wanted, showed the responses nicely formatted and had a way to save those calls for later use.

What's even better, I could hear what was happening when I performed the calls! I could test the _play 10 seconds, wait 10 seconds, repeat_ scenario, the _stop playing at 19:00_ one, etc.

And no, I didn't build a whole lot of unit tests to ensure it was working in all scenarios.

### Disappointment

Some stories have a premature end. This was one of them.

I'd have loved to tell you I built an awesome Android app to control the whole thing. With its learning process, the _fragments_, the _layouts_, _manifest permissions_ and so on.

However, Postman was fitting my needs and I was losing interest in the project myself as the main goal (_playing song fragments in fixed intervals_) was already working.

## The Good

I'm glad to say, though, that I was somewhat dilligent and created a GitHub repository for the project as I developed it. I kept it private all this time, but I guess it's time to open it for the public. You can find it here:

[Noisy Neighbors Karma Restorer's GitHub](https://github.com/MetanoKid/NoisyNeighborsKarmaRestorer)

I would've loved to review it, update it to use my current programming style and preferences, naming and the like. But I preferred to leave it untouched so I could also reflect on how I have evolved in those aspects as well.

In any case, it was a nice way to focus on something else with a goal in mind. I also learned one or ten things while building it, so I'm happy that I did it.

## The Bad

Because I didn't manage to make `player` work on Windows, I had to go through the process of installing a fresh version of Ubuntu. After it was installed it wasn't a bad thing per-se, but that also took away some of the interest on the project.

Also, I'm afraid the noise never stopped and we ended up moving to another town. Not only because of the neighbors, but they were one of the main reasons. Luckily for us, we moved to a very quiet apartment and never needed to use this project again (for now).

## The Ugly

I only put this project into practice twice. One with AWOLNATION's Sail and one with Katy Perry's Dark Horse. I don't think it was of any help. At most, it irritated our neighbors even more and contributed to hurt their relationship.

I wish them the best. But, please, not next to our bedroom.

# Bonus

When I was checking the project to write this post I tried to make it work on Windows. I hadn't gave up on it.

Luckily, a user had opened a Pull Request on `player`, the module I was using, to update one of its dependencies (`speaker`) to a newer version that did work on Windows.

Sadly, `player` hadn't been updated in a long while and this Pull Request hadn't been merged.

So I forked the repository, updated it myself and modified NoisyNeighborsKarmaRestorer's dependency to my forked version. Thanks to it, now I know you can install a node module with `npm install github_user/repository#branch`.