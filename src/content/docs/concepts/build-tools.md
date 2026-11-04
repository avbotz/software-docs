---
title: Build tools
description: What pixi, colcon, CMake, setuptools and git submodules do, what each folder is for, and when you need to rebuild.
---

## [Pixi](https://pixi.sh/)

To run, our codebase requires ROS 2, a C++ compiler, Python, and various other packages in versions that are compatible with each other. We use Pixi as our package manager to ensure that the exact same versions of packages are installed on every computer. To achieve this reproducibility, Pixi uses two files:

- **`pixi.toml`** lists the versions of packages we directly use (e.g. "ROS 2 Jazzy" or "OpenCV 4"). This file can be manually edited (or modified with commands like `pixi add ...`).
- **`pixi.lock`** records the _exact_ version of every package, for every environment. Pixi will automatically generate this file, so never edit it by hand.

Pixi will install everything into a project specific environment. To use the environment:

```bash
pixi run build      # run one command inside it
pixi shell          # open a shell inside it, for many commands
```

The `[tasks]` section of `pixi.toml` defines shortcuts like `build` and `up`. `pixi task list` lists them all.

To use tools installed in the Pixi environment (like `ros2`), you must activate the environment or use one of the tasks.

Different environments can be . `default` is for laptops, and `jetson` is for the robot, which leaves out the simulator and has GPU support.

When running commands on the jetson, you must explicitly indicate that you want to use the jetson environment (`pixi run -e jetson build`).

### Adding a dependency

```bash
pixi add ros-jazzy-some-package
```

