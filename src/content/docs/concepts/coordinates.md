---
title: Coordinates and rotation
description: What x, y and z mean on the robot, why depth is negative, radians, yaw, pitch and roll, and coordinate frames.
---

Nearly every number in this codebase is a position or an angle. If you get the signs wrong, the robot turns the wrong way into a wall. Luckily, the rules are simple, and we use the same ones everywhere.

## The three rules

1. **Forward is +x, left is +y, up is +z.**
1. **So underwater is negative z.** 1 m deep is `z = -1.0`.
1. **Angles are in radians, and positive turns to the left** (counter-clockwise, seen from above).

If you only remember one thing from this page, make it those three.

## x, y and z on the robot

Imagine standing on the robot, facing forward:

```text
   Seen from above                   Seen from the side

         +x (forward)                      +z (up)
          ▲                                 ▲
          │                                 │
   ┌──────┼──────┐                 ┌────────┼────────┐
   │      │      │                 │        │        │  ──► +x (forward)
   │      │      │                 └─────────────────┘
+y ◄──────●      │
(left)    │      │
   └─────────────┘
```

This is called **FLU**: Forward, Left, Up. It is the frame that all robots using ROS have agreed on, in a document called [REP 103](https://www.ros.org/reps/rep-0103.html).

Why does left count as positive? It comes from the **right-hand rule**. Point your right hand's fingers along +x (forward), curl them towards +y (left), and your thumb points along +z (up). All standard 3D coordinates work like this.

## Rotation: yaw, pitch and roll

The robot can rotate around each of its three axes:

| Name      | Rotates around | Feels like                         | Positive means               |
| --------- | -------------- | ---------------------------------- | ---------------------------- |
| **Yaw**   | z (up)         | Turning your head left and right   | Turn **left**                |
| **Pitch** | y (left)       | Nodding                            | Nose goes **down**           |
| **Roll**  | x (forward)    | Tilting your head to your shoulder | The right side goes **down** |

The right-hand rule tells you the positive direction for all of these. Point your thumb along the axis, and your fingers curl in the positive direction. Try it for yaw: thumb up, and your fingers curl to the left.

With the three moves along an axis, that makes the robot's **six degrees of freedom**, always written in this order in our messages: `[x, y, z, roll, pitch, yaw]`. You will also see these names for movement along each axis:

| Name      | Axis | Meaning          |
| --------- | ---- | ---------------- |
| **Surge** | x    | Forward and back |
| **Sway**  | y    | Side to side     |
| **Heave** | z    | Up and down      |

## Radians

We measure angles in **radians**, not degrees. A full circle is 2π radians.

| Degrees   | Radians       | In a mission        |
| --------- | ------------- | ------------------- |
| 0°        | 0             | `yaw="0.0"`         |
| 45° left  | π/4 ≈ 0.785   | `yaw="0.78539816"`  |
| 90° left  | π/2 ≈ 1.571   | `yaw="1.57079633"`  |
| 90° right | −π/2 ≈ −1.571 | `yaw="-1.57079633"` |
| half turn | π ≈ 3.142     | `yaw="3.14159265"`  |
| full turn | 2π ≈ 6.283    |                     |

To convert: radians = degrees × π ÷ 180. In Python, that's `math.radians(90)`.

## Frames: "relative to what?"

"x = 2" means nothing until you say 2 meters _from where_. A **frame** is a point and a set of directions to measure from. Two matter most.

### `odom`: fixed to the pool

`odom` is the frame positions are measured in. It stays still as the robot moves. It is set when the kill switch is released:

- **x and y are zero** where the robot was at that moment.
- **+x is the direction the robot was facing** at that moment, and yaw is zero there.
- **z is measured from the surface**, using the pressure sensor. It isn't reset.

So every run starts at about `x = 0, y = 0, yaw = 0`.

### `base_link`: fixed to the robot

`base_link` moves with the robot. Its +x is always the robot's nose.

### The difference, in missions

This is why `PosSetpoint` and `MoveRelative` act differently once the robot has turned:

```xml
<PosSetpoint x="1.0"/>     <!-- go to x = 1 in odom, whichever way the robot now faces -->
<MoveRelative x="1.0"/>    <!-- go 1 m forward, along the way the robot now faces -->
```

If the robot has turned 90° left, `MoveRelative x="1.0"` moves it in odom's +y direction. You can see that in the [mission tutorial](/tutorials/first-mission/#run-it).

### Camera frames

Cameras have their own convention, as in all of computer vision: **x right, y down, z forward** out of the lens. That's why a detection's bearing is positive to the _right_ of center and _below_ center. The mission converts it when it steers: a target to the right means a turn to the right, which is a _negative_ yaw.

### `base_link_ned` and Stonefish

You may spot **NED** (North, East, Down, where z points down) in two places. Stonefish, the simulator, uses it internally, and `sim_imu_remapper` and friends convert to our convention at that boundary. `base_link_ned` is the frame the mechanical drawings measure the robot in, so `marlin_v3.yaml` uses it for most mounting positions. Everything you write in a mission or a message uses the three rules at the top.

## The TF tree

Each sensor has its own frame, since each one is mounted somewhere different. ROS 2's **TF** system keeps track of how they all relate, so any node can ask "where is the front camera, relative to the robot's center?" Try it, with the simulator running:

```bash
ros2 run tf2_ros tf2_echo marlin_v3/base_link marlin_v3/front_camera
```

```text
At time 0.0
- Translation: [0.330, 0.000, 0.166]
- Rotation: in Quaternion (xyzw) [-0.500, 0.500, -0.500, 0.500]
- Rotation: in RPY (radian) [-1.571, 0.000, -1.571]
- Rotation: in RPY (degree) [-90.000, 0.000, -90.000]
```

So the front camera is 33 cm forward of the robot's center and 16.6 cm above it. The rotation is what turns FLU into the camera's "x right, y down, z forward". Press Ctrl-C to stop it.

[Architecture](/thalassic/architecture/#tf-tree) shows the whole tree.

## Quaternions

You will see rotations written as four numbers, `x, y, z, w`. This is a **quaternion**, a way of storing a rotation that avoids some problems with yaw, pitch and roll. You almost never need to read one by hand. Library functions convert them for you.

## See for yourself

With the simulator running:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 0, 0, 0, 1], position: [0.0, 0.0, 0.0, 0.0, 0.0, 1.57]}'
```

The last axis is yaw, so the robot turns 90° to the left. Change `1.57` to `-1.57` and it goes the other way. Where does the robot end up if you then send it to `x = 1`? Predict it, then try it.
