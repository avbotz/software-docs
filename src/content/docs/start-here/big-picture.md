---
title: The big picture
description: What an autonomous underwater robot does, what is inside Marlin V3, and how the software turns what it sees into thruster commands.
---

## What is an AUV?

AUV stands for **Autonomous Underwater Vehicle**: a submarine with no driver. Once a run starts, nobody controls it. There is a good reason for that: radio barely travels through water, so you could not steer it remotely or use GPS even if you wanted to. The robot has to work out where it is and what to do by itself.

That is the software team's job. The mechanical team builds the robot and the electrical team wires it up. We write the part that decides what it does.

## What is RoboSub?

[RoboSub](https://robonation.org/programs/robosub/) is the competition we build the robot for. Teams from around the world bring their AUVs to a pool and run them through a course of tasks, with points for each one. A breach of the surface in the wrong place ends the run, so the robot has to be careful as well as clever.

Our run in 2026 tries these tasks, in this order:

| Task | What the robot does |
| --- | --- |
| Coin flip | Starts in a random direction, and has to find the gate anyway |
| Gate | Swims through one side of a gate, which picks the "role" it plays for the rest of the run |
| Slalom | Weaves through rows of red and white pipes, keeping to the correct side |
| Torpedoes | Fires small torpedoes through the openings in a board |
| Octagon | Finds the octagon and comes up to the surface inside it |
| Return home | Swims back through the gate |

The tasks change each year. The [handbook](https://robonation.org/programs/robosub/) has the official rules, and the 2027 competition is at the same pool in August 2027.

## What is inside Marlin V3?

| Part | What it does | What it is |
| --- | --- | --- |
| Computer | Runs all our software | NVIDIA Jetson AGX Orin, running Ubuntu Linux |
| Thrusters | Eight propellers that push the robot. Four point up and down, four point sideways at an angle, so it can move in any direction | Blue Robotics T200 |
| Thruster board | A small computer that talks to the thrusters, reads the depth and watches the kill switch. It runs our [firmware](https://github.com/avbotz/maritime), called _maritime_ | Raspberry Pi Pico |
| Front camera | Looks ahead for the gate, pipes and torpedo board | Logitech C922 |
| Down camera | Looks at the pool floor | FLIR Blackfly S |
| IMU | Feels how the robot is rotating | NaviGuider |
| DVL | Bounces sound off the pool floor to measure how fast the robot is moving | Water Linked A50 |
| Pressure sensor | Measures water pressure, which tells us the depth | Read by the thruster board |
| Kill switch | A physical switch that stops the thrusters. Nothing moves until it has been cycled | Read by the thruster board |
| Actuators | Torpedo launchers and marker droppers | Driven by the thruster board |

[Sensors](/concepts/sensors/) explains how the sensors work.

## Sense, think, act

Nearly every robot is this loop: **sense** the world, **think** about what to do, **act**, and go around again.

[![The robot's loop. Sense: cameras, DVL, IMU, pressure sensor. Think: sub_vision and the EKF feed sub_mission, which commands sub_control. Act: sub_low, the maritime board and the thrusters.](/diagrams/thalassic/big-picture.svg)](/diagrams/thalassic/big-picture.svg)

Each box in the middle is its own program, and each asks one question:

| Program | Its question | Details |
| --- | --- | --- |
| `sub_vision` | **What can I see?** Finds objects in camera images using a neural network | [Computer vision](/concepts/vision/) |
| EKF | **Where am I?** Combines the sensors into one best guess of the robot's position | [Sensors](/concepts/sensors/) |
| `sub_mission` | **What should I do next?** Follows the plan for the run, written as a _behavior tree_ | [Behavior trees](/concepts/behavior-trees/) |
| `sub_control` | **How do I get there?** Works out how hard to push each thruster | [Control and PID](/concepts/control/) |
| `sub_low` | Passes the thruster commands to the board over USB | [Architecture](/thalassic/architecture/) |

Splitting it up like this means that you can work on one piece without understanding the others. Someone writing a mission just says "go to this depth", and does not need to know how the thrusters achieve it.

## Follow one decision

Here is what happens when the robot steers towards the gate.

1. The front camera takes a picture, 24 times a second, and publishes it on a _topic_ called `front_camera/image_raw`.
1. `sub_vision` runs its neural network on the image and finds the gate. It works out the angle to it, say 0.2 radians right of center, and publishes that on `vision/detections`.
1. `sub_mission` is partway through its plan, on a step called `AlignToDetection`. It reads the detection and decides "turn 0.2 radians to the right", which it publishes on `motion_setpoint`.
1. `sub_control`, which runs 50 times a second, compares that target with where the robot is now (from the EKF, on `odometry/filtered`). It works out the force needed, shares it across the eight thrusters, and publishes their commands on `control/thrusters`.
1. `sub_low` sends the commands to the thruster board as a line of text over USB.
1. The firmware on the board sends each thruster's speed controller a pulse, and the propellers spin.
1. The robot turns. The IMU feels it, the EKF updates its guess, the next camera frame shows the gate closer to center, and the loop goes around again.

All of that takes a fraction of a second. You can watch it happen on your own computer in [ROS 2, hands on](/start-here/ros-2-hands-on/).

## The simulator

We cannot put the robot in a pool every time we change a line of code. So we have a **simulator**, [Stonefish](https://github.com/patrykcieslak/stonefish), which models the physics of the robot in water and renders what its cameras would see. This is what a camera sees in the simulator:

![The simulated front camera's view underwater: the pool floor, the lane lines, the slalom pipes in front of the robot, and the gate in the distance.](/images/sim-front-camera.jpg)

The clever part is that **most of the software has no idea it is in a simulator.** On the robot, a driver program reads the real IMU and publishes `imu/data`. In the simulator, a small program called `sim_imu_remapper` publishes `imu/data` instead, in exactly the same format. `sub_control` reads `imu/data` either way.

| On the robot | In the simulator |
| --- | --- |
| `naviguider_imu_driver` | `sim_imu_remapper` |
| `waterlinked_dvl_driver` | `sim_dvl_remapper` |
| `sub_low` and the board | `sim_thrusters`, `sim_pressure_to_depth` and `sim_kill_switch` |
| Camera drivers | Stonefish's cameras |
| `sub_vision`, the EKF, `sub_mission`, `sub_control` | The same programs |

So a mission you test on your laptop is the same mission that runs on the robot. That said, the simulator is not the real world: its images do not look quite like real pool footage, and the neural networks trained on real images do poorly on them. It is very good for testing logic and control, and less good for testing vision.

## Staying safe

A 36 kg robot with eight propellers can hurt someone, so safety is built into several layers. The important one to know is the **kill switch**: a physical switch on the robot. When it is engaged, the thrusters stop. And when the software starts up, it refuses to run the thrusters until the switch has been engaged and released at least once, so a robot that reboots cannot suddenly drive off.

If the software crashes, the board notices that commands have stopped and turns the thrusters off by itself after half a second. The robot is built to float slightly, so with the thrusters off it comes back up to the surface. The [Safety](/thalassic/control/#safety) section has the full list.

## The whole thing

When you are ready for the full picture of the real robot, here is every program and how they connect. Click the diagram to open it full size, where you can zoom in.

[![The full Marlin V3 ROS graph: devices, drivers, vision, the EKF, sub_mission, sub_control and the Foxglove bridge.](/diagrams/thalassic/vehicle-ros-graph.svg)](/diagrams/thalassic/vehicle-ros-graph.svg)

Next: [what to learn](/start-here/what-to-learn/).
