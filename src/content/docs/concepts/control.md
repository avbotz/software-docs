---
title: Control and PID
description: What a controller does, how PID works, a small program to experiment with, and how it maps to sub_control.
---

When a mission says "go to 1 m deep", the **controller**, `sub_control`, works out how hard to push each thruster, every 20 milliseconds.

## The problem

The simplest controller pushes down at full power when the robot is above the target, and up otherwise. The robot reaches the target moving fast, overshoots, reverses at full power, and overshoots again, forever. Pushing harder the further away it is works better: that is the idea behind **PID**.

## PID, one letter at a time

The **error** is how far you are from where you want to be: `error = target − current`.

A PID controller adds up three terms, each with a setting called a **gain** that says how much it counts:

```text
command = Kp × error  +  Ki × (error added up over time)  +  Kd × (how fast the error is changing)
```

Save this as `toy_depth.py`. It simulates a pretend submarine, and needs only Python:

```python title="toy_depth.py"
"""A pretend submarine's depth under a PID controller. Change the three gains and run it again."""

KP = 3.0
KI = 0.0
KD = 0.0

TARGET_Z = -1.0  # metres; underwater is negative
BUOYANCY = 0.5   # the hull floats: a steady upward acceleration, m/s^2
DRAG = 0.5       # the water slows the sub down
DT = 0.02        # seconds per step: 50 Hz, like sub_control

z = 0.0          # start at the surface
velocity = 0.0
integral = 0.0

for step in range(int(30 / DT) + 1):
    if step % 150 == 0:
        print(f"t = {step * DT:4.0f} s    z = {z:6.2f} m")

    # The controller: what acceleration should we ask the thrusters for?
    error = TARGET_Z - z
    integral += error * DT
    command = KP * error + KI * integral - KD * velocity

    # The physics: what actually happens to the sub?
    acceleration = command + BUOYANCY - DRAG * velocity
    velocity += acceleration * DT
    z += velocity * DT
```

```bash
python3 toy_depth.py
```

### P: push harder the further away you are

With only `KP = 3.0`, which is how the file starts:

```text
t =    0 s    z =   0.00 m
t =    3 s    z =  -0.71 m
t =    6 s    z =  -0.97 m
t =    9 s    z =  -0.91 m
t =   12 s    z =  -0.84 m
t =   15 s    z =  -0.82 m
t =   18 s    z =  -0.83 m
...
t =   30 s    z =  -0.83 m
```

It wobbles, down to −0.97 and back up, and **it stops at −0.83, never reaching −1**: the hull floats, and at −0.83 `KP × error` exactly balances that upward push. This leftover error is **steady-state error**.

With a bigger `KP`, like 20, the leftover error shrinks, but the wobble gets much worse.

### D: slow down as you approach

The D term pushes against your speed, like a shock absorber. Set `KD = 3.0`:

```text
t =    0 s    z =   0.00 m
t =    3 s    z =  -0.80 m
t =    6 s    z =  -0.83 m
t =    9 s    z =  -0.83 m
...
t =   30 s    z =  -0.83 m
```

The wobble is gone, but it still stops at −0.83: at rest the speed is zero, so the D term does nothing.

### I: fix what is left

The I term adds up the error over time. As long as any error remains, it keeps growing and pushing harder. Set `KI = 1.0`:

```text
t =    0 s    z =   0.00 m
t =    3 s    z =  -1.11 m
t =    6 s    z =  -1.09 m
t =    9 s    z =  -1.01 m
t =   12 s    z =  -1.00 m
...
t =   30 s    z =  -1.00 m
```

It reaches the target: the I term has found the steady push that cancels the floating, without being told how much the hull floats.

