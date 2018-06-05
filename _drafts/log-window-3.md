---
layout: single
title: "Log window from scratch: handy functionality and configuration"
excerpt: "Configure the log window from the host application and add useful functionality like filters and auto-scroll"
author: Meta
category: Toolbox
tags:
  - Log
  - WPF
  - C++
  - MVVM
  - Class Library
  - Filter
series: Log window from scratch
---

Welcome to a new entry in the _Log window from scratch_ series, dear reader!

In the previous entry we converted our WPF window into a `Class Library` and created a _host project_ that consumed it. This time, we'll expose some configuration to the _host project_ and add some new functionality to the window. This way we can support several projects and make it more useful.

Ready? Set? Go!

# Window position and dimensions

Let's start with a simple one: setting the position and size of our window.

Imagine you are developing a videogame and it has a window where the game is rendered. You don't want your log window to be created over it (or under it!), but side to side instead.

We could add two new methods to our `LoggerUI` called `SetPosition` and `SetSize`, or we could pass these parameters to the `Initialize` method and have them set from the start. For now, let's pass them to `Initialize` since we don't plan on resizing it programatically after it's shown.

First, update `Initialize` like so:

{% highlight c# %}
public static void Initialize(int x, int y, int w, int h)
{
    Debug.Assert(m_instance == null, "LoggerUI already initialized");
    m_instance = new LoggerUI(new Rect(x, y, w, h));
}
{% endhighlight %}

So we can call it like so:

{% highlight c# %}
LoggerUI.Initialize(0, 0, 800, 200);
{% endhighlight %}

Of course, we'd need to update our `LoggerUI`'s constructor to match the new parameter:

{% highlight c# %}
private LoggerUI(Rect dimensions)
{
    // application and window need their own thread, so we create it
    AutoResetEvent windowCreatedEvent = new AutoResetEvent(false);
    Thread t = new Thread(() =>
    {
        m_application = new App();

        MainWindow window = new MainWindow();

        // set window dimensions
        window.WindowStartupLocation = WindowStartupLocation.Manual;
        window.Left = dimensions.Left;
        window.Top = dimensions.Top;
        window.Width = dimensions.Width;
        window.Height = dimensions.Height;

        m_application.MainWindow = window;
        m_application.MainWindow.Show();

        // notify they are created before we block this thread
        windowCreatedEvent.Set();

        m_application.Run();
    });
    t.SetApartmentState(ApartmentState.STA);
    t.Start();

    // wait until the application and window are created
    windowCreatedEvent.WaitOne();
}
{% endhighlight %}

The only addition has been the block where we set the dimensions.  
And this is it! We can now position and size it however we want.

Bonus idea: we could ask the window about its position and size from the host program and persist its values so we could start from the last configuration.

# Auto-scroll to bottom

This will be the first addition we're adding that will modify our window's layout.

If you were to use the window as it is now, you would notice the scroll isn't moving unless you do it manually. This may be useful if you are reading some of the messages, but most of the time you may want it to scroll to the last message automatically.

We'll be adding a checkbox to our window that lets us activate or deactivate this functionality. This isn't something that the host program will configure, but something that's built-in our window. So our layout will be something like this:

TODO: doodle of our window with three parts: top line with built-in configuration, center block with the logs, bottom lines with log levels and system filtering

## Layout update

Let's start with the built-in block. This is the updated `MainWindow.xaml` file with some parts commented out for the sake of brevity:

{% highlight xml %}
<Window ...>
    <DockPanel>
        <GroupBox DockPanel.Dock="Top"
                  x:Name="BuiltInConfigurationGroup"
                  VerticalAlignment="Top"
                  BorderThickness="0">
            <CheckBox x:Name="AutoScrollCheckBox"
                      Content="Auto-scroll"
                      HorizontalAlignment="Right"
                      VerticalAlignment="Center"/>
        </GroupBox>
        <ListView DockPanel.Dock="Top" ...>
            <!-- other properties -->
        </ListView>
    </DockPanel>
</Window>
{% endhighlight %}

As you can see, we've wrapped everything into a `DockPanel` which allows us to resize the window and keep every control stretched as we want. This is how it looks:

![New layout with auto-scroll]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/layout-with-auto-scroll.png){: .align-center}

## Auto-scroll property

Now we have to connect that checkbox to some `ViewModel`. We'll update its XAML definition as:

{% highlight xml %}
<CheckBox x:Name="AutoScrollCheckBox"
          IsChecked="{Binding Path=IsAutoScrollEnabled}"
          Content="Auto-scroll"
          HorizontalAlignment="Right"
          VerticalAlignment="Center"/>
{% endhighlight %}

With that, we've tied a yet-to-be-created variable called `IsAutoScrollEnabled` to our checkbox. Let's add it in our `MainWindow.xaml.cs` class:

{% highlight c# %}
private bool m_autoScrollEnabled = false;
public bool IsAutoScrollEnabled
{
    get
    {
        return m_autoScrollEnabled;
    }

    set
    {
        m_autoScrollEnabled = value;
        AddLogEntry(0.0f, "INTERNAL", "Auto-scroll is now " + m_autoScrollEnabled);
    }
}
{% endhighlight %}

If you were to do this, it wouldn't work because we're trying to bind a variable from a `DataContext` that's `null` by default. To fix that we must do this in the `MainWindow.xaml.cs`'s constructor:

{% highlight c# %}
DataContext = this;
{% endhighlight %}

Now it will work as expected.

For now, we've used our own log capability to show a message in the window whenever we modify the property. If we were to run it and click on the checkbox several times we'd get something like this:

![Auto-scroll on change log]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/auto-scroll-on-change-log.png){: .align-center}

## Scroll to bottom

By default, when a new item is added to the `ListBox` that contains our log messages no scroll is performed. We'd want to know when an item is added to the list so we can perform the scroll ourselves.

Our `LogEntries` variable (which is an `ObservableCollection`) has a `CollectionChanged` event handler we can subscribe to. So, first of all let's create a method in our `MainWindow.xaml.cs` to handle the scroll:

{% highlight c# %}
private void OnLogEntriesChangedScrollToBottom(object sender, NotifyCollectionChangedEventArgs e)
{
    if (VisualTreeHelper.GetChildrenCount(LogEntryList) > 0)
    {
        Decorator border = VisualTreeHelper.GetChild(LogEntryList, 0) as Decorator;
        ScrollViewer scrollViewer = (ScrollViewer)VisualTreeHelper.GetChild(border, 0);
        scrollViewer.ScrollToBottom();
    }
}
{% endhighlight %}

Basically, we ask the `LogEntryList` `ListBox` for its children, get the scroll control for the list and ask it to go to the bottom.

Now, to tie it with our checkbox, modify the `IsAutoScrollEnabled` property with this:

{% highlight c# %}
public bool IsAutoScrollEnabled
{
    get
    {
        return m_autoScrollEnabled;
    }

    set
    {
        m_autoScrollEnabled = value;
        
        if(value)
        {
            LogEntries.CollectionChanged += OnLogEntriesChangedScrollToBottom;
        }
        else
        {
            LogEntries.CollectionChanged -= OnLogEntriesChangedScrollToBottom;
        }
    }
}
{% endhighlight %}

So, we add or remove our callback based on the state of the checkbox.

Congratulations, you've got an auto-scrolling `ListBox`!

# Log levels

So far the new functionalities are great additions. But how about having different _log levels_ (i.e. _debug_, _warning_, _error_) with colors and the ability to filter them?

My first approach consisted on having a new column in the list with the `DEBUG` or `ERROR` text. However, we'd prefer to have as many space to show meaningful messages as possible. So, let's ditch out this idea and color each row instead.
