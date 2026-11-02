---
title: What to learn
description: The skills that matter for working on the robot's software, free places to learn them, and how to tell when you know enough.
---

You do not need to learn all of this before you start. Do [Set up your computer](/start-here/setup/) and [Run the simulator](/start-here/run-the-simulator/) first, because they teach you the terminal just by using it. Come back to this page when you hit something you don't understand.

All of these resources are free.

## The basics everyone needs

### The terminal

The terminal is a window where you control the computer by typing commands. Nearly everything in robotics happens there.

- Start with Ubuntu's [The Linux command line for beginners](https://ubuntu.com/tutorials/command-line-for-beginners). It takes an hour or two.
- [The Missing Semester](https://missing.csail.mit.edu/) from MIT is excellent once you want to go further.

**You know enough when** you can move between folders with `cd`, list files with `ls`, create and delete files, search with `grep`, stop a running program with Ctrl-C, and open a second terminal.

### Git

Git keeps the history of the code and lets many people work on it at once. GitHub is the website where our code lives.

- [Learn Git Branching](https://learngitbranching.js.org/) is an interactive game, and the best place to start.
- [Pro Git](https://git-scm.com/book/en/v2) is the full book. Chapters 1 to 3 cover what you need.

**You know enough when** you can create a branch, commit a change and push it. [Your first pull request](/tutorials/first-pull-request/) walks you through this on our code.

### Python

Python is the easiest of our languages to start with. The vision code, launch files and test scripts are written in it.

- The official [Python tutorial](https://docs.python.org/3/tutorial/) is good if you have programmed a little.
- If you have never programmed, ask a lead or a teammate what they learned from. Any beginner course is fine: the language matters more than the course.

**You know enough when** you can write a function and a class, and import a module. [Write a ROS 2 node](/tutorials/first-node/) only needs that much.

## What you can learn as you go

### ROS 2

ROS 2 is the framework that lets our programs talk to each other. You do not need to study it first. Our [hands-on page](/start-here/ros-2-hands-on/) teaches the core ideas using the real robot software.

- The official [ROS 2 tutorials](https://docs.ros.org/en/jazzy/Tutorials.html) go deeper. [Beginner: CLI tools](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools.html) is a good next step. Skip their installation steps, because pixi already installed ROS 2 for you.

### C++

Our control, mission and driver code is in C++. It is harder than Python, and you can do a lot on the team before you need it: missions are written in XML, and vision is written in Python.

- [learncpp.com](https://www.learncpp.com/) is the best free course there is.

**You know enough to start when** you can read a class with a constructor and member functions, and understand what a reference (`&`) is. [Change the C++](/tutorials/first-cpp-change/) is a gentle first step, because you copy the pattern of the code around it.

### Math

High school math is enough for most of the code, and you can pick it up as you need it.

| Topic | Where it comes up | Learn it from |
| --- | --- | --- |
| Trigonometry and radians | Every angle in the code. See [Coordinates](/concepts/coordinates/) | [Khan Academy](https://www.khanacademy.org/math/trigonometry) |
| Vectors and matrices | Rotations, sharing force between thrusters | [3Blue1Brown's linear algebra series](https://www.3blue1brown.com/topics/linear-algebra) |
| Force, velocity, acceleration | The controller | Your physics class |
| Rates of change and integrals | The D and I in PID. The idea is enough to start, and [Control and PID](/concepts/control/) explains it without calculus |  |

## Once you pick an area

These are for later. [Pick an area](/start-here/pick-an-area/) helps you choose.

| Area | Learn from |
| --- | --- |
| Missions | [BehaviorTree.CPP's tutorials](https://www.behaviortree.dev/docs/intro) |
| Control | [Understanding PID Control](https://www.mathworks.com/videos/series/understanding-pid-control.html), a short video series by MathWorks |
| Vision | [OpenCV-Python tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html) and the [Ultralytics docs](https://docs.ultralytics.com/) for YOLO models |
| State estimation | [Kalman Filter from the Ground Up](https://www.kalmanfilter.net/), which is what the EKF is built on |
| Coordinate frames | [Introducing tf2](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Tf2/Introduction-To-Tf2.html) |

Next: [set up your computer](/start-here/setup/).
