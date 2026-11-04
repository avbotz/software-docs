---
title: The big picture
description: A high-level overview of what the software team does
---

## What is an AUV?

AUV stands for **Autonomous Underwater Vehicle**, effectively an autonomous underwater drone / miniature submarine.

The software team makes sure the AUV can move and navigate the competition course autonomously while completing its tasks. We work closely with the electrical and mechanical divisions and are responsible for ensuring proper integration of all components in the system.

## What is RoboSub?

At [RoboSub](https://robonation.org/programs/robosub/), teams run their AUVs through a course of tasks in a pool, scoring points for each. Surfacing ends the run.

Tasks from the 2026 competition year:

| Task        | Picture                                                                                                                                                                                              | What the robot does                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Coin flip   | [![The coin flip: on heads the robot starts parallel to the gate, on tails with its tail toward it.](/images/robosub-2026/coin-flip.jpg)](/images/robosub-2026/coin-flip.jpg)                        | Starts in a random direction and has to find the gate                                                                             |
| Gate        | [![The gate from the front and back: 3 m wide, with a red divider in the middle and a role's images on each side.](/images/robosub-2026/gate.jpg)](/images/robosub-2026/gate.jpg)                    | Swims through one side of a gate, which picks the "role" it plays for the rest of the run                                         |
| Slalom      | [![The slalom: three rows of a white, a red and a white pipe, and a path through them that keeps each red pipe on the same side.](/images/robosub-2026/slalom.jpg)](/images/robosub-2026/slalom.jpg) | Navigates through rows of red and white pipes, staying on the correct side of the poles                                           |
| Bins        | [![The bins: four crates along a PVC pipeline, two with a fire image inside and two with a blood drop.](/images/robosub-2026/bins.jpg)](/images/robosub-2026/bins.jpg)                               | Drops a marker into each of the two bins with its role's image inside                                                             |
| Torpedoes   | [![The torpedo board: two large and two small openings, marked with a fire, a blood drop, a fire truck and an ambulance.](/images/robosub-2026/torpedoes.jpg)](/images/robosub-2026/torpedoes.jpg)   | Fires small torpedoes through the openings in a board                                                                             |
| Octagon     | [![The table from above and from the side: items with images on top, and a basket on each of two edges.](/images/robosub-2026/table.jpg)](/images/robosub-2026/table.jpg)                            | Finds the octagon floating on the surface and comes up inside it. On a table under it are items to put in the basket for its role |
| Return home |                                                                                                                                                                                                      | Swims back through the gate                                                                                                       |

The tasks change each year (though they generally stay somewhat similar). The [handbook](https://robonation.org/app/uploads/sites/4/2026/07/RoboSub-2026_Team-Handbook_20260711-compressed.pdf) has the official rules and more details.

## What is inside Marlin V3?

| Part            | What it does                                                                                                                                 | Model                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Computer        | Runs our high-level codebase [Thalassic](https://github.com/avbotz/thalassic)                                                                | NVIDIA Jetson AGX Orin, running Ubuntu 24.04    |
| Thrusters       | Four vertical and four angled sideways, providing 6-DOF movemement (can move in any direction). Brushless motors.                            | Blue Robotics T200                              |
| Thruster ESCs   | Reads a high-level throttle command and converts it to electrical signal to drive the thrusters                                              | Blue Robotics Basic ESC                         |
| MCU Board       | Interacts with thruster ESCs, reads the depth and watches the kill switch. Runs our firmware, [maritime](https://github.com/avbotz/maritime) | Raspberry Pi Pico                               |
| Front camera    | Looks ahead for the gate, pipes and torpedo board                                                                                            | Logitech C922                                   |
| Down camera     | Looks at the pool floor                                                                                                                      | FLIR Blackfly S                                 |
| IMU             | Measures how the robot is rotating                                                                                                           | NaviGuider (UART)                               |
| DVL             | Bounces sound off the pool floor to measure the AUV's speed                                                                                  | Water Linked A50                                |
| Pressure sensor | Measures depth from water pressure                                                                                                           | Ashcroft K1                                     |
| Kill switch     | A physical switch that stops the thrusters. Nothing moves until it has been cycled                                                           | Custom Water Proof Switch + Relay               |
| Actuators       | Torpedo launchers and marker droppers                                                                                                        | Blue Trail Underwater Servo SER-110X / SER-120X |

[![Big picture](/diagrams/thalassic/big-picture.svg)](/diagrams/thalassic/big-picture.svg)

Each box in the middle is its own program, answering one question:

| Program       | Its question                                                                          | Details                                     |
| ------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `sub_vision`  | **What can I see?** Finds objects in camera images using a neural network             | [Computer vision](/concepts/vision/)        |
| EKF           | **Where am I?** Combines the sensors into one best guess of the robot's position      | [Sensors](/concepts/sensors/)               |
| `sub_mission` | **What should I do next?** Follows the plan for the run, written as a _behavior tree_ | [Behavior trees](/concepts/behavior-trees/) |
| `sub_control` | **How do I get there?** Works out how hard to push each thruster                      | [Control and PID](/concepts/control/)       |
| `sub_low`     | Passes the thruster commands to the board over USB                                    | [Architecture](/thalassic/architecture/)    |

So you can work on one piece without understanding the others: a mission says "go to this depth" without knowing how the thrusters get there.

### Example: steering towards the gate

1. The front camera publishes a picture 24 times a second on a _topic_, `front_camera/image_raw`.
1. `sub_vision` finds the gate in the image with its neural network, and publishes the angle to it, say 0.2 radians right of center, on `vision/detections`.
1. `sub_mission`, on the `AlignToDetection` step of its plan, reads the detection and publishes "turn 0.2 radians right" on `motion_setpoint`.
1. `sub_control`, 50 times a second, compares that target with the robot's position from the EKF (`odometry/filtered`), works out the force needed, allocates it across the eight thrusters, and publishes their commands on `control/thrusters`.
1. `sub_low` sends the commands to the thruster board as a line of text over USB.
1. The firmware on the board sends each thruster's speed controller a pulse, and the propellers spin.
1. The robot turns. The IMU senses it, the EKF updates, the next frame shows the gate closer to center, and the loop repeats.

## The simulator

To test without a pool, we use a **simulator**, [Stonefish](https://github.com/patrykcieslak/stonefish), which models the robot's physics in water and renders what its cameras would see:

![The simulated front camera's view underwater](/images/sim-front-camera.jpg)

Ideally, as little of our codebase will know whether it is running on the robot or in the simulator. Topics involving interacting with sensors, thrusters, and other physical devices are provided from the simulator rather than the real devices.

## Safety features

Various safety features are built into various layers of the system. The main safety feature is the **kill switch**, a physical switch on the robot. When placed in a killed position, it disconnects the thrusters ESCs (and by extension the thrusters) from power.

There are also safety features implemented in software. Refer to [Safety](/thalassic/control/#safety) for the full list.

## The full system

Every program on the real robot, and how they connect:

[![Full vehicle ROS graph](/diagrams/thalassic/vehicle-ros-graph.svg)](/diagrams/thalassic/vehicle-ros-graph.svg)