It overshoots a little, to −1.11, because the target jumped instantly from 0 to −1. The real controller avoids that with a [trajectory generator](#1-trajectory-generator-make-a-smooth-path).

### Summary

| Term                 | It reacts to            | It fixes                                                          | Too much causes      |
| -------------------- | ----------------------- | ----------------------------------------------------------------- | -------------------- |
| **P** (proportional) | The error now           | Gets you moving towards the target                                | Wobbling             |
| **I** (integral)     | The error over time     | The leftover error from steady forces like floating, or a current | Slow overshoot       |
| **D** (derivative)   | How fast you are moving | Wobbling and overshoot                                            | Sensitivity to noise |

**Try it:** `[3, 1, 3]` are the depth gains `sub_control` uses in the simulator. Try to beat them on the toy, on speed or on overshoot.

## From the toy to the real controller

Unlike the toy, which has one axis and sets acceleration directly, `sub_control` controls six axes with eight thrusters. It works in three stages, 50 times a second:

```text
motion_setpoint ──► trajectory generator ──► control law ──► thrust allocator ──► control/thrusters
```

### 1. Trajectory generator: make a smooth path

Instead of jumping to the target, it plans a smooth path there within limits on speed, acceleration and how fast the acceleration changes. Following that path, the robot doesn't overshoot like the toy.

### 2. Control law: work out the force

This is the PID, plus a model of the robot. From the robot's approximate mass, drag and buoyancy, it calculates most of the force needed up front, which is called **feedforward**. PID only corrects what the model gets wrong.

The **gains** are in `src/sub_bringup/config/control/gains_sim.yaml`, one `[kp, ki, kd]` for each axis:

```yaml
gains:
  x: [1.92, 0.512, 2.4]
  # ...
  z: [3.0, 1.0, 3.0]
  # ...
  yaw: [4.32, 1.728, 3.6]
```

The velocity term uses measured velocity instead of how fast the error changes, and the integrators stop growing while the thrusters are at their limit, which is called **anti-windup**.

### 3. Thrust allocator: share it across the thrusters

The control law outputs a total force and turning force, a **wrench**. The allocator splits it across the eight thrusters within their limits. When that is impossible, it gives up the less important motion first, keeping depth and level over speed. A failed thruster's work goes to the others.

## Experiment on the real controller

Start the simulator and open a `pixi shell`. Parameters can change while it runs: read the depth gains, then weaken them and remove the I term:

```bash
ros2 param get /marlin_v3/sub_control gains.z
ros2 param set /marlin_v3/sub_control gains.z "[0.5, 0.0, 0.3]"
```

Send it to 1.5 m:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 1, 0, 0, 0], position: [0.0, 0.0, -1.5, 0.0, 0.0, 0.0]}'
```

After 30 seconds, check its depth:

```bash
ros2 topic echo --once --field pose.pose.position.z /marlin_v3/odometry/filtered
```

It stops at about **−1.2**, 30 cm short of its target: the toy's steady-state error, on the real controller. Put the gains back, and it reaches the target:

```bash
ros2 param set /marlin_v3/sub_control gains.z "[3.0, 1.0, 3.0]"
```

To break a thruster, tell the simulator that thruster 3 produces no thrust. The robot keeps going, as the I term takes up the missing thruster's share:

```bash
ros2 param set /marlin_v3/sim_thrusters effectiveness "[1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0]"
```

The `tuning_sim.json` Foxglove layout plots target, reference and measured values per axis, and has buttons for step tests. [Tuning](/thalassic/control/#tuning) describes how we choose gains for the real robot.

## Other things in `sub_control`

Besides moving the robot, it:

- **Arms:** it won't drive until the kill switch has been cycled and the sensors are working.
- **Watches its sensors**, and reacts when one goes quiet. See [What happens when a sensor fails?](/concepts/sensors/#what-happens-when-a-sensor-fails)
- **Reports what it's doing:** `control/status` has nearly every internal value, and `control/error` says how far there is to go.

## Learn more

- [Understanding PID Control](https://www.mathworks.com/videos/series/understanding-pid-control.html) is a short video series.
- [Control system](/thalassic/control/) is the full reference for `sub_control`.
