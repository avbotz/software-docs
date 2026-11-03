---
title: Coordinates and rotation
description: What x, y and z mean on the robot, why depth is negative, radians, yaw, pitch and roll, and coordinate frames.
---

Every position and angle in the code follows these rules. A wrong sign turns the robot the wrong way.

## The three rules

1. **Forward is +x, left is +y, up is +z.**
1. **So underwater is negative z.** 1 m deep is `z = -1.0`.
1. **Angles are in radians, and positive turns to the left** (counter-clockwise, seen from above).

## x, y and z on the robot

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

This is **FLU** (Forward, Left, Up), the convention all ROS robots use, defined in [REP 103](https://www.ros.org/reps/rep-0103.html).

Left is positive because of the **right-hand rule**: point your right hand's fingers along +x (forward) and curl them towards +y (left), and your thumb points along +z (up).

## Rotation: yaw, pitch and roll

| Name      | Rotates around | Feels like                         | Positive means               |
| --------- | -------------- | ---------------------------------- | ---------------------------- |
| **Yaw**   | z (up)         | Turning your head left and right   | Turn **left**                |
| **Pitch** | y (left)       | Nodding                            | Nose goes **down**           |
| **Roll**  | x (forward)    | Tilting your head to your shoulder | The right side goes **down** |

The right-hand rule gives each positive direction: point your thumb along the axis, and your fingers curl the positive way.

These three rotations and the three movements along the axes are the robot's **six degrees of freedom**, always in this order in our messages: `[x, y, z, roll, pitch, yaw]`. The movements also have names:

| Name      | Axis | Meaning          |
| --------- | ---- | ---------------- |
| **Surge** | x    | Forward and back |
| **Sway**  | y    | Side to side     |
| **Heave** | z    | Up and down      |

## Radians

Angles are in **radians**, not degrees. A full circle is 2π radians.

| Degrees   | Radians       | In a mission        |
| --------- | ------------- | ------------------- |
| 0°        | 0             | `yaw="0.0"`         |
| 45° left  | π/4 ≈ 0.785   | `yaw="0.78539816"`  |
| 90° left  | π/2 ≈ 1.571   | `yaw="1.57079633"`  |
| 90° right | −π/2 ≈ −1.571 | `yaw="-1.57079633"` |
| half turn | π ≈ 3.142     | `yaw="3.14159265"`  |
| full turn | 2π ≈ 6.283    |                     |

radians = degrees × π ÷ 180. In Python: `math.radians(90)`.

## Quaternions

ROS often stores a rotation as a **quaternion**: four numbers, `x, y, z, w`, which avoid some problems with yaw, pitch and roll. Library functions convert them, so you rarely read one by hand.

## Frames: "relative to what?"

A **frame** is the point and directions a position is measured from. Two matter most.

### `odom`: fixed to the pool

`odom` is the frame positions are measured in. It stays fixed while the robot moves, and is set when the kill switch is released:

- **x and y are zero** where the robot was at that moment.
- **+x is the direction the robot was facing** at that moment, and yaw is zero there.
- **z is measured from the surface**, using the pressure sensor. It isn't reset.

### `base_link`: fixed to the robot

`base_link` moves with the robot. Its +x is always the robot's nose.

### `odom` and `base_link` in missions

This is why `PosSetpoint` and `MoveRelative` act differently once the robot has turned:

```xml
<PosSetpoint x="1.0"/>     <!-- go to x = 1 in odom, whichever way the robot now faces -->
<MoveRelative x="1.0"/>    <!-- go 1 m forward, along the way the robot now faces -->
```

If the robot has turned 90° left, `MoveRelative x="1.0"` moves it in odom's +y direction, as in the [mission tutorial](/tutorials/first-mission/#run-it).

### Camera frames

Cameras use the computer vision convention: **x right, y down, z forward** out of the lens. So a detection's bearing is positive to the _right_ of center and _below_ center. The mission converts it when it steers: a target to the right means a turn to the right, which is a _negative_ yaw.

### `base_link_ned` and Stonefish

**NED** (North, East, Down: z points down) appears in two places. Stonefish, the simulator, uses it internally, and the simulator bridges such as `sim_imu_remapper` convert to FLU at that boundary. `base_link_ned` is the frame the mechanical drawings measure the robot in, so `marlin_v3.yaml` uses it for most mounting positions. Everything you write in a mission or a message follows [the three rules](#the-three-rules).

## The TF tree

Each sensor has its own frame. ROS 2's **TF** system tracks how they relate, so any node can ask where the front camera is relative to the robot's center. With the simulator running:

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

The front camera is 33 cm forward of the robot's center and 16.6 cm above it. The rotation turns FLU into the camera's "x right, y down, z forward". Ctrl-C stops it.

[Architecture](/thalassic/architecture/#tf-tree) shows the whole tree.

## Try it

With the simulator running:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 0, 0, 0, 1], position: [0.0, 0.0, 0.0, 0.0, 0.0, 1.57]}'
```

The last axis is yaw, so the robot turns 90° left; `-1.57` turns it right. Predict where it ends up if you then send it to `x = 1`, then try it.