Regarding why we chose Pixi instead of apt, pip, or some other dependency management tool, please refer to [Decisions](/thalassic/decisions/#1-pixi--robostack-instead-of-apt-ros-rosdep-and-a-venv).

## colcon

ROS 2 code is split into **packages** that depend on each other: `sub_control` needs the message types from `sub_control_interfaces`, so that builds first. **colcon** works out the order and builds each one.

A package has a `package.xml`, which lists its name and what it depends on, plus:

- `CMakeLists.txt` for C++ packages, which lists what to compile, or
- `setup.py` for Python packages.

[Inside a package](#inside-a-package-ament-cmake-and-setuptools) explains each of these files.

Colcon uses these folders:

| Folder     | What's in it                                           |
| ---------- | ------------------------------------------------------ |
| `src/`     | Your code, the only one in git                         |
| `build/`   | Temporary files from compiling, one folder per package |
| `install/` | The finished result, and what actually runs            |
| `log/`     | Logs of each build and test run                        |

To build:

```bash
pixi run build                                # build everything that changed
pixi run build --packages-select sub_control  # build just this package
```

`pixi run clean` deletes `build/`, `install/` and `log/`. It is safe to try if a build gets into a strange state, but the next build takes a while.

### Useful colcon options

These work with `pixi run build`, and with `pixi run colcon list` to see what they would build:

| Option                             | What it does                                                         |
| ---------------------------------- | -------------------------------------------------------------------- |
| `--packages-select <package>`      | Only that package                                                    |
| `--packages-up-to <package>`       | That package and everything it needs                                 |
| `--packages-above <package>`       | That package and everything that needs it                            |
| `--event-handlers console_direct+` | Shows everything that CMake and the compiler print, as they print it |

`colcon_defaults.yaml` holds the options used on every build, and `colcon.meta` the options for individual packages, mostly the submodules whose files we can't change. [Workspace layout](/thalassic/setup/#workspace-layout) lists the other files.

### When do I need to rebuild?

We build with `--symlink-install`, so `install/` _links_ to many source files instead of copying them using [symlinks](https://en.wikipedia.org/wiki/Symbolic_link). Therefore, most files that aren't compiled take effect without a rebuild.

| You changed...                        | What you need to do                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| A Python file                         | No rebuild needed                                                           |
| A mission or tree XML file            | No rebuild needed                                                           |
| A YAML settings file or a launch file | No rebuild needed                                                           |
| **A C++ file**                        | Build needed of at least that package                                       |
| **A new file** of any kind            | Build needed of at least that package                                       |
| **A `.msg` or `.srv` file**           | Build that package and those that use it. If in doubt, run `pixi run build` |

If a change seems to have no effect, check first whether it needed a rebuild.

## Inside a package: ament, CMake and setuptools

colcon doesn't compile anything itself. It hands each package to the build tool named at the bottom of its `package.xml`:

```xml
<export>
  <build_type>ament_python</build_type>
</export>
```

`colcon list` shows every package, where it is, and its build type:

```text
$ pixi run colcon list
...
sub_bringup	src/sub_bringup	(ros.ament_python)
sub_control	src/sub_control/sub_control	(ros.ament_cmake)
sub_control_interfaces	src/sub_control/sub_control_interfaces	(ros.ament_cmake)
...
```

We use two build types. `sub_bringup`, `sub_sim` and `sub_vision` are `ament_python`, and every other package is `ament_cmake`. Each one is a stack of tools:

```text
pixi run build
└── colcon build               finds the packages and builds them in order
    ├── ament_cmake packages   the C++ packages, and the message packages
    │   └── CMake              reads CMakeLists.txt, and writes instructions for make
    │       └── make           runs the compiler on whatever changed
    │           └── g++        compiles C++
    └── ament_python packages  the Python packages
        └── setuptools         reads setup.py, and installs the code
```

CMake and setuptools are the standard build tools for C++ and Python, not ROS tools, so most of what you read about them online applies here. **ament** is what ROS 2 adds to them, mainly so that other packages and commands like `ros2 run` can find what each package installed.

### package.xml: what a package needs

Every package has a `package.xml`, which contains metadata about package. Most importantly, it contains a list of other packages upon which the package depends. From `sub_control`'s:

```xml
<depend>rclcpp</depend>
<depend>sub_control_interfaces</depend>
<buildtool_depend>ament_cmake</buildtool_depend>
<exec_depend>python3-numpy</exec_depend>
<test_depend>ament_cmake_gtest</test_depend>
```

| Tag                  | Needed for                  |
| -------------------- | --------------------------- |
| `<depend>`           | Building it and running it. |
| `<buildtool_depend>` | The build tool itself       |
| `<exec_depend>`      | Only running it             |
| `<test_depend>`      | Only its tests              |

colcon reads these to work out the order. `sub_mission` uses the message types from all three `_interfaces` packages, so they are built first:

```text
$ pixi run colcon list --names-only --topological-order --packages-up-to sub_mission
sub_control_interfaces
sub_driver_interfaces
sub_vision_interfaces
sub_mission
```

`package.xml` only says what's needed; pixi installs it. So a new dependency from outside the repository goes in more than one place:

| File                         | What it's for                           | Python package | C++ package |
| ---------------------------- | --------------------------------------- | -------------- | ----------- |
| `pixi.toml`, with `pixi add` | Installing it                           | ✓              | ✓           |
| `package.xml`                | Telling colcon and ROS that it's needed | ✓              | ✓           |
| `CMakeLists.txt`             | Telling the compiler where to find it   |                | ✓           |

In `pixi.toml`, a ROS package's name starts with `ros-jazzy-` and uses dashes, so `vision_msgs` is `ros-jazzy-vision-msgs`. A dependency on another of our own packages doesn't go in `pixi.toml`, since colcon builds it.

Leaving a dependency out of `package.xml` often seems fine at first, because it's installed anyway, until colcon builds packages in the wrong order and a clean build fails.

### CMake and ament_cmake: C++ packages

A C++ package can have dozens of files, each needing different libraries. You write _what_ to build in `CMakeLists.txt`, and **CMake** works out the commands. It writes them as instructions for **make**, which runs the compiler, `g++`, on only what changed since the last build. That's why a second build is much quicker than the first.

Part of `src/sub_control/sub_control/CMakeLists.txt`, with comments added:

```cmake
cmake_minimum_required(VERSION 3.16)
project(sub_control)                  # sets ${PROJECT_NAME} to sub_control

find_package(ament_cmake REQUIRED)    # find each dependency
find_package(rclcpp REQUIRED)
find_package(sub_control_interfaces REQUIRED)
...

# A library called sub_control_core, compiled from these files
add_library(${PROJECT_NAME}_core STATIC
  src/allocator.cpp
  src/controller.cpp
  ...)

# A program called sub_control, compiled from this file and using that library
add_executable(${PROJECT_NAME} src/sub_control.cpp)
target_link_libraries(${PROJECT_NAME} ${PROJECT_NAME}_core ...)
ament_target_dependencies(${PROJECT_NAME} rclcpp sub_control_interfaces ...)

# Put the program in install/, where ros2 run looks for it
install(TARGETS ${PROJECT_NAME} DESTINATION lib/${PROJECT_NAME})

ament_package()                       # always the last line
```

- **A target** is one thing CMake builds: `add_executable` makes a program, and `add_library` a library for other targets to use. The files after the name are what it's compiled from, so a new `.cpp` file goes in one of these lists, as in [Connect it](/tutorials/first-cpp-change/#step-2-connect-it).
- **`find_package`** finds a dependency, and **`ament_target_dependencies`** or **`target_link_libraries`** let a target use it. Forget either and the build fails, usually because the compiler can't find a header file, or with `undefined reference` when the program is linked.
- **`install`** copies or links what was built in `build/` into `install/`, the only folder used to run. Leave it out and `ros2 run` says `No executable found`.
- **`ament_package()`** registers the package so other packages can `find_package` it.

#### Message packages

The `_interfaces` packages are `ament_cmake` too, though they contain no C++. The key part of their `CMakeLists.txt` turns each `.msg` and `.srv` file into C++ _and_ Python:

```cmake
rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/ControllerStatus.msg"
  "msg/Error.msg"
  "msg/MotionSetpoint.msg"
  "msg/ThrusterCommand.msg"
  DEPENDENCIES std_msgs
)
```

That's how Python can `from sub_control_interfaces.msg import Error`, and C++ can `#include "sub_control_interfaces/msg/error.hpp"`. A new message file has to be added to this list.

The generated C++ is compiled into every package that uses it, so changing a message means rebuilding all of them. `--packages-above` finds them, and includes the package itself:

```text
$ pixi run colcon list --names-only --packages-above sub_control_interfaces
sub_bringup
sub_control
sub_control_interfaces
sub_mission
sub_serial_drivers
sub_sim_sensors
```

So `pixi run build --packages-above sub_control_interfaces` rebuilds exactly what a change to one of its messages needs.

### setuptools and ament_python: Python packages

Python doesn't need compiling, so building a Python package means installing it: putting the code where Python can import it, making a small program for each node, and copying files like settings into place. **setuptools** does that, following `setup.py`.

A Python package contains a folder with the same name:

```text
src/sub_vision/sub_vision/     the package, which colcon builds
├── package.xml
├── setup.py                   what to install
├── setup.cfg                  puts the programs where ros2 run looks. Never needs changing
├── resource/sub_vision        an empty file that lets ROS find the package
├── config/sub_vision.yaml
├── sub_vision/                the Python code, which you import as sub_vision
│   ├── __init__.py
│   ├── vision_node.py
│   └── ...
└── test/
```

The parts of `setup.py` you'll change are `data_files` and `entry_points`. From `sub_vision`'s:

```python
setup(
    name=package_name,
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        (os.path.join("share", package_name, "config"), glob("config/*.yaml")),
    ],
    ...
    entry_points={
        "console_scripts": [
            "sub_vision = sub_vision.vision_node:main",
        ],
    },
)
```

- **`packages`** is the Python code. `find_packages` finds every folder with an `__init__.py` in it, so you don't need to list them.
- **`data_files`** is everything else to install. Each entry is a folder in `install/`, then the files to put there. The first two, the same in every package, let ROS find it. Launch files and settings are found only in `install/share/<package>/`, so a new folder of them needs an entry here. A `glob` such as `config/*.yaml` is expanded only when you build, which is why a new file needs a build.
- **`entry_points`** makes the programs. `sub_vision = sub_vision.vision_node:main` makes a program called `sub_vision` that runs `main()` in `sub_vision/vision_node.py`, started by `ros2 run sub_vision sub_vision` (the package's name, then the program's). A new node needs a new line here.

`install_requires` isn't how we add a library: pixi installs those, as in [package.xml](#packagexml-what-a-package-needs).

### Where everything ends up

We build with `--merge-install`, so every package installs into the same `install/` folder:

| What                                               | Where in `install/`             | What looks there                               |
| -------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| Programs, both C++ and Python                      | `lib/<package>/`                | `ros2 run`                                     |
| Python code, ours and that generated from messages | `lib/python3.12/site-packages/` | `import`                                       |
| Launch files, settings and `package.xml`           | `share/<package>/`              | `ros2 launch`, `get_package_share_directory()` |
| C++ headers generated from messages                | `include/`                      | The compiler, for other packages               |

`--symlink-install` makes many of these into links. In `install/lib/sub_control/`, the Python script links back to `src/`, so an edit to it takes effect straight away, while the C++ program links to `build/`, which only changes when you compile:

```text
$ ls -l install/lib/sub_control/
... identify_model -> .../thalassic/src/sub_control/sub_control/scripts/identify_model
... sub_control -> .../thalassic/build/sub_control/sub_control
```

`ros2` knows to look in `install/` because pixi runs `install/setup.bash` (or `setup.zsh`) each time it starts, so skip the `source install/setup.bash` step that other ROS 2 tutorials give. The exception is a `pixi shell` opened before the first build: [exit it and open it again](/help/troubleshooting/#package-sub_bringup-not-found).

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

To pick up every kind of change:

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

**CI** runs the same commands on GitHub's computers for every pull request. `.github/workflows/ci.yml` lists exactly what it does.

## Other names you'll see

| Name                           | What it is                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **rosdep**                     | ROS's usual way to install what `package.xml` lists. pixi does that for us, so skip any step that runs it. [Why](/thalassic/decisions/#1-pixi--robostack-instead-of-apt-ros-rosdep-and-a-venv)                                                                                                                                                                         |
| **ament_vendor**               | Builds a library that isn't a ROS package as if it were one. `stonefish_vendor` uses it to build the simulator. [More](/thalassic/decisions/#2-stonefish-is-built-inside-the-workspace)                                                                                                                                                                                |
| **generate_parameter_library** | Generates the C++ that declares `sub_control`'s parameters, from `src/sub_control_parameters.yaml`                                                                                                                                                                                                                                                                     |
| **gtest, pytest**              | The test frameworks for C++ and Python. `colcon test` runs both                                                                                                                                                                                                                                                                                                        |
| **DDS**                        | What ROS 2 uses to find nodes and send messages, seen in some errors. `ROS_AUTOMATIC_DISCOVERY_RANGE` in `pixi.toml` limits it to your own computer, so two people on the same Wi-Fi don't see each other's simulators. If nodes stop finding each other after a crash, `pixi run reset` clears what was left behind. [DDS discovery](/thalassic/setup/#dds-discovery) |

## Learn more

[Setup and build](/thalassic/setup/) is the full reference, and [Decisions](/thalassic/decisions/) explains why we chose these tools.

Each tool has its own documentation: [colcon](https://colcon.readthedocs.io/), [ament_cmake](https://docs.ros.org/en/jazzy/How-To-Guides/Ament-CMake-Documentation.html), and the [CMake tutorial](https://cmake.org/cmake/help/latest/guide/tutorial/index.html). ROS 2's [Creating a package](https://docs.ros.org/en/jazzy/Tutorials/Beginner-Client-Libraries/Creating-Your-First-ROS2-Package.html) makes a package of each type from scratch. Skip its `rosdep` and `source` steps.
