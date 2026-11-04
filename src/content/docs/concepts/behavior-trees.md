---
title: Behavior trees
description: How the robot's plan is written. Ticks, statuses, sequences, fallbacks, decorators, subtrees and the blackboard.
---

A mission has to do things in order, retry what fails, and after a while give up and try something else. As `if` statements that quickly becomes unreadable, so missions are **behavior trees**, a structure from game AI, written in XML and run by the [BehaviorTree.CPP](https://www.behaviortree.dev/docs/intro) library.

## The idea

A behavior tree is a tree of steps called **nodes**, unrelated to ROS nodes.

About every 50 ms the tree gets a **tick**, which starts at the root and works its way down. Each ticked node reports one of three statuses:

| Status    | Meaning                        |
| --------- | ------------------------------ |
| `SUCCESS` | I finished, and it worked      |
| `FAILURE` | I finished, and it didn't work |
| `RUNNING` | I'm not done, so tick me again |

`PosSetpoint z="-1.0"` sends a command, then reports `RUNNING` on every tick until the robot gets there. Nothing blocks, so the tree can always respond, for example with a timeout.

## The kinds of node

**Leaf nodes**, written in C++, do the work:

- **Actions** do something: `PosSetpoint`, `MoveRelative`, `Stop`.
- **Conditions** answer a question: `DetectionVisible` succeeds if the camera can see the target.

**Control nodes** have children, and decide which to run:

| Node       | Rule                                                                                | It's like                                  |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `Sequence` | Runs its children in order. **Stops at the first failure.** Succeeds if they all do | "Do this, _and_ this, _and_ this"          |
| `Fallback` | Tries its children in order. **Stops at the first success.** Fails if they all do   | "Try this, _or else_ this, _or else_ this" |

**Decorators** have one child, and change how it behaves:

| Node                                    | What it does                                           |
| --------------------------------------- | ------------------------------------------------------ |
| `Timeout msec="150000"`                 | Gives up on its child, with `FAILURE`, after that time |
| `Repeat num_cycles="4"`                 | Runs its child 4 times                                 |
| `RetryUntilSuccessful num_attempts="3"` | Tries again if its child fails                         |
| `ForceSuccess`                          | Reports `SUCCESS` however its child ends               |
| `Inverter`                              | Swaps `SUCCESS` and `FAILURE`                          |

[Mission system](/thalassic/mission/#behavior-tree-xml) lists every node we have.

## Ports

A node's settings, like `z` in `PosSetpoint z="-1.0"`, are **ports**, declared in its C++ `providedPorts()` function ([the C++ tutorial](/tutorials/first-cpp-change/)). A tree that uses a port that doesn't exist refuses to load, which catches typos before the robot is in the water.

## Read one

This is part of the competition run, from `src/sub_mission/resources/trees/competition.xml`:

```xml
<SavePose name="torp_entry" yaw="{@task_entry_yaw}"/>
<Fallback name="torp">
  <Timeout msec="150000"><SubTree ID="TorpMission"/></Timeout>
  <SubTree ID="RecoverTaskEntry"/>
</Fallback>
```

1. `SavePose` remembers which way the robot is facing.
1. The `Fallback` tries its first child: the torpedo task, limited to 150 seconds.
1. If that succeeds, the `Fallback` succeeds, and the run moves on to the next task.
1. If the task fails _or_ takes too long, the `Fallback` tries its second child, `RecoverTaskEntry`, which stops the robot and turns it back to the heading saved in step 1.

## Subtrees

A `SubTree` runs another tree by name, like a function call. The trees are organized in two folders:

- `resources/trees/` holds reusable pieces, one for each task: `GateMission`, `TorpMission` and so on.
- `resources/missions/` holds what you can run. A mission can be just a few values and a call to a tree.

All the trees are loaded together, so any mission can use any tree, and `ID`s must be unique across all the files.

## The blackboard

Nodes share values through the **blackboard**. Blackboard entries are written in curly braces, and `@` means the top-level blackboard, which every subtree can see.

```xml
<!-- Remember where the robot is -->
<SavePose name="gate_home" x="{@gate_home_x}" y="{@gate_home_y}"/>

<!-- ...much later, go back there -->
<PosSetpoint x="{@gate_home_x}"/>
```

A `Script` also sets values. Each `pool_*.xml` mission uses one for the numbers that differ from pool to pool, then calls the shared run:

```xml
<Script code="@gate_exit_yaw := 0.34906585;
              @torp_search_yaw := -2.35619449;
              @octagon_search_yaw := -0.61086524"/>
<SubTree ID="CompetitionRun"/>
```

## Where the logic goes

**The order of things and what to do on failure go in XML. How to do something goes in C++.**

A different search pattern is an XML change. A new kind of movement that can't be built from existing nodes is a new C++ node, which any tree can then use.

## Watching a tree run: Groot2

[Groot2](https://www.behaviortree.dev/groot/) is a free app that draws a tree and shows it running live, with each node colored by its status. It is a separate download, not in the pixi environment.

1. Start a mission: `pixi run up -- mission:=pid_tuning`.
1. Open Groot2, switch to **Monitor** mode, enter `localhost` and port `5555`, and connect.

The free edition only monitors trees of up to 20 nodes. `prelim`, `pid_tuning` and the single `hard_coded_*` tasks fit, but the full `pool_*` runs don't. [Live Monitoring](/thalassic/mission/#live-monitoring-groot2) has the details.

Groot2 can also open `src/sub_mission/resources/Project.btproj` to show any tree as a diagram.

## Learn more

- Write one yourself in [Write a mission](/tutorials/first-mission/).
- The [BehaviorTree.CPP tutorials](https://www.behaviortree.dev/docs/intro) explain the library itself.
- [Mission system](/thalassic/mission/#trees-and-missions) explains how our trees are organized.
