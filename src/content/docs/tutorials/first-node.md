---
title: Write a ROS 2 node
description: Write two small Python programs that read the robot's depth and command it to move.
---

In this tutorial you write your own node, in Python: first one that listens to the robot, then one that commands it.

You should know a little Python: what a function and a class are. You should also have done [ROS 2, hands on](/start-here/ros-2-hands-on/).

## A node that listens

We'll print the robot's depth. In `~/avbotz/playground`, create `depth_watcher.py`:

```python title="depth_watcher.py"
"""Print the vehicle's depth twice a second."""

import rclpy
from nav_msgs.msg import Odometry
from rclpy.executors import ExternalShutdownException
from rclpy.node import Node


class DepthWatcher(Node):
    def __init__(self):
        super().__init__("depth_watcher")
        self.latest_z = None
        self.create_subscription(Odometry, "/marlin_v3/odometry/filtered", self.on_odometry, 10)
        self.create_timer(0.5, self.print_depth)

    def on_odometry(self, msg):
        self.latest_z = msg.pose.pose.position.z

    def print_depth(self):
        if self.latest_z is None:
            self.get_logger().info("no odometry yet")
        else:
            self.get_logger().info(f"depth: {-self.latest_z:.2f} m")


def main():
    rclpy.init()
    try:
        rclpy.spin(DepthWatcher())
    except (KeyboardInterrupt, ExternalShutdownException):
        pass


if __name__ == "__main__":
    main()
```

Going through it:

| Code | What it does |
| --- | --- |
| `import rclpy` | The ROS 2 library for Python |
| `from nav_msgs.msg import Odometry` | The message type of the topic. `ros2 topic info` tells you which one you need |
| `class DepthWatcher(Node)` | Our node, built on ROS 2's `Node` class |
| `super().__init__("depth_watcher")` | Gives the node its name, which you will see in `ros2 node list` |
| `self.create_subscription(Odometry, ".../odometry/filtered", self.on_odometry, 10)` | "When a message arrives on this topic, call `on_odometry`." The `10` is how many messages to queue if we fall behind |
| `self.create_timer(0.5, self.print_depth)` | "Call `print_depth` every 0.5 seconds" |
| `msg.pose.pose.position.z` | The same field you read with `--field pose.pose.position.z` |
| `-self.latest_z` | z is negative underwater, so we flip the sign to get depth |
| `rclpy.spin(...)` | Runs the node until you stop it: it waits for messages and timers, and calls your functions |

Notice that you never call `on_odometry` yourself. ROS 2 calls it whenever a message arrives. This is called a **callback**, and nearly all robot code works this way.

### Run it

Start the simulator in one terminal, and wait for `armed`:

```bash title="Terminal 1"
cd ~/avbotz/thalassic
pixi run up
```

Run your node in another. You need `pixi shell` first, which gives Python access to ROS 2:

```bash title="Terminal 2"
cd ~/avbotz/thalassic
pixi shell
python ~/avbotz/playground/depth_watcher.py
```

```text
[INFO] [1793586882.379677586] [depth_watcher]: depth: 0.13 m
[INFO] [1793586882.879320704] [depth_watcher]: depth: 0.13 m
[INFO] [1793586883.379378441] [depth_watcher]: depth: 0.13 m
```

Now, in a third terminal (also `cd ~/avbotz/thalassic`, then `pixi shell`), make the robot dive and watch the number change:

```bash title="Terminal 3"
ros2 topic pub --once /marlin_v3/motion_setpoint sub_control_interfaces/msg/MotionSetpoint '{mode: [0, 0, 1, 0, 0, 0], position: [0.0, 0.0, -1.0, 0.0, 0.0, 0.0]}'
```

While your node is running, `ros2 node list` shows `/depth_watcher` too. Your code is part of the robot now.

Press Ctrl-C in Terminal 2 to stop it.

## A node that commands

Now a node that makes the robot do something: every 15 seconds, it sends the robot to the other of two depths. Create `depth_bobber.py`:

```python title="depth_bobber.py"
"""Every 15 seconds, send the vehicle to the other of two depths."""

import rclpy
from rclpy.executors import ExternalShutdownException
from rclpy.node import Node
from sub_control_interfaces.msg import MotionSetpoint

SHALLOW_Z = -0.5
DEEP_Z = -1.5


class DepthBobber(Node):
    def __init__(self):
        super().__init__("depth_bobber")
        self.publisher = self.create_publisher(MotionSetpoint, "/marlin_v3/motion_setpoint", 10)
        self.target_z = SHALLOW_Z
        self.create_timer(15.0, self.switch_target)

    def switch_target(self):
        self.target_z = DEEP_Z if self.target_z == SHALLOW_Z else SHALLOW_Z

        msg = MotionSetpoint()
        z = 2  # axes are [x, y, z, roll, pitch, yaw]
        msg.mode[z] = MotionSetpoint.POSITION
        msg.position[z] = self.target_z
        self.publisher.publish(msg)
        self.get_logger().info(f"new target: z = {self.target_z} m")


def main():
    rclpy.init()
    try:
        rclpy.spin(DepthBobber())
    except (KeyboardInterrupt, ExternalShutdownException):
        pass


if __name__ == "__main__":
    main()
```

The new pieces:

| Code | What it does |
| --- | --- |
| `self.create_publisher(MotionSetpoint, ".../motion_setpoint", 10)` | Lets this node send messages on the topic |
| `msg = MotionSetpoint()` | A new, empty message. Every mode starts at 0, which means `KEEP`: leave this axis alone |
| `msg.mode[z] = MotionSetpoint.POSITION` | The named version of the `1` you typed by hand. Its definition is in `MotionSetpoint.msg` |
| `self.publisher.publish(msg)` | Sends it |

Run it the same way, with your `depth_watcher` running beside it so you can watch the depth change. After 15 seconds:

```text
[INFO] [1793586899.569396041] [depth_bobber]: new target: z = -1.5 m
[INFO] [1793586914.549367140] [depth_bobber]: new target: z = -0.5 m
```

The robot dives and rises for as long as the node is running. When you stop the node, the robot stays at its last target, since the target is what `sub_control` remembers.

## Exercises

1. **Print how far there is to go.** Subscribe to `/marlin_v3/control/error`. Its type is `Error`, imported with `from sub_control_interfaces.msg import Error`, and `msg.pos_error` is a list of three numbers. Print the z error.
1. **Combine them.** Rather than waiting 15 seconds, have `depth_bobber` switch targets once the depth is within 5 cm of the target. You will need a subscription and a publisher in one node.
1. **Swim a square.** Rewrite your [square mission](/tutorials/first-mission/#repeat-swim-a-square) as a Python node. You will quickly see why we write missions as behavior trees instead.

## How real nodes differ

These scripts are a great way to experiment. Real nodes in the repository differ in a few ways:

- **They are in a package**, so `ros2 run` and launch files can find them. See how `src/sub_vision/sub_vision/setup.py` lists its node under `console_scripts`.
- **Topic names are relative.** Real nodes use `odometry/filtered` with no `/marlin_v3` in front, and the launch file puts them in the right namespace. That is how the same code could run on a robot with a different name.
- **They use the message's timestamp** to tell how old the data is, rather than assuming that it just arrived. You can read about why in [Safety](/thalassic/control/#safety).

The official [Python publisher and subscriber tutorial](https://docs.ros.org/en/jazzy/Tutorials/Beginner-Client-Libraries/Writing-A-Simple-Py-Publisher-And-Subscriber.html) shows how to make a package from scratch.

Next: [change the C++](/tutorials/first-cpp-change/).
