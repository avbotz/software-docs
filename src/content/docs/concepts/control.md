---
title: Control and PID
description: What a controller does, how PID works, a small program to experiment with, and how it maps to sub_control.
---

When a mission says "go to 1 m deep", something has to work out how hard to push each thruster, right now and again 20 milliseconds from now. That is the **controller**. In our code, it is `sub_control`.

## The problem

Here's a first idea: "if the robot is above the target, push down at full power, and otherwise push up". Try picturing it. The robot accelerates down, reaches the target while moving quickly, overshoots, reverses at full power, overshoots again, and so on forever. Pushing harder as you get further away is better, which is the idea behind **PID**.

## PID, one letter at a time

The **error** is how far you are from where you want to be: `error = target − current`.

A PID controller adds up three terms, each with a setting called a **gain** that says how much it counts:

```text
command = Kp × error  +  Ki × (error added up over time)  +  Kd × (how fast the error is changing)
```

The best way to understand these is to play with them. Save this as `toy_depth.py`. It simulates a pretend submarine, and needs nothing but Python:

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

There are two problems with this. It wobbles: it goes down to −0.97, then back up. And then **it gives up at −0.83, never reaching −1**. Why? Because the hull floats, there is a constant push upward. At −0.83, the error is small enough that `KP × error` exactly balances the floating, so nothing moves any more. This leftover error is called **steady-state error**.

Try a bigger `KP`, like 20. The leftover error shrinks, but the wobble gets much worse. Turning up P alone is not the answer.

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

The wobble is gone. The robot comes in smoothly. But it still stops at −0.83, because at rest the speed is zero, so the D term does nothing.

### I: fix what is left

The I term adds up the error over time. As long as any error remains, however small, it keeps growing and pushing harder. Set `KI = 1.0`:

```text
t =    0 s    z =   0.00 m
t =    3 s    z =  -1.11 m
t =    6 s    z =  -1.09 m
t =    9 s    z =  -1.01 m
t =   12 s    z =  -1.00 m
...
t =   30 s    z =  -1.00 m
```

It reaches the target exactly. The I term has found just the right steady push to cancel the floating, without anyone telling it how much the hull floats.

It does overshoot a little, to −1.11. The target jumped instantly from 0 to −1, which is an abrupt thing to ask for. The real controller avoids that, as you are about to see.

### Summary

| Term | It reacts to | It fixes | Too much causes |
| --- | --- | --- | --- |
| **P** (proportional) | The error now | Gets you moving towards the target | Wobbling |
| **I** (integral) | The error over time | The leftover error from steady forces like floating, or a current | Slow overshoot |
| **D** (derivative) | How fast you are moving | Wobbling and overshoot | Sensitivity to noise |

**Try it:** the gains above, `[3, 1, 3]`, are the real ones `sub_control` uses for depth in the simulator. Can you find better ones for the toy? What's "better": getting there faster, or with less overshoot?

## From the toy to the real controller

The toy has one axis and asks for acceleration directly. `sub_control` has six axes, and has to produce it using eight thrusters. It does this in three stages, running 50 times a second:

```text
motion_setpoint ──► trajectory generator ──► control law ──► thrust allocator ──► control/thrusters
```

### 1. Trajectory generator: make a smooth path

Rather than jumping straight to the target, as in the toy, it plans a smooth path there that respects limits on speed, acceleration and how fast the acceleration can change. The robot then follows a target that moves smoothly. That's why the real robot doesn't have the toy's overshoot.

### 2. Control law: work out the force

This is the PID, with a model of the robot added. Since we roughly know the robot's mass, drag and buoyancy, we can calculate most of the force it needs up front. This is called **feedforward**. PID then only has to correct what the model got wrong.

The **gains** are in `src/sub_bringup/config/control/gains_sim.yaml`, one `[kp, ki, kd]` for each axis:

```yaml
gains:
  x: [1.92, 0.512, 2.4]
  # ...
  z: [3.0, 1.0, 3.0]
  # ...
  yaw: [4.32, 1.728, 3.6]
```

The velocity term works directly from measured velocity, instead of working out how fast the error changes, and integrators are stopped from growing while the thrusters are at their limit. That is called **anti-windup**.

### 3. Thrust allocator: share it across the thrusters

The control law outputs a total force and turning force, called a **wrench**. The allocator works out what each of the eight thrusters must do to produce it, without exceeding its limit. If that is impossible, it gives up the less important motion first: it would rather keep the depth and the robot level than go fast. If a thruster has failed, it shares its work among the others.

## Experiment on the real controller

Start the simulator and open a `pixi shell`. Parameters can be changed while it runs, so let's see what bad gains do. See the current depth gains, then weaken them and remove the I term:

```bash
ros2 param get /marlin_v3/sub_control gains.z
ros2 param set /marlin_v3/sub_control gains.z "[0.5, 0.0, 0.3]"
```

Send it to 1.5 m:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 1, 0, 0, 0], position: [0.0, 0.0, -1.5, 0.0, 0.0, 0.0]}'
```

Wait 30 seconds, then ask where it got to:

```bash
ros2 topic echo --once --field pose.pose.position.z /marlin_v3/odometry/filtered
```

When we tried it, it stopped at about **−1.2**, some 30 cm short of its target. That's the same steady-state error you saw in the toy, on the real controller. Now put the gains back, and it finishes the job:

```bash
ros2 param set /marlin_v3/sub_control gains.z "[3.0, 1.0, 3.0]"
```

You can also break a thruster, by telling the simulator that thruster 3 produces no thrust. The robot keeps going, as the I term takes up the missing thruster's share:

```bash
ros2 param set /marlin_v3/sim_thrusters effectiveness "[1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0]"
```

To watch this properly, plot it. The `tuning_sim.json` layout in Foxglove graphs target, reference and measured values per axis, and has buttons for running step tests. [Tuning](/thalassic/control/#tuning) describes how we choose gains for the real robot.

## Other things in `sub_control`

Moving the robot isn't all it does. It also:

- **Arms:** it won't drive until the kill switch has been cycled and the sensors are working.
- **Watches its sensors:** if one goes quiet, it reacts. See [What happens when a sensor fails?](/concepts/sensors/#what-happens-when-a-sensor-fails)
- **Reports what it's doing:** `control/status` has nearly every internal value, and `control/error` says how far there is to go.

## Learn more

- [Understanding PID Control](https://www.mathworks.com/videos/series/understanding-pid-control.html) is a short, very clear video series.
- [Control System](/thalassic/control/) is the full reference for `sub_control`.
