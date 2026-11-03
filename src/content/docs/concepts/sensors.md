---
title: Sensors and state estimation
description: How an underwater robot with no GPS works out where it is, using an IMU, a DVL, a pressure sensor and an EKF.
---

GPS does not work underwater, so the robot works out its **state** (position, rotation and speed) from sensors that each give part of the answer. Combining them is **state estimation**.

## The sensors

The commands below need the simulator, whose sensors publish the same topics as the real ones.

### Pressure sensor: how deep am I?

Water pressure rises by about 1% of an atmosphere for every 10 cm of depth, so pressure gives depth directly. It is accurate to millimeters and never drifts.

```bash
ros2 topic echo --once --field pose.pose.position.z /marlin_v3/odometry/depth
```

**Good at:** depth. **Can't tell you:** anything else.

### IMU: how am I rotated?

An **IMU** (Inertial Measurement Unit) is a small chip with a **gyroscope**, which measures how fast it is rotating, and an **accelerometer**, which measures acceleration, including gravity.

```bash
ros2 topic echo --once --field angular_velocity /marlin_v3/imu/data
```

```text
x: 0.007848796003220932
y: -0.002111621477207822
z: -0.004037236483260004
```

These are radians per second, nonzero even at rest: that is sensor noise.

The accelerometer senses which way gravity points, so roll and pitch are reliable. Gravity says nothing about which way the robot faces, so yaw comes from adding up the gyroscope's rate over time, and small errors make it **drift**, by about 10° an hour. Ours has no magnetic compass to correct it.

**Good at:** rotation, quickly. **Weak at:** yaw over a long time.

### DVL: how fast am I moving?

A **DVL** (Doppler Velocity Log) sends four beams of sound down at the pool floor and listens to the echoes. When the robot moves, the echoes' pitch shifts (the Doppler effect, which makes a passing siren change note), and the shift gives its velocity over the floor. It also measures the distance to the floor, its **altitude**.

```bash
ros2 topic echo --once --field twist.twist.linear /marlin_v3/dvl/velocity
ros2 topic echo --once --field range /marlin_v3/altitude
```

When it can hear the floor it has **bottom lock**. It is accurate, but loses lock near walls, and its readings arrive about 0.15 s late.

**Good at:** speed. **Can't tell you:** position directly, only how fast it is changing.

### Cameras: what is around me?

Cameras don't feed into the position estimate. They are how the robot finds the props: see [Computer vision](/concepts/vision/).

## Dead reckoning, and why it drifts

No sensor measures x and y. Position comes from the DVL's speed and the IMU's heading, added up every time step:

```text
position = position + velocity × time step
```

This is **dead reckoning**. Its errors add up and never go away, so the longer the run, the further off the estimate. A hard-coded "swim 10 m forward" is only roughly 10 m, which is why missions find the props with the cameras.

## Combining them: the EKF

The **EKF** (Extended Kalman Filter) combines the sensors into one best guess, updated whenever new data arrives, by repeating two steps:

1. **Predict:** "I was here, moving at this speed, so now I should be about _there_." The guess gets a little less certain.
1. **Update:** when a reading arrives, move the guess part of the way towards it: further the more the sensor is trusted relative to the prediction. The guess gets more certain.

The EKF is `ekf_filter_node` from the standard `robot_localization` package, and `src/sub_bringup/config/ekf.yaml` sets what it uses from each sensor:

| From            | It uses                                          | On topic         |
| --------------- | ------------------------------------------------ | ---------------- |
| IMU             | Yaw and yaw rate, roll and pitch and their rates | `imu/data`       |
| DVL             | Velocity in x, y and z                           | `dvl/velocity`   |
| Pressure sensor | Depth                                            | `odometry/depth` |

It publishes the result on `odometry/filtered`, which nearly everything else reads:

```bash
ros2 topic echo --once --field pose.pose.position /marlin_v3/odometry/filtered
```

```text
x: 0.0008025494261619621
y: -0.001417184359673121
z: -0.13056966190063396
```

## The simulator's ground truth

The simulator knows exactly where the robot is, and publishes it on `sim/odometry`:

```bash
ros2 topic echo --once --field pose.pose.position /marlin_v3/sim/odometry
```

```text
x: 17.177234458592146
y: -10.24440400644934
z: 0.32491813483549115
```

These differ from `odometry/filtered` at the same moment because they are in a different [frame](/concepts/coordinates/#frames-relative-to-what): `sim/odometry` is measured from the corner of the simulated pool, in Stonefish's z-down convention, and `odometry/filtered` from where the robot armed. `sim/` topics exist only in the simulator.

## What happens when a sensor fails?

`sub_control` watches the age of every sensor's messages. If the DVL goes quiet, it stops trusting x and y and holds what it can. If the IMU or the position estimate goes quiet, it cuts the thrusters and lets the robot float up. The [Safety](/thalassic/control/#safety) table has the whole list.

To try it in the simulator, remove the program that publishes `imu/data`. First send the robot down:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 1, 0, 0, 0], position: [0.0, 0.0, -1.0, 0.0, 0.0, 0.0]}'
```

The sensor bridges all run inside one program. List them to find the IMU's number:

```bash
ros2 component list
```

```text
/marlin_v3/sim_sensors_container
  1  /marlin_v3/sim_dvl_remapper
  2  /marlin_v3/sim_imu_remapper
  3  /marlin_v3/sim_pressure_to_depth
  ...
```

Once the robot has reached its depth, after about 15 seconds, unload it by that number:

```bash
ros2 component unload /marlin_v3/sim_sensors_container 2
```

One second later, `sub_control` prints this in the simulator's terminal, and every thruster command goes to zero:

```text
[sub_control-3] [ERROR] [marlin_v3.sub_control]: no IMU for 1.00 s: thrusters off
```

The robot floats back up to about −0.12 m. Restart the simulator to get the IMU back.

## Learn more

- [Kalman Filter from the Ground Up](https://www.kalmanfilter.net/) explains it with worked examples.
- [Architecture: `ekf_filter_node`](/thalassic/architecture/) has the details of our setup.
