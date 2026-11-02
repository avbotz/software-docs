---
title: Thalassic reference
description: The full details of Thalassic, the ROS 2 software stack for AVBotz's Marlin V3 AUV.
---

Thalassic is the ROS 2 software stack for AVBotz's **Marlin V3** AUV (Autonomous Underwater Vehicle). It targets ROS 2 Jazzy (from RoboStack, via pixi) and uses Stonefish for physics simulation. The code is at [avbotz/thalassic](https://github.com/avbotz/thalassic).

These pages are the detailed reference, written for people who already know the codebase. If you are new, go to [Start here](/start-here/) first.

:::caution

These docs are mostly AI written. Proceed at your own risk: if a page and the code disagree, trust the code, and fix the page.

:::

## Pages

| Page | What it covers |
| --- | --- |
| [Setup & Build](/thalassic/setup/) | The pixi workflow, formatting, tests and CI, DDS discovery, GPUs, launch arguments, the workspace layout |
| [Architecture](/thalassic/architecture/) | Packages, nodes, topics, the TF tree |
| [Control System](/thalassic/control/) | Trajectory generator, model-based control law, thrust allocation and thruster failure, command interface, safety, tuning |
| [Mission System](/thalassic/mission/) | BehaviorTree.CPP mission XML, movement actions, and implementation boundaries |
| [sub_mission](/thalassic/sub-mission/) | The mission package: running it, trees and missions, pool-side values, vision primitives |
| [Vision Terms](/thalassic/vision/) | Detection, align, orient and sweep definitions for mission XML, and the model weights |
| [sub_vision](/thalassic/sub-vision/) | The perception package: topics, model loading and device selection, post-processors, messages |
| [Foxglove](/thalassic/foxglove/) | Connecting, the extensions, the layouts (teleop, tuning, autonomy) |
| [Simulation](/thalassic/simulation/) | Scenario generation, sim nodes, sensor bridges, performance, the course layout |
| [Recording](/thalassic/recording/) | A run's MCAP bag (`record:=true`): what it holds, its size, replay |
| [Networking](/thalassic/networking/) | Vehicle addresses, changing the subnet, MTU, time |
| [Deployment](/thalassic/deployment/) | Jetson provisioning, running on the vehicle, updates and rollbacks |
| [Vehicle OS configuration](/thalassic/jetson-os/) | What `deploy/jetson/setup.sh` installs, and why |
| [udev rules](/thalassic/udev/) | Stable device names on the vehicle |
| [Decisions](/thalassic/decisions/) | The rationale for the tooling and design choices |

## Quick start

```bash
git clone --recurse-submodules https://github.com/avbotz/thalassic.git
cd thalassic
scripts/install.sh        # first-time setup: pixi, the environment, the build, the models

pixi run up               # the simulation
pixi shell                # an interactive shell with ROS 2 and the workspace
```

## Common tasks

`pixi task list` shows them all.

| Command | Does |
| --- | --- |
| `pixi run build` | `colcon build` with the repo defaults (symlink + merge install), after removing the dangling symlinks that deleted files leave in `build/` and `install/` |
| `pixi run up` | Launch the simulation. Launch arguments go after `--`: `pixi run up -- mission:=pid_tuning` |
| `pixi run -e jetson up pool_test` | Launch with real hardware (on the vehicle, in its own environment) |
| `pixi run preflight` | Check the running stack before it goes in the water (`--sim` for the simulator) |
| `pixi run test` | Every package's tests, including a headless-simulator run of the whole stack |
| `pixi run format` | Format Python (ruff), C/C++ (clang-format) and shell (shfmt) |
| `pixi run lint` | Check formatting and lint without rewriting |
| `pixi run clean` | Delete `build/ install/ log/` |
| `pixi run reset` | Stop stray ROS processes and clear stale Fast DDS shared memory |
| `pixi run fetch-weights` | Download the models in `weights/manifest.toml` |
| `pixi run sync-mission` | Test the mission trees and copy them to the vehicle |

## Other repositories

| Repository | What it is |
| --- | --- |
| [maritime](https://github.com/avbotz/maritime) | Firmware for the board that drives the thrusters |
| [foxglove-extensions](https://github.com/avbotz/foxglove-extensions) | The Foxglove panels for driving, tuning and vision |
| [remora](https://github.com/avbotz/remora) | Turns bags into labelled datasets and trained models (private: ask a software lead for access) |
| [stonefish](https://github.com/avbotz/stonefish), [stonefish_ros2](https://github.com/avbotz/stonefish_ros2) | Our forks of the simulator and its ROS 2 bridge |
| [waterlinked_dvl](https://github.com/avbotz/waterlinked_dvl) | Our fork of the DVL driver |
| [software-docs](https://github.com/avbotz/software-docs) | This website and its diagrams |
