---
title: Welcome
description: Where to begin if you have just joined AVBotz software, even with no programming experience.
---

AVBotz is Amador Valley High School's robotics team. We build an underwater robot, **Marlin V3**, that drives itself through a course of tasks at RoboSub, an international competition. The software that makes it do that is called **Thalassic**, and this section is how you start working on it.

You do not need any experience. If you have never opened a terminal, that is fine: these pages tell you what to type, what you should see, and what it means.

:::tip[You cannot break the robot from here]

Everything in this section runs in a simulator on your own computer. There is no robot in the room. Try things, change numbers and see what happens. The worst case is that you delete the folder and clone it again.

:::

## The path

Do these in order. The times are rough, and it is normal to take longer.

|  | Page | What you get out of it | Time |
| --- | --- | --- | --- |
| 1 | [The big picture](/start-here/big-picture/) | What the robot does and how the pieces fit together | 20 minutes |
| 2 | [What to learn](/start-here/what-to-learn/) | Which skills matter, and free places to learn them | Skim it, come back later |
| 3 | [Set up your computer](/start-here/setup/) | Thalassic installed and built | An evening |
| 4 | [Run the simulator](/start-here/run-the-simulator/) | The robot swimming on your screen, and you driving it | 30 minutes |
| 5 | [ROS 2, hands on](/start-here/ros-2-hands-on/) | How the programs talk to each other, by watching them | An hour |
| 6 | [Tour of the code](/start-here/code-tour/) | Knowing where everything is | 30 minutes |
| 7 | [Pick an area](/start-here/pick-an-area/) | Which part of the software you want to work on | 10 minutes |

Then do the [tutorials](/tutorials/first-mission/). In them you write a mission, a ROS 2 node and some C++, and you open your first pull request.

The [Concepts](/concepts/coordinates/) pages explain the ideas underneath: coordinates, sensors, control, behavior trees and computer vision. Read them when a word stops making sense, or when you pick an area.

## How to use these pages

- **Run the commands.** You will learn far more from typing them than from reading them.
- **Do not try to memorize anything.** Everyone looks things up constantly.
- **Look up words you don't know.** The [glossary](/help/glossary/) has all of them. There is a search box at the top of every page.
- **Don't stay stuck.** Check [Troubleshooting](/help/troubleshooting/). If you have been stuck for 30 minutes, ask in the team's software chat. Asking is not a failure, and it often shows us a page that needs fixing.
- **Fix what confuses you.** You are the only person who can tell us what is confusing, because you are the one reading it for the first time. Every page has an "Edit page" link at the bottom, and [your first pull request](/tutorials/first-pull-request/) can be exactly that.

## Can you trust these pages?

These pages were written with AI help. The pixi, ROS 2, build and test commands in "Start here" and the tutorials were all run on a real Ubuntu laptop on November 1, 2026, against Thalassic commit `19d46f3`, and the output shown is real. Some things could not be checked that way: installing Ubuntu, VS Code and Foxglove, the menus and panels in Foxglove and Groot2, and the steps that need a GitHub account.

Code changes faster than docs do. If a page and the code disagree, the code is right, and the page needs a fix.
