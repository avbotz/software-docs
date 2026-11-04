---
title: Pick an area
description: The parts of the software you could work on, what each is like, and how to get started in it.
---

After the [tutorials](/tutorials/first-mission/), which touch most of these areas, pick one to go deeper in. Most people end up working across a few.

| If you like...                                   | Try                                                   |
| ------------------------------------------------ | ----------------------------------------------------- |
| Puzzles and strategy, and seeing results quickly | [Missions](#missions)                                 |
| Math and physics, making things stable           | [Control](#control)                                   |
| Images, machine learning                         | [Vision](#vision)                                     |
| 3D graphics, building worlds                     | [Simulation](#simulation)                             |
| Hardware, things you can touch                   | [Drivers and firmware](#drivers-and-firmware)         |
| Making things work reliably for everyone else    | [Tools and infrastructure](#tools-and-infrastructure) |
| Explaining things                                | [Docs](#docs)                                         |

## Missions

**You decide what the robot does:** which task comes next, how it searches for things, and what to do when something goes wrong. Results show in the simulator within minutes.

- **Languages:** XML to start with, then C++ for new steps.
- **Read:** [Behavior trees](/concepts/behavior-trees/), then [Mission system](/thalassic/mission/).
- **Start with:** [Write a mission](/tutorials/first-mission/), then read `trees/slalom.xml` and work out what it does. Then run a `hard_coded_*` mission and try to improve it.

## Control

**You make the robot move precisely:** when a mission says "go there", control gets it there smoothly, without overshooting, even with a failed thruster.

- **Languages:** C++, and YAML for the settings.
- **Read:** [Control and PID](/concepts/control/), then [Control system](/thalassic/control/).
- **Start with:** The experiments in Control and PID. Then plot the robot's step response with the `tuning_sim.json` layout in Foxglove.

## Vision

**You teach the robot to see:** train neural networks to find the props, turn detections into a direction and distance, and gather and label the training data.

- **Languages:** Python.
- **Read:** [Computer vision](/concepts/vision/), then [Vision system](/thalassic/vision/).
- **Start with:** Read `post_processors/octagon.py`, then `slalom.py`. Ask a lead for access to [remora](https://github.com/avbotz/remora), our labelling and training tool.

## Simulation

**You build the robot's practice pool:** the 3D models of the props, the lighting, and the robot's physics.

- **Languages:** XML and Python, plus Blender for models. C++ if you go into the simulator itself.
- **Read:** [Simulation](/thalassic/simulation/).
- **Start with:** Move a prop in `scenarios/woollett.scn.j2` and watch it move in the simulator. [Course layout](/thalassic/simulation/#course-layout) explains how a prop is put together.

## Drivers and firmware

**You make the software talk to the hardware:** the thruster board, sensors and cameras. You work with the real robot, and closely with the electrical team.

- **Languages:** C++ for the drivers, and C on [Zephyr](https://zephyrproject.org/) for the firmware.
- **Read:** [Architecture](/thalassic/architecture/), [Networking](/thalassic/networking/), and the [maritime](https://github.com/avbotz/maritime) README.
- **Start with:** Read `sub_low.cpp`, and work out how a `control/thrusters` message becomes a line of text sent to the board.

## Tools and infrastructure

**You make everyone else faster:** the build system, automated tests, recording and replay, Foxglove panels, and deploying to the robot.

- **Languages:** Bash, Python, TypeScript and a lot of YAML.
- **Read:** [Build tools](/concepts/build-tools/), [Setup and build](/thalassic/setup/), [Deployment](/thalassic/deployment/) and [Decisions](/thalassic/decisions/).
- **Start with:** Read `.github/workflows/ci.yml` and `scripts/install.sh`, and work out what happens when someone opens a pull request.

## Docs

**You write and fix these pages.** New members are well placed to do this: they can still see what is confusing.

- **Languages:** Markdown.
- **Start with:** The "Edit page" link at the bottom of any page. See [Your first pull request](/tutorials/first-pull-request/).

## Getting a real task

Ask a software lead for a small first task in your area, or find a problem yourself and propose a fix.
