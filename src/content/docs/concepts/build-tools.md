---
title: Build tools
description: What pixi, colcon and git submodules do, what each folder is for, and when you need to rebuild.
---

Several tools sit between the code and a running robot. You can get a long way just by copying commands, but things make more sense, and are much easier to fix, once you know what each tool does.

## The short version

| Tool | Its job | You use it as |
| --- | --- | --- |
| **pixi** | Installs everything the code needs: ROS 2, compilers, libraries | `pixi run ...`, `pixi shell` |
| **colcon** | Builds our ROS 2 packages | `pixi run build` |
| **git submodules** | Pull other repositories into ours | `git submodule update --init --recursive` |

## pixi: installs everything

Our code needs ROS 2, a C++ compiler, Python and over a hundred other packages, all in versions that work together. Normally that means an afternoon of installing things, and two computers set up a week apart end up with different versions. Then you get bugs that only happen on one person's laptop.

[Pixi](https://pixi.sh) solves this. Two files describe everything:

- **`pixi.toml`** lists what we want, such as "ROS 2 Jazzy" or "OpenCV 4". You edit this one.
- **`pixi.lock`** records the _exact_ version of every package, for every computer type. Pixi generates it, so never edit it by hand. It's why everyone gets the same thing.

Everything gets installed into `.pixi/` in the repository, not on your system. So it needs no `sudo`, can't conflict with anything else, and disappears if you delete the folder.

There are two ways to use that environment:

```bash
pixi run build      # run one command inside it
pixi shell          # open a shell inside it, for many commands
```

That's why `ros2` works after `pixi shell`, but gives `command not found` in a plain terminal.

Inside `pixi.toml`, the `[tasks]` section defines shortcuts like `build` and `up`. Run `pixi task list` to see them all.

There are two environments. `default` is for laptops, and `jetson` is for the robot, which leaves out the simulator and has GPU support. On the robot every command names it: `pixi run -e jetson build`.

### Adding a dependency

```bash
pixi add ros-jazzy-some-package
```

That updates both files, and you commit both.

## colcon: builds the packages

ROS 2 code is split into **packages**, and they depend on each other. `sub_control` needs the message types from `sub_control_interfaces`, so that has to build first. **colcon** figures out the order and builds each one.

A package has a `package.xml`, which lists its name and what it depends on, plus:

- `CMakeLists.txt` for C++ packages, which lists what to compile, or
- `setup.py` for Python packages.

Colcon uses these folders:

| Folder     | What's in it                                           |
| ---------- | ------------------------------------------------------ |
| `src/`     | Your code, the only one in git                         |
| `build/`   | Temporary files from compiling, one folder per package |
| `install/` | The finished result, and what actually runs            |
| `log/`     | Logs of each build and test run                        |

The command you will use most often:

```bash
pixi run build                                # build everything that changed
pixi run build --packages-select sub_control  # build just this package
```

`pixi run clean` deletes `build/`, `install/` and `log/`. That's a safe thing to try if a build gets into a strange state, but the next build takes a while.

### When do I need to rebuild?

This catches everyone out. We build with `--symlink-install`, which means that `install/` _links_ to many of your source files instead of copying them. So most files that aren't compiled take effect without a rebuild.

| You changed... | What you need to do |
| --- | --- |
| A Python file | Restart the program |
| A mission or tree XML file | Run the mission again |
| A YAML settings file or a launch file | Restart the stack |
| **A C++ file** | `pixi run build --packages-select <package>`, then restart |
| **A new file** of any kind | Build that package, to create its link |
| **A `.msg` or `.srv` file** | Build that package and those that use it. If in doubt, run `pixi run build` |
| **`pixi.toml`** | Commit `pixi.lock` too. Pixi updates the environment the next time you run something |

If your change seems to have no effect, the first thing to check is whether it needed a rebuild.

## Submodules: repositories inside ours

Some packages live in their own repositories. A **git submodule** includes another repository at an exact commit. Ours are:

- `src/sub_sim/stonefish_ros2` and `src/sub_sim/stonefish_vendor/stonefish`: the simulator
- `src/sub_drivers/waterlinked_dvl`: the DVL driver
- `src/sub_drivers/flir_camera_driver`: the down camera driver

If one of those folders is empty, or you get build errors in one after pulling, run:

```bash
git submodule update --init --recursive
```

## After pulling new code

Others have probably changed all of this since you last pulled. This handles every case:

```bash
git pull --recurse-submodules
pixi install --frozen
pixi run build
pixi run fetch-weights
```

`--frozen` means to install exactly what's in `pixi.lock`.

## Tests and CI

```bash
pixi run test       # run every test, including one full run of the stack in the simulator
pixi run lint       # check formatting
pixi run format     # fix formatting
```

To run the tests for one package:

```bash
pixi run colcon test --packages-select sub_mission
pixi run colcon test-result --test-result-base build/sub_mission --verbose
```

**CI** runs the same commands on GitHub's computers for every pull request. The file `.github/workflows/ci.yml` lists exactly what it does.

## The DDS layer

You will sometimes see **DDS** in errors. It's what ROS 2 uses under the hood to find nodes and send messages. We have it look only on your own computer by default, so that two people on the same Wi-Fi don't see each other's simulators. That's set in `pixi.toml`, as `ROS_AUTOMATIC_DISCOVERY_RANGE`.

If nodes stop finding each other after a crash, `pixi run reset` clears out what's left behind. [DDS discovery](/thalassic/setup/#dds-discovery) has more.

## Learn more

[Setup & Build](/thalassic/setup/) is the full reference, and [Decisions](/thalassic/decisions/) explains why we chose these tools.
