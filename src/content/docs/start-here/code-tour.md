---
title: Tour of the code
description: What is in each folder of Thalassic, which files to read first, and where to look when you want to change something.
---

The repository can feel huge at first. Most of it you can ignore for now. This page tells you what is where, and which files are worth reading first.

## The top level

```text
thalassic/
├── src/           All the robot's code, split into packages. This is where you will work.
├── scripts/       Helper scripts: install.sh, format.sh and so on
├── deploy/        Setup for the Jetson on the real robot
├── weights/       The trained neural networks (downloaded, not stored in git)
├── bags/          Recordings of runs (ignored by git)
├── pixi.toml      Every dependency: ROS 2, compilers, libraries
├── pixi.lock      The exact version of each. Generated, so don't edit it by hand
│
├── .pixi/         The installed dependencies (ignored by git)
├── build/         Temporary files from compiling (ignored by git)
├── install/       The compiled result, which is what actually runs (ignored by git)
└── log/           Build and test logs (ignored by git)
```

"Ignored by git" means that these are generated on your computer and never committed. If something goes badly wrong with them, `pixi run clean` deletes `build/`, `install/` and `log/`, and `pixi run build` makes them again.

## The packages

ROS 2 code is organized into **packages**, each a folder with a `package.xml` in it. Ours are all in `src/`:

```text
src/
├── sub_bringup/                 Starts everything: launch files and settings
├── sub_control/
│   ├── sub_control/             The controller: how do I get there?
│   └── sub_control_interfaces/  Its message types
├── sub_mission/                 The plan: what should I do next?
├── sub_vision/
│   ├── sub_vision/              Finding things in images
│   └── sub_vision_interfaces/   Its message and service types
├── sub_drivers/
│   ├── sub_serial_drivers/      Talks to the thruster board and the IMU
│   ├── sub_driver_interfaces/   Service types for the torpedoes and droppers
│   ├── waterlinked_dvl/         The DVL driver (submodule)
│   └── flir_camera_driver/      The down camera driver (submodule)
└── sub_sim/
    ├── sub_sim/                 The simulated pool, props and robot
    ├── sub_sim_sensors/         Stand-ins for the real drivers
    ├── stonefish_ros2/          Connects the simulator to ROS 2 (submodule)
    └── stonefish_vendor/        Builds the simulator itself (submodule)
```

A **submodule** is another git repository inside this one. You will rarely need to touch those.

Here is each one in more detail. The paths in these tables start from that package's folder under `src/`.

### `sub_bringup`: start everything (Python, YAML)

The best place to start reading, because it shows how everything fits together.

| File | What it is |
| --- | --- |
| `launch/sim_launch.py` | What `pixi run up` runs: the whole stack against the simulator |
| `launch/pool_test_launch.py` | The same stack against the real hardware |
| `launch/common_launch.py` | What those two share: the EKF, `sub_control`, `sub_mission`, Foxglove |
| `config/vehicles/marlin_v3.yaml` | **The physical robot:** where each sensor and thruster is mounted |
| `config/control/gains_sim.yaml` | The controller's settings in the simulator |
| `config/control/gains.yaml` | The controller's settings on the real robot |
| `config/ekf.yaml` | How the sensors are combined |
| `foxglove/` | The Foxglove layouts |

### `sub_mission`: the plan (XML, C++)

| File | What it is |
| --- | --- |
| `resources/missions/` | Missions you can run, such as `prelim.xml` and `pool_a.xml` |
| `resources/trees/` | Reusable tasks: `gate.xml`, `slalom.xml`, `torp.xml` and so on |
| `resources/trees/competition.xml` | **The order of a real competition run.** Worth reading |
| `src/nodes/actions/` | The C++ behind XML steps like `PosSetpoint` and `Spin`, one file each |
| `src/nodes/vision.cpp` | The C++ behind the vision steps like `AlignToDetection`. Very long, so leave it for later |
| `test/test_mission.cpp` | The tests |

### `sub_control`: how do I get there? (C++)

| File | What it is |
| --- | --- |
| `sub_control_interfaces/msg/MotionSetpoint.msg` | The command message. Short and well commented |
| `sub_control/src/sub_control.cpp` | The node: its 50 Hz loop, arming and safety checks |
| `sub_control/src/reference_generator.cpp` | Turns a target into a smooth path |
| `sub_control/src/controller.cpp` | The control law: works out the force needed |
| `sub_control/src/allocator.cpp` | Shares that force across the eight thrusters |
| `sub_control/src/sub_control_parameters.yaml` | Every setting, with descriptions |

