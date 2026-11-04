---
title: What to learn
description: The skills that matter for working on the robot's software, free places to learn them, and how to tell when you know enough.
---

Do [Set up your computer](/start-here/setup/) and [Run the simulator](/start-here/run-the-simulator/) first: they teach the terminal by using it. Come back here when something doesn't make sense. Every resource here is free.

## The basics everyone needs

### The terminal

The terminal is a window where you control the computer by typing commands.

- Start with Ubuntu's [The Linux command line for beginners](https://ubuntu.com/tutorials/command-line-for-beginners).
- [The Missing Semester](https://missing.csail.mit.edu/) from MIT goes further.

**You know enough when** you can move between folders with `cd`, list files with `ls`, create and delete files, search with `grep`, stop a running program with Ctrl-C, and open a second terminal.

### Git

Git keeps the history of the code and lets many people work on it at once. GitHub is the website where our code lives.

- Start with [Learn Git Branching](https://learngitbranching.js.org/), an interactive game.
- [Pro Git](https://git-scm.com/book/en/v2) is the full book. Chapters 1 to 3 cover what you need.

**You know enough when** you can create a branch, commit a change and push it. [Your first pull request](/tutorials/first-pull-request/) does this on our code.

### Python

Python is our easiest language. The vision code, launch files and test scripts use it.

- If you have programmed a little: the official [Python tutorial](https://docs.python.org/3/tutorial/).
- If you have never programmed: any beginner Python course. Ask a teammate what they used.

**You know enough when** you can write a function and a class, and import a module. [Write a ROS 2 node](/tutorials/first-node/) only needs that much.

## What you can learn as you go

### ROS 2

ROS 2 is the framework that lets our programs talk to each other. [ROS 2, hands on](/start-here/ros-2-hands-on/) teaches the core ideas.

- The official [ROS 2 tutorials](https://docs.ros.org/en/jazzy/Tutorials.html) go deeper, starting with [Beginner: CLI tools](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools.html). Skip their installation steps: pixi has already installed ROS 2.

### C++

Our control, mission and driver code is C++. It is harder than Python, and you can do a lot before you need it: missions are XML, and vision is Python.

- [learncpp.com](https://www.learncpp.com/), a free course.

**You know enough to start when** you can read a class with a constructor and member functions, and understand what a reference (`&`) is. [Change the C++](/tutorials/first-cpp-change/) needs only that, since you copy the code around it.

### Math

High school math is enough for most of the code.

| Topic                         | Where it comes up                                                                        | Learn it from                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Trigonometry and radians      | Every angle in the code. See [Coordinates](/concepts/coordinates/)                       | [Khan Academy](https://www.khanacademy.org/math/trigonometry)                            |
| Vectors and matrices          | Rotations, sharing force between thrusters                                               | [3Blue1Brown's linear algebra series](https://www.3blue1brown.com/topics/linear-algebra) |
| Force, velocity, acceleration | The controller                                                                           | Your physics class                                                                       |
| Rates of change and integrals | The D and I in PID. [Control and PID](/concepts/control/) explains them without calculus |                                                                                          |

## Once you pick an area

| Area              | Learn from                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missions          | [BehaviorTree.CPP's tutorials](https://www.behaviortree.dev/docs/intro)                                                                                       |
| Control           | [Understanding PID Control](https://www.mathworks.com/videos/series/understanding-pid-control.html), a short video series by MathWorks                        |
| Vision            | [OpenCV-Python tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html) and the [Ultralytics docs](https://docs.ultralytics.com/) for YOLO models |
| State estimation  | [Kalman Filter from the Ground Up](https://www.kalmanfilter.net/), the basis of the EKF                                                                       |
| Coordinate frames | [Introducing tf2](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Tf2/Introduction-To-Tf2.html)                                                          |
