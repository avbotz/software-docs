---
title: Pick an area
description: The parts of the software you could work on, what each is like, and how to get started in it.
---

Do the [tutorials](/tutorials/first-mission/) first: they give you a taste of the main areas. Then pick one to go deeper in. You are not locked in, and most people end up working across a few.

Pick by what you find fun, not by what sounds impressive. The robot needs all of these.

| If you like... | Try |
| --- | --- |
| Puzzles and strategy, and seeing results quickly | [Missions](#missions) |
| Math and physics, making things stable | [Control](#control) |
| Images, machine learning | [Vision](#vision) |
| 3D graphics, building worlds | [Simulation](#simulation) |
| Hardware, things you can touch | [Drivers and firmware](#drivers-and-firmware) |
| Making things work reliably for everyone else | [Tools and infrastructure](#tools-and-infrastructure) |
| Explaining things | [Docs](#docs) |

## Missions

**You decide what the robot does:** which task comes next, how it searches for things, and what to do when something goes wrong. Competition points are won or lost here, and you can see your results in the simulator within minutes.

- **Languages:** XML to start with, then C++ for new steps.
- **Read:** [Behavior trees](/concepts/behavior-trees/), then [Mission System](/thalassic/mission/) and [`sub_mission`](/thalassic/sub-mission/).
- **Start with:** [Write a mission](/tutorials/first-mission/), then read `trees/slalom.xml` and work out what it does. Then run a `hard_coded_*` mission and try to improve it.

## Control

**You make the robot move precisely.** When a mission says "go there", control makes it happen, smoothly and without overshooting, even with a thruster failed.

- **Languages:** C++, and YAML for the settings.
- **Read:** [Control and PID](/concepts/control/), then [Control System](/thalassic/control/).
- **Start with:** Do the experiments on the [Control and PID](/concepts/control/) page. Then use the `tuning_sim.json` layout in Foxglove to plot how the robot responds to a step.

## Vision

**You teach the robot to see.** You train neural networks to find the props, write the code that turns a detection into a useful direction and distance, and gather and label the training data.

- **Languages:** Python.
- **Read:** [Computer vision](/concepts/vision/), then [Vision Terms](/thalassic/vision/) and [`sub_vision`](/thalassic/sub-vision/).
- **Start with:** Read `post_processors/octagon.py`, then `slalom.py`. Ask a lead for access to [remora](https://github.com/avbotz/remora), our labelling and training tool.

## Simulation

**You build the robot's practice pool.** A better simulator means that everyone can test more, and catch more bugs, before pool day. You work on the 3D models of the props, the lighting, and the physics of the robot.

- **Languages:** XML and Python, plus Blender for models. C++ if you go into the simulator itself.
- **Read:** [Simulation](/thalassic/simulation/).
- **Start with:** Change where something is in `scenarios/woollett.scn.j2` and see it move. [Course Layout](/thalassic/simulation/#course-layout) explains how a prop is put together.

## Drivers and firmware

**You make the software talk to the hardware:** the thruster board, sensors and cameras. You get to work with the real robot, and you will work closely with the electrical team.

- **Languages:** C++ for the drivers, and C on [Zephyr](https://zephyrproject.org/) for the firmware.
- **Read:** [Architecture](/thalassic/architecture/), [Networking](/thalassic/networking/), and the [maritime](https://github.com/avbotz/maritime) README.
- **Start with:** Read `sub_low.cpp`, and work out how a `control/thrusters` message becomes a line of text sent to the board.

## Tools and infrastructure

**You make everyone else faster:** the build system, automated tests, recording and replay, Foxglove panels, and deploying to the robot.

- **Languages:** Bash, Python, TypeScript and a lot of YAML.
- **Read:** [Build tools](/concepts/build-tools/), [Setup & Build](/thalassic/setup/), [Deployment](/thalassic/deployment/) and [Decisions](/thalassic/decisions/).
- **Start with:** Read `.github/workflows/ci.yml` and `scripts/install.sh`, and work out what happens when someone opens a pull request.

## Docs

**You make it possible for the next person to join.** New members are the best people to do this, since you can still see what is confusing. It also teaches you the whole system quickly, because you have to understand something to explain it.

- **Languages:** Markdown.
- **Start with:** The "Edit page" link at the bottom of any page. See [Your first pull request](/tutorials/first-pull-request/).

## Getting a real task

Once you have done the tutorials, ask a software lead for a first task. Say which area you are interested in, and they can suggest something small and useful. It is also fine to find a problem yourself and suggest fixing it.
