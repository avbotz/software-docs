---
title: ROS 2, hands on
description: Learn what nodes, topics, messages, services and parameters are by poking at the running robot software.
---

[ROS 2](https://docs.ros.org/en/jazzy/) (Robot Operating System 2), the framework our software is built on, is not an operating system but a set of tools that lets separate programs find each other and exchange data.

## Two terminals

Start the software in one terminal:

```bash title="Terminal 1: the robot"
cd ~/avbotz/thalassic
pixi run up
```

Wait for `armed`, then leave that terminal running. In the second one:

```bash title="Terminal 2: you"
cd ~/avbotz/thalassic
pixi shell
```

`pixi shell` makes the `ros2` command work: run every command below in it. `ros2: command not found` means the terminal needs `pixi shell` first. Type `exit` to leave it.

## Nodes: the programs

A **node** is one program in the system. List them:

```bash
ros2 node list
```

```text
/diagnostic_aggregator
/foxglove_bridge
/marlin_v3/ekf_filter_node
/marlin_v3/sim_dvl_remapper
/marlin_v3/sim_imu_remapper
/marlin_v3/sim_kill_switch
/marlin_v3/sim_pressure_to_depth
/marlin_v3/sim_thrusters
/marlin_v3/static_transforms
/marlin_v3/sub_control
/marlin_v3/sub_vision
/marlin_v3/sub_vision_down
/stonefish_ros2/stonefish_simulator
...
```

The `/marlin_v3/` at the front is a **namespace**, like a folder: these nodes belong to the robot named `marlin_v3`.

## Topics and messages: how nodes talk

Nodes talk by sending **messages** over named channels called **topics**. A node _publishes_ to topics and _subscribes_ to them. Like a radio station, the sender does not know who is listening.

```bash
ros2 topic list
```

```text
/clock
/diagnostics
/marlin_v3/altitude
/marlin_v3/control/armed
/marlin_v3/control/error
/marlin_v3/control/status
/marlin_v3/control/thrusters
/marlin_v3/dvl/velocity
/marlin_v3/imu/data
/marlin_v3/kill_switch
/marlin_v3/motion_setpoint
/marlin_v3/odometry/depth
/marlin_v3/odometry/filtered
...
```

Listen to one. `--once` prints one message and stops:

```bash
ros2 topic echo --once /marlin_v3/control/armed
```

```text
data: true
---
```

The controller is ready. This one shows where the robot thinks it is:

```bash
ros2 topic echo --once --field pose.pose.position /marlin_v3/odometry/filtered
```

```text
x: -0.004476546400027581
y: -0.0002583040697962395
z: -0.125821272809971
```

These are meters. x and y are about 0 because they are zeroed where the robot armed. z is about −0.13: **z is up, so underwater is negative**, and the depth sensor is 13 cm down. See [Coordinates](/concepts/coordinates/).

Without `--once`, a command keeps printing until you press Ctrl-C. `topic hz` shows how often the controller publishes:

```bash
ros2 topic hz /marlin_v3/control/thrusters
```

```text
average rate: 50.809
	min: 0.012s max: 0.041s std dev: 0.00260s window: 156
```

Fifty times a second. Press Ctrl-C, then see the eight thruster commands:

```bash
ros2 topic echo --once --field command /marlin_v3/control/thrusters
```

```text
[ 0.13035206 -0.15887984  0.10943386  0.05355088  0.08982603  0.02886089
  0.07295525  0.10595979]
```

Each runs from −1 to 1 (full power). They are small because the robot is only holding still.

## Who talks to whom

Ask about a topic to see its message type, and how many nodes are on each end:

```bash
ros2 topic info /marlin_v3/motion_setpoint
```

```text
Type: sub_control_interfaces/msg/MotionSetpoint
Publisher count: 0
Subscription count: 1
```

One node listens, and nobody is sending. `node info` shows everything a node uses:

```bash
ros2 node info /marlin_v3/sub_control
```

```text
/marlin_v3/sub_control
  Subscribers:
    /marlin_v3/altitude: sensor_msgs/msg/Range
    /marlin_v3/dvl/velocity: geometry_msgs/msg/TwistWithCovarianceStamped
    /marlin_v3/imu/data: sensor_msgs/msg/Imu
    /marlin_v3/kill_switch: std_msgs/msg/Bool
    /marlin_v3/motion_setpoint: sub_control_interfaces/msg/MotionSetpoint
    /marlin_v3/odometry/depth: nav_msgs/msg/Odometry
    /marlin_v3/odometry/filtered: nav_msgs/msg/Odometry
    ...
  Publishers:
    /marlin_v3/control/armed: std_msgs/msg/Bool
    /marlin_v3/control/error: sub_control_interfaces/msg/Error
    /marlin_v3/control/status: sub_control_interfaces/msg/ControllerStatus
    /marlin_v3/control/thrusters: sub_control_interfaces/msg/ThrusterCommand
    ...
```

That is the controller's whole interface: it reads the sensors and `motion_setpoint`, and writes `control/thrusters`.

## Send your first command

Anything that tells the robot where to go publishes on `motion_setpoint`. Its message type:

```bash
ros2 interface show sub_control_interfaces/msg/MotionSetpoint
```

It prints the full definition. The fields used here:

- `mode` has six numbers, one for each axis, in the order `[x, y, z, roll, pitch, yaw]`.
- `position` has the target for each axis.
- The mode numbers mean: `0` leave this axis alone, `1` go to a position, `2` move at a velocity, `3` stop and hold, `4` push with a set force.

To go 1 meter deep, set the third axis (z) to mode 1 with a target of −1, and watch the simulator window:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 1, 0, 0, 0], position: [0.0, 0.0, -1.0, 0.0, 0.0, 0.0]}'
```

```text
Waiting for at least 1 matching subscription(s)...
publisher: beginning loop
publishing #1: sub_control_interfaces.msg.MotionSetpoint(...)
```

The robot dives. After 15 seconds, check its depth:

```bash
ros2 topic echo --once --field pose.pose.position.z /marlin_v3/odometry/filtered
```

```text
-0.9986145290530354
---
```

Within a few millimeters. Now swim 1 meter forward. x and y share a mode, so set both:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [1, 1, 0, 0, 0, 0], position: [1.0, 0.0, 0.0, 0.0, 0.0, 0.0]}'
```