### `sub_vision`: what can I see? (Python)

| File | What it is |
| --- | --- |
| `sub_vision/sub_vision/vision_node.py` | The node: receives images and publishes detections |
| `sub_vision/sub_vision/backends.py` | Runs the neural network |
| `sub_vision/sub_vision/post_processors/` | Task-specific code, one file per task. `octagon.py` is the shortest |
| `sub_vision_interfaces/msg/Detection.msg` | What a detection contains |

### `sub_drivers`: talking to hardware (C++)

`sub_serial_drivers/src/sub_low.cpp` talks to the thruster board, and `naviguider_imu.cpp` talks to the IMU. These only run on the real robot.

### `sub_sim`: the simulated world (C++, Python, XML, 3D models)

| Folder or file                      | What it is                                          |
| ----------------------------------- | --------------------------------------------------- |
| `sub_sim/scenarios/woollett.scn.j2` | The pool and where every prop goes                  |
| `sub_sim/data/models/`              | 3D models of the props                              |
| `sub_sim/data/robots/marlin_v3/`    | The robot's model                                   |
| `sub_sim_sensors/src/`              | Stand-ins for the drivers, like `sim_thrusters.cpp` |

## Good files to read first

These are short and show how the code is written. Open them while you read this.

| File | Why it's worth reading | Size |
| --- | --- | --- |
| `src/sub_mission/resources/missions/pid_tuning.xml` | A complete mission, in about 20 lines | Very short |
| `src/sub_control/sub_control_interfaces/msg/MotionSetpoint.msg` | How everything commands the robot | Short |
| `src/sub_bringup/config/vehicles/marlin_v3.yaml` | The real robot, described as data | Short |
| `src/sub_mission/src/nodes/actions/stop.cpp` | The simplest behavior tree step in C++ | 30 lines |
| `src/sub_sim/sub_sim_sensors/src/sim_kill_switch.cpp` | A small but complete ROS 2 node in C++ | Short |
| `src/sub_vision/sub_vision/sub_vision/post_processors/octagon.py` | A small piece of vision in Python | 50 lines |
| `src/sub_mission/resources/trees/competition.xml` | How a real run is put together | Medium |

:::tip

Don't start with `vision.cpp` (nearly 3,000 lines) or `sub_control.cpp`. They make more sense once you know the pieces around them.

:::

## Where do I change...?

| I want to change... | Look in |
| --- | --- |
| What the robot does during a run | `src/sub_mission/resources/` |
| How a mission step behaves | `src/sub_mission/src/nodes/actions/` |
| How fast the robot moves | `trajectory.*` in `src/sub_bringup/config/control/gains_sim.yaml` |
| How aggressively it corrects errors | `gains.*` in the same file. See [Control and PID](/concepts/control/) |
| Where a sensor or thruster is mounted | `src/sub_bringup/config/vehicles/marlin_v3.yaml` |
| How a task's detections are interpreted | `src/sub_vision/sub_vision/sub_vision/post_processors/` |
| Which neural network a task uses | `TASK_MODELS` in `src/sub_vision/sub_vision/sub_vision/model_manager.py` |
| What the simulated pool looks like | `src/sub_sim/sub_sim/scenarios/woollett.scn.j2` |
| What runs when I launch | `src/sub_bringup/launch/` |
| A dependency | `pixi.toml`, then see [Updating dependencies](/thalassic/setup/#updating-dependencies) |

## How to find things

Search! This finds every line in the repository containing some text:

```bash
git grep "kill_switch"
```

In VS Code, Ctrl-Shift-F does the same, and Ctrl-P jumps to any file by typing part of its name. With the clangd extension set up, Ctrl-click on anything in C++ jumps to where it is defined.

A good way to understand a feature is to follow its data. Pick a topic like `motion_setpoint`, then `git grep` for it to see who publishes it and who subscribes to it.

## Other repositories

Thalassic is the main one, but not the only one:

| Repository | What it is |
| --- | --- |
| [maritime](https://github.com/avbotz/maritime) | The firmware on the thruster board, in C |
| [foxglove-extensions](https://github.com/avbotz/foxglove-extensions) | Our panels in Foxglove, in TypeScript |
| [remora](https://github.com/avbotz/remora) | Turns recordings into training data and trained models. It is private, so ask a lead for access |
| [software-docs](https://github.com/avbotz/software-docs) | This website |

Next: [pick an area](/start-here/pick-an-area/).
