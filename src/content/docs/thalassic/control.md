---
title: "Control system"
description: "Trajectory generator, model-based control law, thrust allocation and thruster failure, command interface, safety, tuning."
---

`sub_control` runs at 50 Hz and turns per-axis motion commands into eight thruster commands. Its structure is that of NUS Bumblebee's controller (RoboSub 2025 champion):

```
MotionSetpoint ──► trajectory generator ──► control law ──────────────────► thrust allocation ──► control/thrusters
(per-axis mode)    jerk-limited reference    feedforward from the model       box-constrained QP,
                   (position, velocity,      + full-state feedback            failure- and
                   acceleration)             (control law partitioning)       saturation-aware
                                                    ▲                               │
                                                    └──── achieved wrench ──────────┘ (anti-windup, observer)
```

Each cycle first runs arming and the watchdogs, which decide whether the thrusters may run and which axes have feedback ([Safety](#safety)). Then:

1. The [trajectory generator](#trajectory-generator) turns the command (go to a pose, move at a speed, stop) into a smooth, jerk-limited reference.
1. The [control law](#control-law) computes the wrench: feedforward from a vehicle model, plus feedback.
1. The [thrust allocator](#thrust-allocation) finds thruster forces within each thruster's limits, giving up the least important axes first, and reports what it achieved back to the control law.

[Configuration](#configuration) lists every parameter. [Control and PID](/concepts/control/) introduces the ideas.

[![Inside sub_control: the inputs, one timer running arming, the failsafe, the watchdogs, the trajectory generator, the controller and the allocator, and the outputs.](/diagrams/thalassic/sub-control-internals.svg)](/diagrams/thalassic/sub-control-internals.svg)

## Command interface

Commands arrive as `sub_control_interfaces/MotionSetpoint` on `motion_setpoint`, which sets a mode for each axis `[x, y, z, roll, pitch, yaw]`:

| Mode | Value | Meaning |
| --- | --- | --- |
| `KEEP` | 0 | Leave this axis as it is |
| `POSITION` | 1 | Move smoothly to `position[i]` and hold it |
| `VELOCITY` | 2 | Track `velocity[i]` |
| `HOLD` | 3 | Come to a smooth stop and hold wherever that is |
| `EFFORT` | 4 | Open loop: push with `effort[i]` along the body axis, no feedback (testing, identification) |

One message can say "surge at 0.3 m/s, hold 1 m depth and this heading", and a later one can change only the heading. x and y always share a mode. Their velocity is along the vehicle's heading (`velocity_frame: HEADING`, yaw only, so pitching does not turn "forward" into a dive) or along odom x/y (`WORLD`). `altitude: true` makes a z `POSITION` target an altitude above the bottom, from the DVL; the message is rejected if that target is negative or there is no DVL altitude.

### Frames

Positions are in `odom` (REP-103 ENU, z up): x, y and yaw are zeroed where the kill switch was last released (or where [`reset_pose`](#re-zeroing-the-pose) was last called), and z is depth from the pressure sensor, so 1 m deep is z = −1. Rotations are ZYX Euler angles of the body in odom, and rotational velocities are those angles' rates.

### Timeouts

`timeout` (seconds, counted from `header.stamp`, or from arrival if that is earlier or the message is unstamped) turns `VELOCITY` and `EFFORT` axes into a `HOLD` unless they are set again in time, so a stream that stops cannot drive the vehicle away. `timeout: 0` latches them until they are replaced, so whoever latches them must stop them. The mission sends a stop when its run ends, but if its process dies (a crash, `SIGKILL`) or hangs, a velocity it latched runs on until the kill switch. Tools and the command line should set a timeout.

### Acknowledgment

A command's `id` (any nonzero number; `sub_mission` gives each a fresh one) comes back as `command_id` in `control/error` and `control/status` once `sub_control` has taken the command up, with `command_rejected` set if it rejected it (it logs why). An error carrying an older id was computed before the command applied, so a sender waiting for a move to finish counts only errors that carry its command's id. Commands are rejected while killed or not armed; those that arrive between arming and the EKF's pose reset are applied, and acknowledged, once the reset completes.

### Bumpless switching

The reference never jumps: a new target or mode starts from its current position, velocity and acceleration. A `HOLD` decelerates first and latches the position it stops at (where a `POSITION` target would ask for the current velocity), so it neither brakes hard nor pulls back. Yaw targets go the short way round and the reference is never wrapped, so a turn through ±180° is continuous.

### Teleop

Teleop can also publish `cmd_vel` (`Twist`): all six axes `VELOCITY`, stopping if the stream pauses for `safety.cmd_vel_timeout`. Everything else, the mission included, uses `motion_setpoint` only, so commands are applied in the order they were sent.

### Examples

From a `pixi shell`, with the stack running:

```bash
# Go to 1 m forward of the arm point, 0.5 m deep (depth is absolute), level, heading 0
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint \
  '{mode: [1, 1, 1, 1, 1, 1], position: [1.0, 0.0, -0.5, 0.0, 0.0, 0.0]}'

# Turn to a yaw of 0.5 rad, leaving everything else as it is
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint \
  '{mode: [0, 0, 0, 0, 0, 1], position: [0.0, 0.0, 0.0, 0.0, 0.0, 0.5]}'

# Surge at 0.3 m/s while still holding depth and heading; stops 1 s after the stream does
ros2 topic pub -r 5 /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint \
  '{mode: [2, 2, 0, 0, 0, 0], velocity: [0.3, 0.0, 0.0, 0.0, 0.0, 0.0], timeout: 1.0}'

# Stop and hold wherever the vehicle comes to rest
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint \
  '{mode: [3, 3, 3, 3, 3, 3]}'
```

### Re-zeroing the pose

`reset_pose` makes the vehicle's current position and heading the new origin without killing it:

```bash
ros2 service call /marlin_v3/sub_control/reset_pose std_srvs/srv/Trigger
```

The EKF zeroes x, y and yaw (depth, roll and pitch come from the sensors and are kept). Until it confirms, usually within one EKF cycle, the thrusters keep their last command instead of chasing targets in the old frame. Then the controller holds where the vehicle is. Depth (or altitude), roll and pitch targets carry over, and the integrators are kept, with the world-frame ones turned into the new heading. Commands that arrive in between are applied after the reset, in the new frame.

## Outputs

- `control/thrusters` (`ThrusterCommand`), every cycle: the eight normalized commands, stamped.
- `control/status` (`ControllerStatus`), every cycle: each axis's mode, target and trajectory reference; the commanded and achieved wrench; integrators and disturbance estimate; each thruster's force, command, saturation and health; which axes are controllable; and the watchdog states.
- `control/error` (`Error`), every cycle: target minus measured, per axis, the way the mission reads it (see the message for frames), and the id of the last command taken up.
- `control/armed` (`Bool`, latched): whether the thrusters may run.
- `/diagnostics`, once a second: arming (and what blocks it), sensor ages, and thruster health and saturation, under `sub_control: arming`, `: sensors` and `: thrusters`, aggregated with every other node's on `/diagnostics_agg`.

`control/status` and `control/error` are not published while the controller waits for the EKF to confirm the pose reset after arming.

## Trajectory generator

`reference_generator.cpp` holds each axis's mode and target and shapes them into a reference position, velocity and acceleration, so the thrusters are never asked for a step and the control law gets the reference's velocity and acceleration to feed forward. Its limits are `trajectory.*`: `[max velocity, max acceleration, max jerk]` for x/y together (so diagonal moves are straight lines), z, roll, pitch and yaw.

The shaping is ArduPilot's (`AP_Math/control.cpp`, `trajectory.hpp`): a square-root position controller that brakes at half the acceleration limit, then a jerk-limited slew of the acceleration. It runs online, so targets can move every cycle (visual servoing), and it accepts a velocity target as well as a position. One change: near the target ArduPilot's gains give a damping ratio of 0.7, which overshoots a few percent; here the position gain is a quarter of the velocity gain, which is critically damped.

In `VELOCITY` mode the reference position keeps integrating the reference velocity, so position feedback acts as integral action on velocity error: a current that slows the vehicle is pushed through, not just tolerated.

The reference is kept on a **leash** (`trajectory.translation_leash`, `rotation_leash`): it never gets further than that from the vehicle, so a stalled vehicle (saturated thrusters, a wall) does not accumulate an error that would launch it once freed.

Keep the limits inside what the thrusters can do at `power_limit`; `control/status` shows `thruster_saturated` when they are not.

## Control law

With e the position error (world, rotated into the body) and the geodesic attitude error, ν the body velocity, and everything in body FLU:

```
a*  = a_ref + Kd (ν_ref − ν) + Kp e + I                   servo law, an acceleration
τ   = M a* + D(ν_ref) ν_ref + g_hold(q, q_ref) + ω × Jω − d̂   model
```

`M` is the vehicle's mass and inertia (including added mass), `D` its linear plus quadratic drag, `g_hold` what holds it against buoyancy (see [Vehicle model](#vehicle-model)), and `d̂` the [disturbance observer](#disturbance-observer)'s estimate. This is _control law partitioning_: the model part cancels the vehicle's dynamics, leaving the feedback the same unit-mass double integrator on every axis, so the gains `gains.<axis>: [kp, ki, kd]` are accelerations, independent of the model. A critically damped triple pole at −ω is

```
kp = 3ω²     ki = ω³     kd = 3ω
```

so one bandwidth per axis sets the response. ω is limited by sensing delay: loops closed on the DVL (x, y), with 0.1–0.2 s of latency, should stay around 1 rad/s or less; depth and attitude, on the pressure sensor and gyro, can go higher.

- **Attitude error** is the geodesic one: the body-frame rotation vector from the current attitude to the reference (`attitude_error()` in `utils.cpp`). It is in the frame of the rate feedback, has no gimbal singularity, and does not leak roll/pitch torque into a large yaw move.
- **Rate feedback** uses the IMU gyro (`imu/data`) directly, the freshest signal on the vehicle; the EKF's rates take over if the IMU goes quiet for `safety.imu_timeout`.
- **No derivative of a measurement.** The vehicle measures velocity (DVL through the EKF) and rates (gyro), so velocity error is the derivative term; nothing is differentiated.
- **Integrators** store accelerations (so retuning `ki` does not step the output) and are clamped at `gains.integral_limit`. The translational ones are kept, and clamped, in world axes, since buoyancy errors and currents are fixed in the world: after a yaw turn they still point the right way.
- **Saturation-aware anti-windup.** The allocator reports the wrench the thrusters actually produce. Each integrator bleeds off whatever part of its axis's command was not produced, at rate `gains.anti_windup`, so a saturated axis — or one starved by a failed thruster — never winds up.

The hardware gains are the old pool-tuned cascade (position P into velocity PI, attitude P into rate P) re-expressed in this form, so the feedback in newtons is unchanged until the model is identified and the vehicle retuned; `gains.yaml` shows the conversion.

## Vehicle model

`model.*`, in body axes, with moments about the centre of gravity:

| Parameter                       | Meaning                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `mass`, `inertia`               | Per axis, rigid body plus added mass [kg, kg m²]               |
| `net_buoyancy`                  | Buoyancy minus weight [N]; positive floats                     |
| `buoyancy`                      | Buoyancy alone [N], for its righting moment                    |
| `center_of_gravity`             | base_link [m]; also the point thruster moments are taken about |
| `center_of_buoyancy`            | base_link [m]; above the CG the hull rights itself             |
| `linear_drag`, `quadratic_drag` | Per axis `[x, y, z, roll, pitch, yaw]`                         |

The net buoyancy is held in the world frame, at the measured attitude. The righting moment is held at the _reference_ attitude: holding a pitched attitude (aiming a torpedo) gets the torque it needs, while the hull's own righting stiffness still pulls toward the reference instead of being cancelled. Drag is fed forward at the reference velocity, which keeps sensor noise out of it. `feedforward.acceleration`, `.drag` and `.restoring` scale each term from 0 to 1, so they can be brought in one at a time. Everything in the model is feedforward: whatever it gets wrong is a disturbance the feedback, integrators and observer take out, so a rough model is fine and a wrong one is not dangerous.

### Identifying the model

`identify_model` measures it. With the stack running and the vehicle unkilled in open water (2 m or more from walls and the bottom):

```bash
ros2 run sub_control identify_model --ros-args -r __ns:=/marlin_v3 -p buoyancy:=<weight in N>
```

It holds depth, then for each axis pushes open loop (`EFFORT`) at two efforts in both directions, recording the thrust produced and the motion, and fits mass, drag, net buoyancy and the righting moment by least squares. It logs each axis's fit and its quality (R², rms residual), then prints a `model:` block. Steps stop early if the vehicle gets shallow or tilts too far. Efforts, durations and depth are parameters (`ros2 param list` on the node); in a small pool, shorten `x.duration` and `y.duration`. Rerun it whenever the hull's mass, trim or shape changes.

### Disturbance observer

`observer.bandwidth` (rad/s per axis, 0 off) turns on a momentum-based disturbance observer: it compares the measured momentum `Mν` with what the model and the _achieved_ thrust predict, and `d̂` converges on the difference — currents, a buoyancy change after dropping a marker or picking something up, model error — through a first-order lag at that bandwidth, using no differentiated signal. It rejects such steps faster than the integrators, whose `ki` should then be cut to a small residual. Its estimate is in `control/status` (`disturbance`), a direct read of how far off the model is. Keep its bandwidth on x/y at or below the DVL-limited feedback bandwidth; it must stay below `control_rate_hz`. Retuning `observer.bandwidth`, `model.mass` or `model.inertia` live keeps the estimate.

## Thrust allocation

`allocator.cpp` maps the body wrench to eight thruster forces with the 6×8 matrix `B`, built from each thruster's position and direction relative to the centre of gravity. The layout comes from the `thrusters:` block of `src/sub_bringup/config/vehicles/<robot>.yaml`, the only copy of it: the launch file passes it to `sub_control` (`allocation.thruster_*`), the simulator is generated from it, and the TF tree is published from it. It solves, every cycle:

```
minimize   ||W (B f − wrench)||²  +  ε ||f||²
subject to h_i · lower_i ≤ f_i ≤ h_i · upper_i
```

exactly, with a primal active-set method (a handful of 8×8 solves). The weights `W` (`allocation.axis_weights`, default `[1, 1, 100, 100, 100, 10]`) differ by orders of magnitude so they act as priorities: when the request is out of reach, surge and sway give way first, then heading, and depth and attitude are kept. `h_i` is each thruster's health. Among force sets that achieve the wrench equally, the least `||f||²` (a stand-in for power) wins.

The bounds come from `power_limit` through the T200 curve. A thruster's force is along its mounted +X, the way a right-hand propeller pushes on a positive command; a left-hand propeller is its mirror image, so it pushes the other way and with the curve's weaker half (`thruster_command()` in `utils.hpp`). Commands are slew-limited (`allocation.max_command_rate`, normalized command per second) to avoid current spikes from instant reversals, and the force actually commanded, after the slew limit, is what is reported as achieved. A lowered `power_limit` applies at once, ahead of the slew limit.

### Thruster failure

Each thruster has a health in [0, 1], the fraction of its thrust it delivers; a failed one has 0, is commanded off, and the allocator spreads its share over the rest. Health is set by hand: `thruster_health` (parameter, 8 doubles) and `failed_thrusters` (parameter, indices, which count as 0):

```bash
ros2 param set /marlin_v3/sub_control failed_thrusters "[3]"
# All healthy again: an empty integer array (type 7), or [] in the Controller Gains panel.
# `ros2 param set ... "[]"` is rejected: ros2cli sends an empty list as a bool array.
ros2 service call /marlin_v3/sub_control/set_parameters rcl_interfaces/srv/SetParameters \
  "{parameters: [{name: failed_thrusters, value: {type: 7}}]}"
```

Nothing declares a failure automatically: that needs each thruster's actual thrust (per-thruster current sensing or ESC telemetry), and the Basic ESCs report nothing.

The vehicle has four vertical thrusters (heave, roll, pitch) and four horizontal ones (surge, sway, yaw):

| Failed                          | Result                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| Any one                         | All six axes; the affected three keep half their authority |
| One vertical and one horizontal | All six axes, with no redundancy left                      |
| Two in the same set             | One axis is lost                                           |

On every health change the supervisor checks which axes the working thrusters can still move independently, keeping them in the priority order depth, heading, pitch, surge, sway, roll (roll last: the hull rights itself). An axis that is lost gets no allocation weight, no feedback and a frozen integrator, and is flagged in `control/status` (`axis_controllable`). Losing both front verticals, for instance, keeps depth and gives up pitch to the hull's own stability.

Even an _undeclared_ failure is ridden through: the integrators take up the missing thruster's share (the unit tests check that a vertical thruster dying mid-hold costs a few centimetres of depth). Declaring it is still better: the allocator stops asking the dead thruster for force and the other thrusters have their full range.

## Safety

| Condition | Response |
| --- | --- |
| Killed | Thrusters off, disarmed |
| Released, not armed | Thrusters off until it arms: the kill switch must have been engaged since `sub_control` started (`safety.require_kill_cycle`), so a stack that starts or restarts with the switch released does not drive off; and the state estimate, the IMU and depth must be fresh. It logs what it is waiting for every 5 s and publishes `control/armed` once armed |
| Armed | The EKF pose is reset (x, y and yaw to zero; depth, roll and pitch kept, since the sensors would only pull them back); the thrusters stay off until the EKF confirms (or 1 s passes), then the controller starts holding where the vehicle is, level |
| No odometry for `safety.state_timeout`, or no IMU for `safety.attitude_timeout` | Thrusters off (`failsafe`): the positively buoyant hull floats up. Without the IMU the EKF's attitude is only a drifting prediction, which the controller would fight. Resumes when both return |
| No DVL for `safety.dvl_timeout` | x/y feedback off (the EKF only predicts them): the reference follows the estimate; targets are kept and resumed when the DVL returns |
| No depth for `safety.depth_timeout` | z feedback and the buoyancy hold off: the vehicle floats up. An `EFFORT` axis still gets exactly its effort |
| No DVL altitude for `safety.altitude_timeout` while holding altitude | Holds depth instead |
| `cmd_vel` stream stops for `safety.cmd_vel_timeout` | Those axes stop and hold |
| `sub_control` stops publishing, or `sub_low` or the USB link dies | The board's own watchdog stops every thruster after 0.5 s without a command (in the simulator `sim_thrusters` does, after its `command_timeout`); `sub_low` reopens the port when it can, stopping the thrusters first |
| `sub_control`'s commands arrive late | `sub_low` (in the simulator `sim_thrusters`) ignores a command older than its `command_timeout` (0.5 s), so the board's watchdog stops the thrusters if no fresh one follows |
| The board's main loop stalls | Its hardware watchdog resets it after 1 s, which stops the thruster PWM. After any board reset it stays killed until the kill switch is cycled |
| Thruster fails | See [Thruster failure](#thruster-failure) |

Every age above is by the message's own stamp, not its arrival, so a stream that still arrives but late (a lagging EKF, a backed-up DDS queue) counts as stale, and so does a DVL whose clock chrony is not syncing: a stamp more than 0.25 s ahead of the clock is not believed. The board side is in [maritime's README](https://github.com/avbotz/maritime#commands).

## Configuration

The `gains` launch argument picks one of two profiles at startup:

- `src/sub_bringup/config/control/gains.yaml`: hardware
- `src/sub_bringup/config/control/gains_sim.yaml`: simulation, with the Stonefish model's identified parameters

| Parameter | Meaning |
| --- | --- |
| `control_rate_hz` | Control loop rate (50) |
| `power_limit` | Normalized thrust cap in [0, 0.6] (`MAX_POWER_LIMIT`, 1260-1740 µs to the ESCs; `sub_low` and the firmware enforce it too) |
| `model.*` | [Vehicle model](#vehicle-model) |
| `feedforward.{acceleration,drag,restoring}` | Scale of each feedforward term, 0 to 1 |
| `trajectory.{horizontal,vertical,roll,pitch,yaw}` | `[max velocity, max acceleration, max jerk]` |
| `trajectory.{translation,rotation}_leash` | How far the reference may get ahead of the vehicle [m, rad] |
| `gains.{x,y,z,roll,pitch,yaw}` | `[kp, ki, kd]` in accelerations |
| `gains.integral_limit` | Integrator clamp \[m/s², rad/s²\]: x/y/z on the odom-axis integrators, roll/pitch/yaw on the body-axis ones |
| `gains.anti_windup` | Rate integrators shed unproduced command [1/s] |
| `observer.bandwidth` | Disturbance observer per axis [rad/s], below `control_rate_hz`; 0 off |
| `allocation.axis_weights` | Priorities when the wrench is out of reach |
| `allocation.max_command_rate` | Slew limit on each normalized command [1/s] |
| `allocation.thruster_{positions,directions,reversed}` | Thruster layout, from the vehicle description (read-only) |
| `thruster_health`, `failed_thrusters` | [Thruster failure](#thruster-failure) |
| `safety.require_kill_cycle` | Arm only after the kill switch has been engaged since startup (true) |
| `safety.{state,imu,attitude,dvl,depth,altitude,cmd_vel}_timeout` | Watchdog timeouts [s], see [Safety](#safety); `imu_timeout` is when rate feedback falls back to the EKF's, `attitude_timeout` when the IMU counts as lost |
| `robot_name` | Namespace prefix for frame ids |

Everything except the rate, the layout and `robot_name` can be changed at runtime with `ros2 param set`; changing gains or the model keeps the integrators and the disturbance estimate. Edit the YAML to make a change stick.

Each parameter's type, default, description and limits are defined once, in `src/sub_control/sub_control/src/sub_control_parameters.yaml`, from which [generate_parameter_library](https://github.com/PickNikRobotics/generate_parameter_library) generates the code that declares them and validates every change (`ros2 param describe` shows the description and range). A change with a wrong length, a NaN or inf, or a value out of range is rejected with the reason, and so is an `observer.bandwidth` at or above `control_rate_hz`; a batch set atomically is rejected whole if any of it is. An invalid profile stops `sub_control` at startup, saying which parameter is wrong.

## Tuning

1. Check the thrust direction of every thruster (`EFFORT` on each axis should move the vehicle that way).
1. Identify the model (`identify_model`) and paste it in.
1. Pick a bandwidth per axis and set `kp, ki, kd = 3ω², ω³, 3ω`. Start low (x/y 0.6, z 1.0, attitude 1.5 rad/s) and raise each until the response rings, then back off by a third. Step the axis alone with `MotionSetpoint` and watch `control/status`.
1. Raise the trajectory limits until `thruster_saturated` starts to appear on long moves.

Gains tuned in simulation do not carry over to the vehicle; the procedure does.

The AVBotz Tuning extension for Foxglove ([avbotz/foxglove-extensions](https://github.com/avbotz/foxglove-extensions), `tuning/`) runs these steps over the bridge: its Controller Gains panel edits the parameters live and exports what changed in the layout of the gains file, Controller Signals graphs target, reference and measurement per axis, and Tuning Routines runs bounded step, cruise, hold and square routines. Its README walks through the procedure. The `tuning` layouts in `src/sub_bringup/foxglove/` ([Foxglove](/thalassic/foxglove/)) open these panels with a tab of graphs per axis.

## Tests

`colcon test --packages-select sub_control` runs unit tests of the allocator (including every single and double thruster failure), the thrust curve and attitude maths, the trajectory shaping, the trajectory generator's modes (latched streams included), the arming checks and stamp ages, and the closed loop against a simulated vehicle whose mass, drag, buoyancy and trim all differ from the controller's model: holding, a depth step, a long transit, a half turn, surging while holding depth, declared and undeclared thruster failures, losing both front verticals, saturation, a buoyancy step, retuning the observer and the mass live, and a pose reset against a current.

### Measured in simulation

In Stonefish, with the identified `gains_sim.yaml`, sensor noise and a 3.6 cm/s current, the controller held position to 0.4 cm RMS and heading to 0.13°. A 0.6 m depth step overshot 0.6 cm and settled within 5 cm in 4.3 s; a 3 m surge step overshot 0.7 cm and settled in 12 s, 0.5 cm off the line, with depth within 0.9 cm. Turns through ±180° settled within 2° in 6.5 s with under 0.5° of roll or pitch. Commanded to surge at 0.25 m/s, it held 0.251 m/s with depth within 0.5 cm and heading within 0.4°. Killing a vertical thruster mid-hold cost 2.3 cm of depth before it was declared failed (a 2 m move and 1 rad turn afterwards ended within 0.6 cm and 0.2°); losing both front verticals gave up pitch to the hull (5° nose down) and held depth within 5 cm.