To turn: yaw is in radians and positive is left, so 1.57 is a quarter turn left:

```bash
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 0, 0, 0, 1], position: [0.0, 0.0, 0.0, 0.0, 0.0, 1.57]}'
```

`sub_mission` does the same during a run, deciding when to send what.

**Try it:** `control/error` publishes how far the robot is from its target. Run `ros2 topic echo --once --field pos_error /marlin_v3/control/error`, send a new position, and run it again right away.

## Press the kill switch

Engage the simulated kill switch:

```bash
ros2 topic pub --once /marlin_v3/sim/kill_switch std_msgs/msg/Bool '{data: true}'
```

The thrusters stop, the robot floats up, and the controller disarms:

```bash
ros2 topic echo --once /marlin_v3/control/armed
```

```text
data: false
---
```

A dive command now does nothing: commands are rejected while killed. Release the switch and wait a few seconds:

```bash
ros2 topic pub --once /marlin_v3/sim/kill_switch std_msgs/msg/Bool '{data: false}'
```

The controller arms again and **re-zeroes its position**: wherever the robot is now becomes the new x = 0, y = 0. At the pool, this happens when a diver releases the switch at the start of a run.

## Services: asking a question

Topics are one-way broadcasts. A **service** is a request with a reply, like calling a function in another program. This one loads a neural network for the camera:

```bash
ros2 service call /marlin_v3/sub_vision/load_model sub_vision_interfaces/srv/LoadModel "{task: 'gate'}"
```

```text
requester: making request: sub_vision_interfaces.srv.LoadModel_Request(task='gate')

response:
sub_vision_interfaces.srv.LoadModel_Response(success=True, message="loaded 'gate' (ffc_rs_26) via onnxruntime/cpu (warmup 78.0 ms/iter)", active_model='gate (onnxruntime/cpu)', load_time_s=0.3296832740306854)
```

(Vision needs the windowed simulator: `headless:=true` has no cameras.)

This one makes the robot's current position the new zero:

```bash
ros2 service call /marlin_v3/sub_control/reset_pose std_srvs/srv/Trigger
```

```text
response:
std_srvs.srv.Trigger_Response(success=True, message='zeroing x, y and yaw; holding here once the EKF confirms')
```

## Parameters: a node's settings

A **parameter** is a setting you can read, and often change, while a node runs. `power_limit` caps the thruster commands:

```bash
ros2 param get /marlin_v3/sub_control power_limit
```

```text
Double value is: 0.6
```

```bash
ros2 param describe /marlin_v3/sub_control power_limit
```

```text
Parameter name: power_limit
  Type: double
  Description: Max |normalized thruster command|, up to MAX_POWER_LIMIT (allocator.hpp)
  Constraints:
    Min value: 0.0
    Max value: 0.6
```

Lower it, and the robot moves more gently:

```bash
ros2 param set /marlin_v3/sub_control power_limit 0.3
```

```text
Set parameter successful
```

The change lasts until the node stops. To keep it, edit `src/sub_bringup/config/control/gains_sim.yaml`.

## Launch files: starting everything

A **launch file** starts many nodes at once, with their settings. `pixi run up` is a shortcut for this command, which also works in a `pixi shell`:

```bash
ros2 launch sub_bringup sim_launch.py
```

Launch files are Python. This is how `src/sub_bringup/launch/common_launch.py` starts the controller:

```python
Node(
    package="sub_control",
    executable="sub_control",
    name="sub_control",
    namespace=robot_name,
    output="both",
    parameters=[
        package_config("sub_bringup", LaunchConfiguration("gains")),
        {"robot_name": robot_name, **vehicle.thruster_layout()},
    ],
)
```

## Cheat sheet

```bash
ros2 node list                        # every running node
ros2 node info <node>                 # what a node subscribes to, publishes and serves
ros2 topic list                       # every topic
ros2 topic echo <topic>               # print messages (Ctrl-C to stop)
ros2 topic echo --once <topic>        # print one message
ros2 topic echo --field <a.b> <topic> # print just one field
ros2 topic hz <topic>                 # how fast it publishes
ros2 topic info <topic>               # its type, and how many publishers and subscribers
ros2 topic pub --once <topic> <type> '<message>'   # send a message
ros2 interface show <type>            # what is in a message or service type
ros2 service list                     # every service
ros2 service call <service> <type> '<request>'     # call a service
ros2 param list <node>                # a node's settings
ros2 param get <node> <name>          # read one
ros2 param set <node> <name> <value>  # change one
ros2 launch <package> <file>          # start a launch file
```
