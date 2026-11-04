---
title: "Architecture"
description: "Packages, nodes, topics, the TF tree and the data flow."
---

Nodes run in the vehicle's namespace, `/marlin_v3` (the `robot_name` launch argument), and the topic and service names below are relative to it; names with a leading slash are global. [The big picture](/start-here/big-picture/) is the introduction.

[![The Marlin V3 ROS graph: the drivers feed the EKF, sub_vision and sub_control; sub_mission commands sub_control, which drives the thrusters.](/diagrams/thalassic/vehicle-ros-graph.svg)](/diagrams/thalassic/vehicle-ros-graph.svg)

## Packages

```
src/
├── sub_bringup/                 # Launch files and config
├── sub_control/
│   ├── sub_control/             # Control algorithm, arming and watchdogs
│   └── sub_control_interfaces/  # ROS2 messages for control
├── sub_mission/                 # BehaviorTree.CPP mission execution
├── sub_drivers/
│   ├── flir_camera_driver/      # FLIR / Spinnaker camera driver (submodule)
│   ├── sub_driver_interfaces/   # Dropper, torpedo and (sim only) grabber service definitions
│   ├── sub_serial_drivers/      # Serial-device nodes (maritime low-level, IMU)
│   └── waterlinked_dvl/         # WaterLinked DVL driver (submodule)
├── sub_sim/
│   ├── sub_sim/                 # Scenario generation, robot description
│   ├── sub_sim_sensors/         # Sim sensor bridges (DVL, IMU, depth, thrusters, actuators)
│   ├── stonefish_vendor/        # Builds the Stonefish library from its submodule
│   └── stonefish_ros2/          # Stonefish simulator ROS2 bridge (submodule)
└── sub_vision/
    ├── sub_vision/              # Detection node and post-processors
    └── sub_vision_interfaces/   # Detection messages, load_model service
```

## Data flow

In simulation:

```
Stonefish
  ├─ sim/dvl ──────► sim_dvl_remapper ──────► dvl/velocity ──────────────────────► EKF
  ├─ sim/imu ──────► sim_imu_remapper ──────► imu/data ──────────────────────────► EKF
  ├─ sim/pressure ─► sim_pressure_to_depth ─► odometry/depth ────────────────────► EKF
  └─ sim/thruster_setpoints ◄── sim_thrusters ◄── control/thrusters ◄────────────── sub_control
                                                      odometry/filtered (EKF) ────────┤
                                                      motion_setpoint (sub_mission) ──┘
Operator (ros2 topic pub, Foxglove)
  └─ sim/kill_switch ─► sim_kill_switch ────► kill_switch ───────────────────────► sub_control
```

