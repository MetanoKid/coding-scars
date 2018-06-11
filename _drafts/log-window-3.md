---
layout: single
title: "Log window from scratch: handy functionality and configuration (part 1)"
excerpt: "Configure the log window from the host application and add useful functionality like filters and auto-scroll"
author: Meta
category: Toolbox
tags:
  - Log
  - WPF
  - CSharp
  - MVVM
  - Class Library
  - Filter
  - System
series: Log window from scratch
---

Welcome to a new entry in the _Log window from scratch_ series, dear reader!

In the previous entry we converted our WPF window into a `Class Library` and created a _host program_ that consumed it. This time, we'll expose some configuration to the _host program_ and add some new functionality to the window. This way we can support several projects and make it more useful.

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

This will be the first addition that will modify our window's layout.

If you were to use the window as it is now, you would notice the scroll isn't moving unless you do it manually. This may be useful if you are reading some of the messages, but most of the time you may want it to scroll to the last message automatically.

We'll be adding a checkbox to our window that lets us activate or deactivate this functionality. This isn't something the _host program_ can choose to have or not, but something that's built-in. So our layout will be something like this:

![Doodle layout built-in configuration and log messages]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/doodle-built-in-configuration.png){: .align-center}

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

As you can see, we've wrapped everything into a `DockPanel` which allows us to resize the window and keep every control stretched as we want while keeping some parts fixed. This is how it looks:

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

By default, when a new item is added to the `ListView` that contains our log messages no scroll is performed. We'd want to know when an item is added to the list so we can perform the scroll ourselves.

Our `LogEntries` variable (which is an `ObservableCollection`) has a `CollectionChanged` event handler we can subscribe to. So, first of all let's create a method in our `MainWindow.xaml.cs` to handle the scroll:

{% highlight c# %}
private void OnLogEntriesChangedScrollToBottom(object sender, NotifyCollectionChangedEventArgs e)
{
    if (!IsAutoScrollEnabled)
    {
        return;
    }

    if (VisualTreeHelper.GetChildrenCount(LogEntryList) > 0)
    {
        Decorator border = VisualTreeHelper.GetChild(LogEntryList, 0) as Decorator;
        ScrollViewer scrollViewer = (ScrollViewer)VisualTreeHelper.GetChild(border, 0);
        scrollViewer.ScrollToBottom();
    }
}
{% endhighlight %}

Basically, we ask the `LogEntryList` `ListView` for its children, get the scroll control for the list and ask it to go to the bottom. We can also check the `NotifyCollectionChangedEventArgs` to know whether it was triggered because an item was added or deleted, if we wanted to.

Now, to tie it with our checkbox, add this:

{% highlight c# %}
LogEntries.CollectionChanged += OnLogEntriesChangedScrollToBottom;
{% endhighlight %}

We can now, also, refactor `IsAutoScrollEnabled` with just this:

{% highlight c# %}
public bool IsAutoScrollEnabled { get; set; }
{% endhighlight %}

Congratulations, you've got an auto-scrolling `ListView`!

# Per system filters

So far the new features are great additions, but how about being able to filter messages by their system?

Imagine you're working on program and there's some bug you're tracking down related to the _net communication_. Wouldn't it be awesome to filter out everything else and only read the logs for that system? Something easy like clicking on different checkboxes?

However, the goal of this log window is to be used in more than a single project and each one of them may have completely diferent systems. So, how do we do it?

## Configuration from the host

Remember our `LoggerUI` entry point? We're adding a new method to let the _host program_ tell us which systems it will be using so we can create as many checkboxes. This could be the outline:

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

As you can see, we take `LogEntries` and create a _view_ of the data. By the way, you may want to transfer the `CollectionChanged` event to this one so we apply the scroll when this one changes and not the unfiltered one. Then we assign our filter, which looks like this:

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

![Doodle layout with per-system filters]({{ '/' | absolute_url }}/assets/images/per-post/log-window-3/doodle-per-system-filter-layout.png){: .align-center}

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

Great job! Now you've got filters by system in an auto-scrolling `ListView`!

---

We've gone through some useful functionalities for our window, but we're missing an interesting one: log levels with colors!

Mind joining me in the next post of the series to complete it?

Thanks for reading!