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

TODO: doodle of our window with two parts: top line with built-in configuration, center block with the logs

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

# Per system filters

So far the new features are great additions, but how about being able to filter messages by their system?

Imagine you're working on a game and there's some bug you're tracking down related to the game _logic_. Wouldn't it be awesome to filter out everything else and only read the logs for that system? Something like clicking on different checkboxes?

However, the goal of this log window is to be used in more than a single project and each one of them may have completely diferent systems. So, how do we do it?

## Configuration from the host

Remember our `LoggerUI` entry point? We're adding a new method to let the host program tell us which systems it will be using so we can create as many checkboxes. This could be the outline:

{% highlight c# %}
public void ConfigureSytems(List<string> systems)
{
    Debug.Assert(m_application != null);

    m_application.Dispatcher.BeginInvoke((Action)delegate
    {
        Debug.Assert(m_application.MainWindow != null);

        (m_application.MainWindow as MainWindow).ConfigureSystems(systems);
    });
}
{% endhighlight %}

Of course, `MainWindow.ConfigureSystems` doesn't exist, so we must create it. But first, let's think about what we need at the _Window_ level.

We're going to have a list of checkboxes, one for each system we've received and we want to know whether they are checked to filter the messages. Phew! Let's digest all that.

## ViewModel

We could have a new `ViewModel` called `LogSystem` which contains the name of the system (as received from the host) as well as the state of the checkbox we'll have. Something like:

{% highlight c# %}
public class LogSystem
{
    public string Name    { get; set; }
    public bool   Enabled { get; set; }
}
{% endhighlight %}

And this way, we can have a `List<LogSystem>` (or `ObservableCollection<LogSystem>`) in our `MainWindow` that contains all of the entries. By having that, we could have `MainWindow.ConfigureSystems` do this:

{% highlight c# %}
public void ConfigureSystems(List<string> systems)
{
    systems.ForEach((system) =>
    {
        LogSystems.Add(new LogSystem
        {
            Name = system,
            Enabled = true
        });
    });
}
{% endhighlight %}

## Filtering

Remember `LogEntries`? The `List<LogEntry` where we store all of the log messages we receive? Well, we want to filter it now. To do that, we'll create a new `ICollectionView` from it.

An `ICollectionView` lets us sort, filter or group data from a given collection via predicate. This predicate is a function that decides, for each element in the collection, whether it belongs to the selected data.

By the way, don't let the `View` part of the name fool you. This doesn't have anything to do with visual representation, it's just the way to call this kind of filtered collection.

So, we've got to create it in our `MainWindow`:

{% highlight c# %}
private ICollectionView FilteredLogEntries;
{% endhighlight %}

And initialize it:

{% highlight c# %}
FilteredLogEntries = CollectionViewSource.GetDefaultView(LogEntries);
FilteredLogEntries.Filter = LogEntriesFilterPredicate;
{% endhighlight %}

As you can see, we take `LogEntries` and create a _view_ of the data. Then we assign our filter, which looks like this:

{% highlight c# %}
private bool LogEntriesFilterPredicate(object item)
{
    LogEntry entry = item as LogEntry;

    // filter out systems
    if(LogSystems.Any(s => s.Name == entry.System && !s.Enabled))
    {
        return false;
    }

    return true;
}
{% endhighlight %}

In other words, we keep any `LogEntry` except the `LogSystem` that matches is disabled.

This implementation has an unexpected behavior at this point, but let's continue and discover it later on.

## Layout update

We said we'd like to have as many checkboxes as systems so we could filter them to fit our needs. So, we need to add them somewhere. Maybe... to the bottom like this?

TODO: doodle of our window with three parts: top line with built-in configuration, center block with the logs, bottom line with system filtering

For that, and again skipping some of the XML attributes, we have to update our layout to this:

{% highlight xml %}
<Window ...>
    <DockPanel>
        <GroupBox ...>
            <CheckBox ... />
        </GroupBox>
        <GroupBox DockPanel.Dock="Bottom"
                  VerticalAlignment="Top"
                  BorderThickness="0">
            <ListView Name="Systems"
                      ScrollViewer.HorizontalScrollBarVisibility="Disabled"
                      BorderThickness="0">
                <ListView.ItemsPanel>
                    <ItemsPanelTemplate>
                        <WrapPanel Orientation="Horizontal"></WrapPanel>
                    </ItemsPanelTemplate>
                </ListView.ItemsPanel>
                <ListView.ItemTemplate>
                    <DataTemplate>
                        <CheckBox Content="{Binding Name}"
                                  IsChecked="{Binding Enabled}">
                        </CheckBox>
                    </DataTemplate>
                </ListView.ItemTemplate>
            </ListView>
        </GroupBox>
        <ListView x:Name="LogEntryList"
                  VerticalAlignment="Stretch"
                  HorizontalAlignment="Stretch">
        </ListView>
    </DockPanel>
</Window>
{% endhighlight %}

And remember to set the `ItemsSource` of the `Systems` element!

And this is how it would look like:

![Sample systems bottom row]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/sample-system-bottom-row.png){: .align-center}

Impressive, isn't it? Except it has a bug.

### Testing filter

If you asked me, before even executing the log window, _What should it do if I disable the TEST system for a while and then enable it?_ I'd say it would be silent for that while and then all the muted messages would pop at once. Do you mind if we test it now?

First, let it show some messages then disable the `TEST` system:

![Unexpected behavior on filter (unfiltered messages)]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/unexpected-filter-behavior-unfiltered-messages.png){: .align-center}

After 5 seconds, let's enable it again.

![Unexpected behavior on filter (missing messages)]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/unexpected-filter-behavior-missing-messages.png){: .align-center}

Can you spot the issues?

The first screenshot shows how we wanted to filter _out_ the messages with the `TEST` system but the ones before we disabled it are still there.

The second one shows how the messages between timestamps `3651` and `8797` are gone! It's like they weren't registered at all! Why is that?

If you remember, we created an `ICollectionView` from the `LogEntries` list. When we created it, the filter was executed and it's executed again when a new `LogEntry` is added to the original `LogEntries` collection.

When we disabled the `TEST` system, new items didn't fulfill the predicate but we didn't re-evaluate it for the existent ones. When we enabled it again, only the new ones were evaluated and not the ones that were discarded (although they were still stored in the `LogEntries` list).

So, how do we fix this issue?

### INotifyPropertyChanged

We've seen how our `LogSystem.Enabled` property was modified when we interacted with the checkbox. Our goal is to re-evaluate the filter whenever this happens so it's applied to the whole `LogEntries`.

To do this we need to allow _whoever is interested_ to listen to changes in our `Enabled` property. WPF has an interface called `INotifyPropertyChanged` that lets us execute an event whenever this happens. We'd have to refactor our `LogSystem` class as:

{% highlight c# %}
public class LogSystem : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler PropertyChanged;

    public string Name { get; set; }

    private bool m_enabled;
    public bool Enabled
    {
        get
        {
            return m_enabled;
        }

        set
        {
            m_enabled = value;
            if(PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs("Enabled"));
            }
        }
    }
}
{% endhighlight %}

When inheriting from this interface we have a new event handler called `PropertyChanged` that lets others listen to the changes we decide to trigger.

Remember our `MainWindow.ConfigureSystems` method where we created our `LogSystem` entries? That's where we'll subscribe to changes.

{% highlight c# %}
public void ConfigureSystems(List<string> systems)
{
    systems.ForEach((system) =>
    {
        LogSystem entry = new LogSystem
        {
            Name = system,
            Enabled = true
        };

        entry.PropertyChanged += OnSystemEnableChanged;

        LogSystems.Add(entry);
    });
}
{% endhighlight %}

The new `OnSystemEnableChanged` would look like this:

{% highlight c# %}
private void OnSystemEnableChanged(object sender, PropertyChangedEventArgs args)
{
    FilteredLogEntries.Refresh();
}
{% endhighlight %}

`Refresh` recreates the _view_ by re-evaluating the predicate against the source collection. This way, when we disable the `TEST` system we'll have an empty list and when we re-enable it we'll have all items even when we weren't seeing them.

Great job!

# Log levels

This wouldn't be a proper log window if we didn't have log levels (_debug_, _warning_, _error_) and colors for them!

Again, we let the host program decide which log levels it uses, their names and even the colors. And yes, you've guessed right, we'll do that in the `LoggerUI` singleton.

What's the relationship between several log levels? Let's use the common one: each level represents an integer (higher means more severity).

Imagine we had three log levels: _debug_, _warning_ and _error_. We could use _debug_ to log data or flow, _warning_ would let us know of non-blocking incompatibilities or to diagnose future issues and _error_ would flag stuff that must be fixed although we managed to continue executing the program.

Oh, and we must update our `LogEntry` messages to have a log level as well!

## Configuration from the host

We've seen each log level is modeled as a name and a color. The relationship between them can be implicit based on the configuration. What about adding this to `LoggerUI`:

{% highlight c# %}
public void ConfigureLevels(List<Tuple<string, string>> levels)
{
    Debug.Assert(m_application != null);

    m_application.Dispatcher.BeginInvoke((Action)delegate
    {
        Debug.Assert(m_application.MainWindow != null);

        (m_application.MainWindow as MainWindow).ConfigureLevels(levels);
    });
}
{% endhighlight %}

We could've created a new class or struct to model each log level but we've used `Tuple<string, string>` instead to get to the point. The first `string` is the name, the second one is the hexadecimal representation of the color.

We could call it like so:

{% highlight c# %}
LoggerUI.Instance.ConfigureLevels(new List<Tuple<string, string>>
{
    Tuple.Create("DEBUG",   "#000000"),
    Tuple.Create("WARNING", "#B8860B"),
    Tuple.Create("ERROR",   "#FF0000")
});
{% endhighlight %}

Now, we'd have to create `MainWindow.ConfigureLevels` but before we have to create a new `ViewModel`.

## ViewModel

Similarly to the `LogSystem` one we created before, let's define `LogLevel` as:

{% highlight c# %}
public class LogLevel
{
    public string Name  { get; set; }
    public Brush Color  { get; set; }
    public int Severity { get; set; }
}
{% endhighlight %}

Again, let's have a new `LogLevels` list in our `MainWindow` to contain all of the levels. And we could populate it from:

{% highlight c# %}
public void ConfigureLevels(List<Tuple<string, string>> levels)
{
    for(int i = 0; i < levels.Count; ++i)
    {
        LogLevels.Add(new LogLevel
        {
            Severity = i,
            Name = levels[i].Item1,
            Color = (Brush) new BrushConverter().ConvertFromString(levels[i].Item2)
        });
    }
}
{% endhighlight %}

You'll understand why we've used `Brush` instead of `Color` in a moment.

Cool! Now we've got all of the values in a list. What's next?

## Add log level to LogEntry

Right, until now all of our `LogEntry` messages only had a timestamp, a system and the message itself. Now, we need to add the name of the log level it was logged with. I'll let you go through this one, just add a new `string` property and we're ready.

## Layout update

We've established the relationship between log levels. Following our example, `debug < warning < error`. So, we only want to select the minimum level we're showing and the ones over it should show as well. This looks like a radio button to me.

The layout of our window would look like this with this addition:

TODO: doodle with 4 rows: built-in, log messages, systems and log levels

So, once again, let's skip some XML attributes and update the layout:

{% highlight c# %}
<Window ...>
    <DockPanel>
        <GroupBox ... />
        <GroupBox ...>
            <StackPanel>
                <ListView Name="Systems" ... />
                <ListView Name="Levels"
                          ScrollViewer.HorizontalScrollBarVisibility="Disabled"
                          BorderThickness="0">
                    <ListView.ItemsPanel>
                        <ItemsPanelTemplate>
                            <WrapPanel Orientation="Horizontal"></WrapPanel>
                        </ItemsPanelTemplate>
                    </ListView.ItemsPanel>
                    <ListView.ItemTemplate>
                        <DataTemplate>
                            <RadioButton Content="{Binding Name}"
                                         GroupName="LogLevels"
                                         Foreground="{Binding Color}">
                            </RadioButton>
                        </DataTemplate>
                    </ListView.ItemTemplate>
                </ListView>
            </StackPanel>
        </GroupBox>
        <ListView x:Name="LogEntryList" ... />
    </DockPanel>
</Window>
{% endhighlight %}

The `Foreground` property expects a `Brush` instead of a raw `Color`, so that's the reason why we used one.

Tweaking the sample messages a bit and taking a screenshots looks like this:

![Log levels' first steps]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/log-levels-first-steps.png){: .align-center}

As you can see, none of the elements is checked. We'll work on that soon. But first, let's add some colors to the messages!

## Message coloring

Now that all of the messages have a log level themselves, we could style the `LogEntryList` so each row has a color matching the configuration. That way, we can skip adding a new column with the name of the log level.

If all of our log levels and their colors were static resources we'd be defining them in XAML. Since we're configuring it externally, we must create the styles programatically.

To do that, let's update our `MainWindow.ConfigureLevels` like so:

{% highlight c# %}
public void ConfigureLevels(List<Tuple<string, string>> levels)
{
    // create log levels
    for(int i = 0; i < levels.Count; ++i)
    {
        LogLevels.Add(new LogLevel
        {
            Severity = i,
            Name = levels[i].Item1,
            Color = (Brush) new BrushConverter().ConvertFromString(levels[i].Item2)
        });
    }

    // style ListView based on the data from the log levels
    Style logListStyle = new Style();
    logListStyle.TargetType = typeof(ListViewItem);
    foreach(LogLevel level in LogLevels)
    {
        DataTrigger trigger = new DataTrigger();
        trigger.Binding = new Binding("Level");
        trigger.Value = level.Name;
        trigger.Setters.Add(new Setter(ListViewItem.ForegroundProperty, level.Color));

        logListStyle.Triggers.Add(trigger);
    }

    LogEntryList.ItemContainerStyle = logListStyle;
}
{% endhighlight %}

A style, as we can see, has the concept of a `DataTrigger`. It takes a `Binding` and a `Value` to test against, and if it matches then the `Setters` are applied. In our case just a text color, but we could use other styling. Finally, we assign the whole style to the `ItemContainerStyle`, which is the style for the `ListViewItem` entries.

This is the result:

![Styled log messages]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/styled-log-messages.png){: .align-center}

However, there's something missing, isn't it?

## Filtering

Alright, alright. We're happy with the results but we still can't do anything with these radio buttons! Let's see what's left.

We said we'd be adopting the usual _each log level has a severity and we can show all of the logs with a higher severity level than the selected one_. We've got as many radio buttons as log levels, and each one represents a severity (although we aren't displaying the number itself).

So, it looks like we only want one variable: the currently selected log level. But, how do we go from many radio buttons to a single value?

First of all, let's create a new variable in `MainWindow`:

{% highlight c# %}
public int CurrentLogLevelSeverity { get; set; }
{% endhighlight %}

Now, let's update our `LogLevel` class to this:

{% highlight c# %}
public class LogLevel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler PropertyChanged;

    public string Name     { get; set; }
    public Brush  Color    { get; set; }
    public int    Severity { get; set; }

    private bool m_selected;
    public  bool Selected
    {
        get
        {
            return m_selected;
        }
        set
        {
            m_selected = value;
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs("Selected"));
            }
        }
    }
}
{% endhighlight %}

It looks pretty similar to `LogSystem`, doesn't it?

Now, `MainWindow.ConfigureLevels`:

{% highlight c# %}
public void ConfigureLevels(List<Tuple<string, string>> levels)
{
    // create log levels
    for(int i = 0; i < levels.Count; ++i)
    {
        LogLevel entry = new LogLevel
        {
            Severity = i,
            Name = levels[i].Item1,
            Color = (Brush)new BrushConverter().ConvertFromString(levels[i].Item2)
        };

        entry.PropertyChanged += OnLevelSelectedChanged;

        LogLevels.Add(entry);
    }

    // [...]
}
{% endhighlight %}

So, whenever the `LogLevel` changes (when the user interacts with the radio buttons) we'll get notified. And what do we do then?

{% highlight c# %}
private void OnLevelSelectedChanged(object sender, PropertyChangedEventArgs args)
{
    LogLevel level = sender as LogLevel;

    if(level.Selected)
    {
        CurrentLogLevelSeverity = level.Severity;

        FilteredLogEntries.Refresh();
    }
}
{% endhighlight %}

Because the `Selected` property will be modified for both the radio button that's getting selected and the one that's being deselected, we just react to the former. We update the log level and ask the filter to be re-evaluated. But, we must update the filtering to have all this into account!

{% highlight c# %}
private bool LogEntriesFilterPredicate(object item)
{
    LogEntry entry = item as LogEntry;

    // filter out systems
    if(LogSystems.Any(s => s.Name == entry.System && !s.Enabled))
    {
        return false;
    }

    // filter out levels
    LogLevel level = LogLevels.First(l => l.Name == entry.Level);
    if(level != null && level.Severity < CurrentLogLevelSeverity)
    {
        return false;
    }

    return true;
}
{% endhighlight %}

Each message has the name of the log level it was logged with, and we have the severity we want to test against. So, we find out which `LogLevel` matches the given name and only keep those messages with a matching or greater severity. Bonus points if you can optimize this to prevent looking for the `LogLevel`.

And that's it! Let's take some screenshots!

![Filter by level: debug or higher]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/debug-or-higher.png){: .align-center}

![Filter by level: warning or higher]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/warning-or-higher.png){: .align-center}

![Filter by level: error or higher]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/error-or-higher.png){: .align-center}

Not bad! But can we improve the layout so it looks better?

![Final sample window]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/final-sample-window.png){: .align-center}

What about adding more systems and more log levels from the host program?

![Final sample window with extra configuration]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/final-sample-window-extra-configuration.png){: .align-center}

Congratulations, reader! You've got a configurable log window of your own! :)