On hardware the graph is the same, except that `waterlinked_dvl_driver` publishes `dvl/velocity` and `altitude`, `naviguider_imu_driver` publishes `imu/data`, and `sub_low` publishes `odometry/depth` and `kill_switch` and drives the thrusters. There is no `robot_state_publisher` (the simulator's URDF is its only user).

## Nodes

### `sub_control` (`sub_control/sub_control`)

The 50 Hz control node: a jerk-limited trajectory generator, a model-based control law (feedforward from the vehicle model plus full-state feedback) and a box-constrained QP thrust allocator that works around failed thrusters and saturation. It also owns arming and the watchdogs that decide which axes have feedback and whether the thrusters may run. See [Control system](/thalassic/control/).

|         | Topic               | Type                                                                                      |
| ------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Sub     | `motion_setpoint`   | `sub_control_interfaces/MotionSetpoint` (mode per axis, with an `id` it acknowledges)     |
| Sub     | `cmd_vel`           | `geometry_msgs/Twist` (stops if the stream does)                                          |
| Sub     | `odometry/filtered` | `nav_msgs/Odometry`                                                                       |
| Sub     | `imu/data`          | `sensor_msgs/Imu` (rate feedback)                                                         |
| Sub     | `dvl/velocity`      | `geometry_msgs/TwistWithCovarianceStamped` (watchdog only)                                |
| Sub     | `odometry/depth`    | `nav_msgs/Odometry` (watchdog only)                                                       |
| Sub     | `altitude`          | `sensor_msgs/Range` (DVL altitude)                                                        |
| Sub     | `kill_switch`       | `std_msgs/Bool`                                                                           |
| Sub     | `/tf`, `/tf_static` | `tf2_msgs/TFMessage` (the IMU's mounting)                                                 |
| Pub     | `control/thrusters` | `sub_control_interfaces/ThrusterCommand` (all eight, stamped, normalized, capped at ±0.6) |
| Pub     | `control/error`     | `sub_control_interfaces/Error` (with the id of the last command taken up)                 |
| Pub     | `control/status`    | `sub_control_interfaces/ControllerStatus`                                                 |
| Pub     | `control/armed`     | `std_msgs/Bool`, latched                                                                  |
| Pub     | `/diagnostics`      | `diagnostic_msgs/DiagnosticArray` (arming, sensors, thrusters)                            |
| Client  | `set_pose`          | `robot_localization/SetPose`                                                              |
| Service | `~/reset_pose`      | `std_srvs/Trigger` ([re-zeroes the pose](/thalassic/control/#re-zeroing-the-pose))        |

The thruster commands go out every cycle, `control/error` and `control/status` every cycle except while the node waits for the EKF to confirm the pose reset after a kill-switch release. Gains, the vehicle model and trajectory limits come from the hardware or simulation control profile; the thruster layout from the vehicle description. Parameters are in [Control system](/thalassic/control/#configuration).

### `sub_mission` (`sub_mission/mission`)

Runs the selected mission as BehaviorTree.CPP XML ([Mission system](/thalassic/mission/)). On the vehicle it runs under `sub_mission/restart`, which stops it when the kill switch is pulled and starts it again on release (`restart` launch argument).

|        | Topic                                                 | Type                                                                   |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Sub    | `kill_switch`                                         | `std_msgs/Bool`                                                        |
| Sub    | `control/armed`                                       | `std_msgs/Bool` (the run starts only once sub_control is armed)        |
| Sub    | `control/error`                                       | `sub_control_interfaces/Error`                                         |
| Sub    | `odometry/filtered`                                   | `nav_msgs/Odometry`                                                    |
| Sub    | `vision/detections`, `vision/detections_down`         | `sub_vision_interfaces/DetectionArray`                                 |
| Sub    | `/tf_static`                                          | `tf2_msgs/TFMessage` (the vehicle's mounts, for `NavigateToTransform`) |
| Pub    | `motion_setpoint`                                     | `sub_control_interfaces/MotionSetpoint`                                |
| Client | `sub_vision/load_model`, `sub_vision_down/load_model` | `sub_vision_interfaces/LoadModel`                                      |
| Client | `set_dropper`                                         | `sub_driver_interfaces/SetDropper`                                     |
| Client | `launch_torpedo`                                      | `sub_driver_interfaces/LaunchTorpedo`                                  |

### `sub_vision` / `sub_vision_down` (`sub_vision`)

One node per camera finds objects in its images: `sub_vision` reads `front_camera/image_raw` and publishes `vision/detections`, and `sub_vision_down` reads `down_camera/image_raw` and publishes `vision/detections_down` (`sub_vision_interfaces/DetectionArray`). `sub_mission` picks each one's model through its `load_model` service. See [Vision system](/thalassic/vision/).

### `ekf_filter_node` (`robot_localization`)

Fuses the IMU, the DVL and the pressure sensor into a filtered odometry estimate, with one configuration (`config/ekf.yaml`) for the vehicle and the simulator.

- `imu0`: `imu/data` — yaw, relative to where it started, and yaw rate
- `imu1`: `imu/data` — roll and pitch, absolute, and their rates
- `twist0`: `dvl/velocity` — linear velocity, gated at 5 standard deviations
- `odom0`: `odometry/depth` — z, from the pressure sensor, gated at 5 standard deviations
- Output: `odometry/filtered` (and the `odom` → `base_link` transform), and `/diagnostics`

`smooth_lagged_data` with a 1 s history fuses the DVL's late velocities at their stamps instead of as if they were current. The IMU is not gated: it is the only attitude source, and a filter that rejected it could not recover.

### `diagnostic_aggregator` (`diagnostic_aggregator`)

Groups every node's `/diagnostics` into `/diagnostics_agg` (Control, Estimation, Drivers, Vision; `config/diagnostics.yaml`), and marks an item that stops reporting as stale, so a dead driver shows up even though it can no longer say so. Foxglove's diagnostics panel and `ros2 run sub_bringup preflight` read it.

### `foxglove_bridge` (`foxglove_bridge`)

Serves the graph to Foxglove over a websocket on `foxglove_port` (8765), outside the vehicle's namespace. The panels in [avbotz/foxglove-extensions](https://github.com/avbotz/foxglove-extensions) drive, tune and watch the vehicle through it: teleop (6-DOF Teleop, Motion Setpoint), tuning (Controller Gains, Tuning Routines, Controller Signals) and vision (Detections, drawn on the frames they were computed from). The layouts in `src/sub_bringup/foxglove/` put them together ([Foxglove](/thalassic/foxglove/)).

### `waterlinked_dvl_driver` (`waterlinked_dvl`) — hardware only

Driver for the WaterLinked A50 DVL (the team's fork, at commit `7df97ed` or later; older ones publish `~/odom` instead). Its `~/velocity` output (`geometry_msgs/TwistWithCovarianceStamped` in `dvl_link`, with the report's velocity covariance) is remapped to `dvl/velocity` for the EKF: one message per valid velocity report, water-track (`velocity_water`) ones included, stamped with the report's `time_of_validity` (the DVL's clock, synced to the Jetson's by chrony). Its `~/altitude` (`sensor_msgs/Range`, bottom-track reports only) is remapped to `altitude` for altitude hold.

### `sub_low` / `naviguider_imu_driver` (`sub_serial_drivers`) — hardware only

Both are C++ nodes on one base, `SerialNode`, which keeps the link up: whenever the device goes away (unplugged, reset), stops taking writes for 50 ms, or sends nothing useful for `data_timeout` (1 s), it closes the port, tries it again every `reconnect_period` (1 s), and tells the device what it needs to know once it is back. For the first 100 ms after the port opens it drops everything it receives: a USB device keeps what it sent while the port was closed (the maritime board about 7 s of lines) and delivers it at once, and it would look current. All of it runs on the executor's thread with non-blocking I/O, so a hung device cannot hang the node, and the launch file respawns either one a second after a crash.

`sub_low` talks to the [maritime](https://github.com/avbotz/maritime) firmware over `/dev/maritime`: `control/thrusters` out, as one `m` line per cycle (protocol 2); `kill_switch` and `odometry/depth` in; and the `launch_torpedo` and `set_dropper` services, which each pick one of two (`torpedo_id`, `dropper_id`: 0 or 1). It stops every thruster whenever the port opens and when it exits, and ignores a thruster command older than `command_timeout` (0.5 s). When the commands stop, whether `sub_control`, `sub_low` or the USB link died, the board's own 0.5 s command watchdog stops the thrusters, and its hardware watchdog covers the board itself ([Control system](/thalassic/control/#safety)).

`naviguider_imu_driver` reads the NaviGuider IMU over `/dev/naviguider_imu` and publishes ENU `imu/data` with `frame_id` `marlin_v3/imu_link`: one message per gyro sample, but only while the orientation and acceleration are fresh too, so a sensor that stops makes `imu/data` stop instead of repeating (and, after `data_timeout`, restarts the module). The module's link is fixed at 115200 baud of text, so the rates share it: by default the gyro runs at 100 Hz (so `imu/data` does too), the orientation at 50 Hz, and the accelerometer, which nothing reads, is off (`gyro_rate`, `orientation_rate`, `accel_rate`). An orientation or acceleration that has not changed since the previous message is marked not provided (covariance -1), so the EKF fuses each sample once. The gyro's accuracy field is its calibration status (0–3): below 2 the rate covariance includes a typical uncalibrated bias and its diagnostics warn.

Both publish `/diagnostics`, including a `diagnostic_updater` rate check for each stream: `imu/data` at the gyro rate, `kill_switch` and `odometry/depth` at the board's 5 Hz, and `control/thrusters` at 2 Hz or more with stamps no older than `command_timeout`. `sub_low: board` is an error when the board's heartbeat stops or it speaks a protocol other than 2. Their parameters are read-only and validated (`generate_parameter_library`, `src/*_parameters.yaml`).

### `sim_dvl_remapper` (`sub_sim_sensors`) — sim only

Converts Stonefish's DVL message into the hardware driver's topics. Like the driver, it drops readings without bottom lock.

|     | Topic          | Type                                       |
| --- | -------------- | ------------------------------------------ |
| Sub | `sim/dvl`      | `stonefish_ros2/DVL`                       |
| Pub | `dvl/velocity` | `geometry_msgs/TwistWithCovarianceStamped` |
| Pub | `altitude`     | `sensor_msgs/Range`                        |

### `sim_thrusters` (`sub_sim_sensors`) — sim only

Stands in for `sub_low`, the firmware and the ESCs: passes `control/thrusters` to Stonefish (`sim/thruster_setpoints`, where each thruster's rotor dynamics model the ESC's response lag), stops every thruster when the commands stop or go stale for `command_timeout` (0.5 s), and injects faults (`effectiveness`). See [Simulation](/thalassic/simulation/#thrusters).

### `sim_imu_remapper` (`sub_sim_sensors`) — sim only

Re-expresses Stonefish's NED IMU stream as ENU and stamps it with `imu_link`.

|     | Topic      | Type                    |
| --- | ---------- | ----------------------- |
| Sub | `sim/imu`  | `sensor_msgs/Imu` (NED) |
| Pub | `imu/data` | `sensor_msgs/Imu` (ENU) |

### `sim_pressure_to_depth` (`sub_sim_sensors`) — sim only

Converts Stonefish's gauge pressure into depth as `sub_low` reports it on the vehicle: ENU z in `odom` (negative underwater), child frame `pressure_link`.

|     | Topic            | Type                         |
| --- | ---------------- | ---------------------------- |
| Sub | `sim/pressure`   | `sensor_msgs/FluidPressure`  |
| Pub | `odometry/depth` | `nav_msgs/Odometry` (z only) |

### `sim_kill_switch` (`sub_sim_sensors`) — sim only

Starts killed, releases the kill switch after a startup delay (`off_delay`, 6 s in `sim_launch.py`), then passes `sim/kill_switch` through to `kill_switch`, delaying releases by the ESCs' start-up time (`esc_startup`, 3 s).

### `sim_torpedo_launcher` / `sim_dropper` / `sim_grabber` (`sub_sim_sensors`) — sim only

The actuators in simulation: `launch_torpedo` and `set_dropper`, as `sub_low` serves them on the vehicle, and `set_grabber` (`sub_driver_interfaces/SetGrabber`), which closes the grabber's jaws, holding whatever is between them, or opens them to let go. The vehicle has no grabber service yet.

## TF tree

```
map
└── marlin_v3/odom          (static, identity)
    └── marlin_v3/base_link  (published by EKF; ENU/FLU control frame)
        ├── marlin_v3/imu_link            (relative to base_link)
        └── marlin_v3/base_link_ned       (roll=π, yaw=−π/2 — static mounting frame)
            ├── marlin_v3/pressure_link
            ├── marlin_v3/front_camera
            ├── marlin_v3/down_camera
            ├── marlin_v3/dvl_link
            ├── marlin_v3/dropper_link
            ├── marlin_v3/left_grabber_link
            ├── marlin_v3/right_grabber_link
            ├── marlin_v3/torpedo_0_link
            ├── marlin_v3/torpedo_1_link
            ├── marlin_v3/thruster_0_link
            ├── ...
            └── marlin_v3/thruster_7_link
```

The offsets in `src/sub_bringup/config/vehicles/marlin_v3.yaml` are relative to `base_link_ned`, except `imu_link`'s, which is relative to `base_link`. `description_launch.py` publishes them on `/tf_static` from one `static_transforms` node.

## Inspecting the graph

From a `pixi shell`, with the stack running:

```bash
ros2 topic list
ros2 topic echo /marlin_v3/odometry/filtered
ros2 topic echo /marlin_v3/control/error
ros2 topic echo /marlin_v3/control/status     # modes, reference, wrench, thrusters, watchdogs
ros2 run tf2_tools view_frames
ros2 topic echo /marlin_v3/sim/thruster_states
```
