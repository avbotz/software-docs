---
title: Behavior trees
description: How the robot's plan is written. Ticks, statuses, sequences, fallbacks, decorators, subtrees and the blackboard.
---

A mission has to do things in order, retry when things fail, give up after a while and try something else. You could write that as a giant pile of `if` statements, but it quickly becomes unreadable. Instead, we use a **behavior tree**, a structure first used for game AI. Our trees are XML files, run by a library called [BehaviorTree.CPP](https://www.behaviortree.dev/docs/intro).

## The idea

A behavior tree is a tree of steps, called **nodes**. (These aren't ROS nodes. It's an unfortunate overlap in names.)

Many times a second, the tree gets a **tick**, a signal that starts at the root and works its way down. In our case, that's about every 50 ms. Each node that gets ticked reports one of three things:

| Status    | Meaning                        |
| --------- | ------------------------------ |
| `SUCCESS` | I finished, and it worked      |
| `FAILURE` | I finished, and it didn't work |
| `RUNNING` | I'm not done, so tick me again |

`RUNNING` is what makes this work. `PosSetpoint z="-1.0"` sends a command, then reports `RUNNING` on every tick until the robot has got there, so nothing waits and the tree can always respond, such as with a timeout.

## The kinds of node

**Leaf nodes** do the actual work. They are written in C++:

- **Actions** do something: `PosSetpoint`, `MoveRelative`, `Stop`.
- **Conditions** answer a question: `DetectionVisible` succeeds if the camera can see the target.

**Control nodes** have children, and decide which to run:

| Node | Rule | It's like |
| --- | --- | --- |
| `Sequence` | Runs its children in order. **Stops at the first failure.** Succeeds if they all do | "Do this, _and_ this, _and_ this" |
| `Fallback` | Tries its children in order. **Stops at the first success.** Fails if they all do | "Try this, _or else_ this, _or else_ this" |

**Decorators** have one child, and change how it behaves:

| Node                                    | What it does                                           |
| --------------------------------------- | ------------------------------------------------------ |
| `Timeout msec="150000"`                 | Gives up on its child, with `FAILURE`, after that time |
| `Repeat num_cycles="4"`                 | Runs its child 4 times                                 |
| `RetryUntilSuccessful num_attempts="3"` | Tries again if its child fails                         |
| `ForceSuccess`                          | Reports `SUCCESS` however its child ends               |
| `Inverter`                              | Swaps `SUCCESS` and `FAILURE`                          |

## Read one

This is part of a real competition run, from `src/sub_mission/resources/trees/competition.xml`:

```xml
<SavePose name="torp_entry" yaw="{@task_entry_yaw}"/>
<Fallback name="torp">
  <Timeout msec="150000"><SubTree ID="TorpMission"/></Timeout>
  <SubTree ID="RecoverTaskEntry"/>
</Fallback>
```

Reading it from the top:

1. `SavePose` remembers which way the robot is facing.
1. The `Fallback` tries its first child: run the torpedo task, with a limit of 150 seconds.
1. If that succeeds, the `Fallback` succeeds, and the run moves on to the next task.
1. If the task fails _or_ takes too long, the `Fallback` tries its second child, `RecoverTaskEntry`. That stops the robot and turns it back to the heading saved in step 1.

In four lines, it says "try the torpedoes, but don't let them use up the whole run, and if it goes wrong, get ready for the next task". Imagine writing that with `if` statements, while also keeping the robot responsive.

## Subtrees

A `SubTree` runs another tree by name, as a function call does. It's how we keep things organized:

- `resources/trees/` holds reusable pieces, one for each task: `GateMission`, `TorpMission` and so on.
- `resources/missions/` holds the things you can actually run. A mission can be just a few values and a call to a tree.

All the trees are loaded together, so any mission can use any tree. That also means that `ID`s must be unique across all the files.

## The blackboard

Nodes often need to share data. One finds a value that a later one uses. The **blackboard** is a shared notepad for this. Values on it are written in curly braces, and the `@` means the top-level one, which every subtree can see.

```xml
<!-- Remember where the robot is -->
<SavePose name="gate_home" x="{@gate_home_x}" y="{@gate_home_y}"/>

<!-- ...much later, go back there -->
<PosSetpoint x="{@gate_home_x}"/>
```

You can also set values with a `Script`. Each `pool_*.xml` mission does this for the numbers that differ from pool to pool, then calls the shared run:

```xml
<Script code="@gate_exit_yaw := 0.34906585;
              @torp_search_yaw := -2.35619449;
              @octagon_search_yaw := -0.61086524"/>
<SubTree ID="CompetitionRun"/>
```

## Ports

The settings on a node, like `z` in `PosSetpoint z="-1.0"`, are called **ports**. Each node declares its ports in C++, in a function called `providedPorts()`, as you can see in [the C++ tutorial](/tutorials/first-cpp-change/). If your XML uses a port that doesn't exist, the tree refuses to load, which catches typos before the robot is in the water.

[The Mission System page](/thalassic/mission/#behavior-tree-xml) lists every node we have.

## Where the logic goes

We follow one rule for this: **the order of things and what to do on failure go in XML, and how to do something goes in C++.**

So to make the robot try a different search pattern, you edit XML. If you need a whole new kind of movement that can't be built from what's there, you write a new C++ node. Then it can be used from any tree.

## Watching a tree run: Groot2

[Groot2](https://www.behaviortree.dev/groot/) is a free app that draws a tree and shows it running live, with each node colored by its status. It's a separate download, as it isn't part of the pixi environment.

1. Start a mission: `pixi run up -- mission:=pid_tuning`.
1. Open Groot2, switch to **Monitor** mode, enter `localhost` and port `5555`, and connect.

The free edition only monitors trees of up to 20 nodes. `prelim`, `pid_tuning` and the single `hard_coded_*` tasks fit, but the full `pool_*` runs don't. [Live Monitoring](/thalassic/mission/#live-monitoring-groot2) has the details.

You can also open `src/sub_mission/resources/Project.btproj` in Groot2 to look at any tree as a diagram.

## Learn more

- Write one yourself in [Write a mission](/tutorials/first-mission/).
- The [BehaviorTree.CPP tutorials](https://www.behaviortree.dev/docs/intro) explain the library itself.
- [`sub_mission`](/thalassic/sub-mission/) explains how our trees are organized.
