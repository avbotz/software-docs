---
title: Sensors and state estimation
description: How an underwater robot with no GPS works out where it is, using an IMU, a DVL, a pressure sensor and an EKF.
---

Your phone knows where it is from GPS. Underwater there's no GPS, because radio signals barely get through water. So how does the robot know where it is?

It has to work it out from sensors that each tell it a small piece of the answer. Combining those pieces is called **state estimation**. The robot's **state** is simply its position, rotation and speed.

## The sensors

Run the simulator to try these commands. The simulated sensors publish the same topics as the real ones.

### Pressure sensor: how deep am I?

Water pressure rises steadily as you go down, by about 1% of an atmosphere for every 10 cm. So measuring pressure gives you depth directly. It's simple, accurate to millimeters, and never drifts.

```bash
ros2 topic echo --once --field pose.pose.position.z /marlin_v3/odometry/depth
```

**Good at:** depth. **Can't tell you:** anything else.

### IMU: how am I rotated?

An **IMU** (Inertial Measurement Unit) is a small chip that contains a **gyroscope**, which measures how fast it is rotating, and an **accelerometer**, which measures acceleration, including gravity. Your phone has one, which is how it knows when to rotate the screen.

```bash
ros2 topic echo --once --field angular_velocity /marlin_v3/imu/data
```

```text
x: 0.007848796003220932
y: -0.002111621477207822
z: -0.004037236483260004
```

Those are in radians per second. They are tiny, and nonzero even when holding still, which is sensor noise.

Gravity always points down, so the accelerometer can always tell which way is down. That makes roll and pitch reliable. **Yaw is different.** Gravity tells you nothing about which way you are facing, so yaw comes from adding up the gyroscope's rate over time. Any small error adds up, so the yaw slowly **drifts**, by around 10° an hour. Ours has no magnetic compass to correct it.

**Good at:** rotation, quickly. **Weak at:** yaw over a long time.

### DVL: how fast am I moving?

A **DVL** (Doppler Velocity Log) sends four beams of sound down at the pool floor and listens to the echoes. If the robot is moving, the echoes come back at a slightly different pitch, the same effect that makes a passing siren change note. That gives the robot's velocity over the floor. It also measures how far the floor is below it, which we call **altitude**.

```bash
ros2 topic echo --once --field twist.twist.linear /marlin_v3/dvl/velocity
ros2 topic echo --once --field range /marlin_v3/altitude
```

When it can hear the floor, we say that it has **bottom lock**. It's very accurate, but it can lose lock near walls, and its readings arrive about 0.15 seconds late.

**Good at:** speed. **Can't tell you:** position directly, only how fast it is changing.

### Cameras: what is around me?

Cameras don't feed into the position estimate. They are how the robot finds the props, as [Computer vision](/concepts/vision/) explains.

## Dead reckoning, and why it drifts

There is no sensor that measures x and y position. All we have is speed from the DVL, and heading from the IMU. To work out position, we add up speed × time, over and over:

```text
position = position + velocity × time step
```

This is called **dead reckoning**, and sailors have done it for centuries. Imagine walking through a dark room counting your steps. It works, but small errors add up and never go away, so the longer you go, the further off you are.

This matters for how missions are written. A hard-coded "swim 10 m forward" is only roughly 10 m, and it ends up further off the longer the run goes. That's why missions look for the props with the cameras, rather than relying on position alone.

## Combining them: the EKF

Each sensor is good at something and weak at something else, and they all have noise. The **EKF** (Extended Kalman Filter) combines them into one best guess, updating it every time new data arrives.

The idea behind it is simple. It works in two steps, over and over:

1. **Predict:** "I was here, moving at this speed, so now I should be about _there_." The guess gets a little less certain.
1. **Update:** a sensor reading arrives. Compare it to the prediction, and move the guess part of the way towards the reading. How far depends on how much you trust the sensor compared to your prediction. The guess gets more certain.

We don't write this ourselves. The EKF is the `ekf_filter_node` from a standard package, `robot_localization`, and `src/sub_bringup/config/ekf.yaml` tells it what to use from each sensor. It takes:

| From            | It uses                                          | On topic         |
| --------------- | ------------------------------------------------ | ---------------- |
| IMU             | Yaw and yaw rate, roll and pitch and their rates | `imu/data`       |
| DVL             | Velocity in x, y and z                           | `dvl/velocity`   |
| Pressure sensor | Depth                                            | `odometry/depth` |

And it publishes the answer on `odometry/filtered`, which is the topic nearly everything else reads:

```bash
ros2 topic echo --once --field pose.pose.position /marlin_v3/odometry/filtered
```

```text
x: 0.0008025494261619621
y: -0.001417184359673121
z: -0.13056966190063396
```

## How much do we trust it?

In the simulator, we can check the estimate against the truth, since the simulator knows exactly where the robot is:

```bash
ros2 topic echo --once --field pose.pose.position /marlin_v3/sim/odometry
```

```text
x: 17.177234458592146
y: -10.24440400644934
z: 0.32491813483549115
```

Very different numbers, for the same robot at the same moment! This isn't an error. It's a good example of [frames](/concepts/coordinates/#frames-relative-to-what): `sim/odometry` is measured from the corner of the simulated pool, in Stonefish's own z-down convention, and `odometry/filtered` is measured from where the robot armed. It's only for testing: `sim/` topics don't exist on the real robot.

## What happens when a sensor fails?

`sub_control` watches the age of every sensor's messages. If the DVL goes quiet, it stops trusting x and y and just holds what it can. If the IMU or the position estimate goes quiet, it cuts the thrusters and lets the robot float up. The [Safety](/thalassic/control/#safety) table has the whole list.

You can try this in the simulator, by removing the program that publishes `imu/data`. First send the robot down, so you can see what happens:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 1, 0, 0, 0], position: [0.0, 0.0, -1.0, 0.0, 0.0, 0.0]}'
```

The sensor bridges all run inside one program, so list them to find the IMU's number:

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

After about 15 seconds, once the robot has reached its depth, remove it, using that number:

```bash
ros2 component unload /marlin_v3/sim_sensors_container 2
```

One second later, `sub_control` prints this in the simulator's terminal, and every thruster command goes to zero:

```text
[sub_control-3] [ERROR] [marlin_v3.sub_control]: no IMU for 1.00 s: thrusters off
```

The robot floats back up to about −0.12 m. It's safe, if not much use. Restart the simulator to get the IMU back.

## Learn more

- [Kalman Filter from the Ground Up](https://www.kalmanfilter.net/) is a clear explanation with worked examples.
- [Architecture: `ekf_filter_node`](/thalassic/architecture/) has the details of our setup.
