---
title: Glossary
description: Every term you will run into in AVBotz's software, in plain English.
---

## Robot and competition

| Term            | Meaning                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Actuator**    | A part that does something physical, other than the thrusters: torpedo launchers, marker droppers                                     |
| **Armed**       | The controller will run the thrusters: the kill switch has been cycled and the sensors are working                                    |
| **AUV**         | Autonomous Underwater Vehicle: a robot submarine with no driver                                                                       |
| **Buoyancy**    | The water's upward push. Our robot floats slightly                                                                                    |
| **DVL**         | Doppler Velocity Log. Measures the robot's speed by bouncing sound off the floor. [More](/concepts/sensors/#dvl-how-fast-am-i-moving) |
| **ESC**         | Electronic Speed Controller. The part that turns a command into power for a thruster                                                  |
| **Firmware**    | The code that runs on a small chip, like the one on the thruster board                                                                |
| **GigE**        | Gigabit Ethernet. The down camera connects with it                                                                                    |
| **IMU**         | Inertial Measurement Unit. Measures rotation and acceleration. [More](/concepts/sensors/#imu-how-am-i-rotated)                        |
| **Jetson**      | The NVIDIA Jetson AGX Orin, the robot's main computer                                                                                 |
| **Kill switch** | A physical switch that stops the thrusters                                                                                            |
| **maritime**    | Our [firmware](https://github.com/avbotz/maritime) for the thruster board                                                             |
| **Marlin V3**   | Our current robot                                                                                                                     |
| **MEB**         | The sealed box inside the robot that holds the electronics                                                                            |
| **Pinger**      | A device that emits sound underwater, used at RoboSub to mark some tasks                                                              |
| **Prop**        | An object in the course, such as the gate or the torpedo board                                                                        |
| **PWM**         | Pulse Width Modulation. A signal that encodes a value in the length of a pulse, and how the board commands the ESCs                   |
| **RoboSub**     | The competition we build the robot for, run by RoboNation                                                                             |
| **Teleop**      | Driving the robot by hand                                                                                                             |
| **Thalassic**   | Our ROS 2 software stack                                                                                                              |
| **Thruster**    | A motor and propeller. We have eight                                                                                                  |
| **Woollett**    | The Woollett Aquatics Center in Irvine, California, where RoboSub takes place                                                         |

## Movement and position

| Term               | Meaning                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`base_link`**    | The frame attached to the robot, with +x out of its nose                                                                                                  |
| **Dead reckoning** | Working out position by adding up speed over time. It drifts                                                                                              |
| **Depth**          | How far under the water. We store it as a negative z: 1 m deep is `z = -1`                                                                                |
| **Drift**          | An error that slowly grows over time                                                                                                                      |
| **ENU**            | East, North, Up: our world convention, with z up. The robot itself uses FLU                                                                               |
| **FLU**            | Forward, Left, Up. The directions of x, y and z on the robot                                                                                              |
| **Frame**          | A point and a set of directions to measure from. "x = 2" only means something relative to a frame. [More](/concepts/coordinates/#frames-relative-to-what) |
| **Heading**        | Which way the robot is facing: its yaw                                                                                                                    |
| **Heave**          | Moving up and down                                                                                                                                        |
| **NED**            | North, East, Down. A convention with z pointing down, used by Stonefish. We convert from it at the boundary                                               |
| **`odom`**         | The frame fixed to the pool, with x, y and yaw zeroed when the kill switch is released                                                                    |
| **Odometry**       | An estimate of position and speed. The main one is the `odometry/filtered` topic                                                                          |
| **Pitch**          | Rotation around y: nodding. Positive is nose down                                                                                                         |
| **Pose**           | A position and a rotation together                                                                                                                        |
| **Quaternion**     | Four numbers that store a rotation                                                                                                                        |
| **Radian**         | The unit of angle we use. A full circle is 2π radians                                                                                                     |
| **Roll**           | Rotation around x: tilting sideways. Positive lowers the right side                                                                                       |
| **Surge**          | Moving forward and back                                                                                                                                   |
| **Sway**           | Moving side to side                                                                                                                                       |
| **TF**             | The ROS 2 system that tracks how all the frames relate                                                                                                    |
| **Yaw**            | Rotation around z: turning left and right. Positive is left                                                                                               |

## Control

| Term                   | Meaning                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Allocator**          | The part of `sub_control` that shares a force across the thrusters                                                                         |
| **Anti-windup**        | Stops the I term growing without limit while the thrusters are at their maximum                                                            |
| **Controller**         | Code that works out how to push the robot to reach a target. Ours is `sub_control`                                                         |
| **EKF**                | Extended Kalman Filter. Combines sensors into one best estimate of the robot's position. [More](/concepts/sensors/#combining-them-the-ekf) |
| **Error**              | Target minus current: how far there is to go                                                                                               |
| **Feedforward**        | Calculating the force needed up front, from a model of the robot, instead of waiting for an error                                          |
| **Gain**               | A setting for how strongly the controller reacts                                                                                           |
| **PID**                | Proportional, Integral, Derivative. The classic way of correcting an error. [More](/concepts/control/#pid-one-letter-at-a-time)            |
| **Saturation**         | A thruster being asked for more than it can give                                                                                           |
| **Setpoint**           | A target value, such as a position to go to                                                                                                |
| **Steady-state error** | An error that remains once everything has settled                                                                                          |
| **Trajectory**         | A smooth path to a target over time                                                                                                        |
| **Tuning**             | Choosing gains so the robot responds well                                                                                                  |
| **Watchdog**           | A timer that takes action if something goes quiet                                                                                          |
| **Wrench**             | A combined force and turning force                                                                                                         |

## ROS 2

| Term              | Meaning                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ament`**       | ROS 2's build system underneath colcon. `ament_cmake` means a C++ package, and `ament_python` a Python one. [More](/concepts/build-tools/#inside-a-package-ament-cmake-and-setuptools) |
| **Bag**           | A recording of a run's topics. Ours are `.mcap` files. [More](/thalassic/recording/)                                                                                                   |
| **Callback**      | A function you write that something else calls, such as when a message arrives                                                                                                         |
| **DDS**           | The networking layer underneath ROS 2 that finds nodes and moves messages                                                                                                              |
| **Interface**     | A message or service definition                                                                                                                                                        |
| **Latched**       | A topic that gives its most recent message to anyone who subscribes late, such as `control/armed`                                                                                      |
| **Launch file**   | A Python file that starts many nodes with the right settings                                                                                                                           |
| **Message**       | One piece of data sent on a topic, with a type like `sensor_msgs/msg/Imu`                                                                                                              |
| **Namespace**     | A prefix on names, like a folder. Ours is `/marlin_v3`                                                                                                                                 |
| **Node**          | One program in the system                                                                                                                                                              |
| **Package**       | A folder of ROS 2 code, with a `package.xml`                                                                                                                                           |
| **Parameter**     | A setting on a node, which can often be changed while it runs                                                                                                                          |
| **Publish**       | Send a message on a topic                                                                                                                                                              |
| **QoS**           | Quality of Service. Settings for how a topic delivers messages, such as whether to retry lost ones                                                                                     |
| **rclpy, rclcpp** | The ROS 2 libraries for Python and C++                                                                                                                                                 |
| **`/rosout`**     | The topic that every node's log messages go to                                                                                                                                         |
| **ROS 2**         | The framework that lets our programs talk to each other. We use the Jazzy release                                                                                                      |
| **Service**       | A request and a reply, like calling a function in another node                                                                                                                         |
| **Sim time**      | The simulator's clock, published on `/clock`, which nodes use instead of real time                                                                                                     |
| **Subscribe**     | Listen to a topic                                                                                                                                                                      |
| **Topic**         | A named channel that nodes send messages on                                                                                                                                            |

## Missions

| Term                   | Meaning                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| **Action**             | A behavior tree step that does something, such as `MoveRelative`                             |
| **Behavior tree (BT)** | A structure for writing a robot's plan. [More](/concepts/behavior-trees/)                    |
| **Blackboard**         | The shared notepad that behavior tree steps use to pass values                               |
| **BT.CPP**             | [BehaviorTree.CPP](https://www.behaviortree.dev/docs/intro), the library that runs our trees |
| **Condition**          | A behavior tree step that checks something                                                   |
| **Decorator**          | A behavior tree step that changes how its one child behaves, such as `Timeout`               |
| **Fallback**           | Tries its children until one succeeds                                                        |
| **Groot2**             | An app that draws behavior trees and shows them running                                      |
| **Mission**            | A plan you can run, from `resources/missions/`                                               |
| **Port**               | A setting on a behavior tree step, like `z` in `PosSetpoint z="-1.0"`                        |
| **Sequence**           | Runs its children in order until one fails                                                   |
| **SubTree**            | Runs another tree by name, like calling a function                                           |
| **Tick**               | The signal that makes a behavior tree step run                                               |
| **Tree**               | A reusable task, from `resources/trees/`                                                     |

## Vision

| Term                  | Meaning                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Bearing**           | The angle from the center of the camera to something. [More](/concepts/vision/#from-a-box-to-a-direction)       |
| **Bounding box**      | A rectangle around a detected object                                                                            |
| **Calibration**       | Measuring a camera's properties, such as its focal length and lens distortion                                   |
| **Class**             | What kind of object a detection is, stored as a number                                                          |
| **Confidence, score** | How sure the network is, from 0 to 1                                                                            |
| **Detection**         | One object found in an image                                                                                    |
| **Inference**         | Running a trained network on an image                                                                           |
| **Label**             | The correct answer drawn on a training image                                                                    |
| **Model**             | A trained neural network, with its weights                                                                      |
| **ONNX**              | A standard file format for neural networks                                                                      |
| **ONNX Runtime**      | The library we use to run ONNX files                                                                            |
| **OpenCV**            | A library for image processing                                                                                  |
| **PnP**               | Perspective-n-Point. Works out an object's position and rotation from where its known points appear in an image |
| **Post-processor**    | Our task-specific code that runs after the network                                                              |
| **remora**            | Our tool for labelling data and training models                                                                 |
| **Training**          | Adjusting a network's weights using labelled images                                                             |
| **Weights**           | The numbers inside a neural network                                                                             |
| **YOLO**              | "You Only Look Once." The family of detection networks we use                                                   |

## Tools

| Term                          | Meaning                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Branch**                    | Your own line of work in git                                                                                                                |
| **CI**                        | Continuous Integration. Automatic checks that run on every pull request                                                                     |
| **clang-format, ruff, shfmt** | The tools that format our C++, Python and shell code                                                                                        |
| **clangd**                    | A tool that gives your editor C++ features, like jumping to definitions                                                                     |
| **CMake**                     | The tool that compiles a C++ package, as its `CMakeLists.txt` says. [More](/concepts/build-tools/#cmake-and-ament_cmake-c-packages)         |
| **colcon**                    | The tool that builds our ROS 2 packages. [More](/concepts/build-tools/#colcon)                                                              |
| **Commit**                    | A saved snapshot of your changes, with a message                                                                                            |
| **conda-forge**               | The package collection that most of our dependencies come from                                                                              |
| **CUDA**                      | NVIDIA's system for running computations on a GPU                                                                                           |
| **D2**                        | The language our diagrams are written in                                                                                                    |
| **Foxglove**                  | The app we use to see what the robot is doing and to drive it                                                                               |
| **Git hook**                  | A check that git runs automatically, for example when you commit                                                                            |
| **Headless**                  | Running without a window                                                                                                                    |
| **Lint**                      | Checking code for style problems and likely mistakes                                                                                        |
| **mise**                      | Installs pinned versions of tools. This website uses it                                                                                     |
| **pixi**                      | The tool that installs ROS 2 and everything else we depend on. [More](/concepts/build-tools/#pixi)                                          |
| **Pull request (PR)**         | A request to merge your branch into the team's code. [More](/tutorials/first-pull-request/)                                                 |
| **Repository (repo)**         | A project's code and its history, kept in git                                                                                               |
| **RoboStack**                 | Packages ROS 2 so pixi can install it                                                                                                       |
| **setuptools**                | The tool that installs a Python package, as its `setup.py` says. [More](/concepts/build-tools/#setuptools-and-ament_python-python-packages) |
| **Stonefish**                 | The underwater simulator we use                                                                                                             |
| **Submodule**                 | Another git repository included inside ours                                                                                                 |
| **WSL**                       | Windows Subsystem for Linux. Runs Linux inside Windows                                                                                      |
