---
title: "Setup and build"
description: "The pixi workflow, tests and CI, DDS discovery, GPUs, launch arguments and the workspace layout."
---

Thalassic uses [pixi](https://pixi.sh) with the [RoboStack](https://robostack.github.io) channel. `pixi.toml` and its lockfile `pixi.lock` describe ROS 2 Jazzy, the compilers, native libraries and Python packages for every platform we run on.

## Prerequisites

| Platform                         | Notes                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Ubuntu / any Linux (x86_64)      | Stonefish needs OpenGL 4.3 (Mesa or NVIDIA drivers on the host).                            |
| Jetson AGX Orin (aarch64)        | The `jetson` environment. Vehicle-only OS setup is in [Deployment](/thalassic/deployment/). |
| Any other Linux on Arm (aarch64) | Vision runs on the CPU. Stonefish needs OpenGL 4.3.                                         |
| Windows / macOS                  | Not supported: there is no container. Use a Linux machine or VM.                            |

Outside pixi, the workspace uses only the host's `lsb_release`, `dpkg` and `git`, which the FLIR driver unpacks its SDK with at build time.

**Do not install or source an apt ROS 2 on a machine that uses this workspace.** pixi provides ROS 2 and sets up its paths.

## First-time setup

```bash
git clone --recurse-submodules https://github.com/avbotz/thalassic.git
cd thalassic
scripts/install.sh
```

`install.sh` installs pixi to `~/.pixi/bin` if it is missing (add that directory to your `PATH`), fetches the submodules, runs `pixi install --frozen` to materialise `pixi.lock` into `.pixi/envs/default` (on a Jetson, `-e jetson` into `.pixi/envs/jetson`), installs the [git hooks](#git-hooks), runs the first `colcon build`, and downloads the model weights ([Model weights](/thalassic/vision/#model-weights)). The first run downloads several GB; pixi caches packages in `~/.cache/rattler` for later workspaces.

## Everyday workflow

Every `pixi run` and `pixi shell` activates the environment:

1. `scripts/setup.sh` sources the `install/setup.*` overlay for your shell once the workspace has been built.
1. `pixi.toml`'s `[activation.env]` tables set the [DDS discovery range](#dds-discovery), point the FLIR driver at its GenTL producer, and set `SDL_VIDEODRIVER=x11`, so Stonefish's window keeps its title bar under Wayland.

Do not source `scripts/setup.sh` by hand: it needs the pixi environment around it (the ROS underlay's hooks expand `$CONDA_PREFIX`).

```bash
pixi run build                        # colcon build (colcon_defaults.yaml applies)
pixi run build --packages-select sub_control
pixi run fetch-weights                # after a pull that changed weights/manifest.toml
pixi run up                           # ros2 launch sub_bringup sim_launch.py
pixi run up -- seed:=42 DX:=0.0 mission:=pid_tuning
pixi shell                            # then use ros2 / colcon / rviz2 directly
pixi run test
pixi run clean
```

`pixi run up` takes the first word of the launch file's name, `sim` by default (`pixi run up pool_test` is `pool_test_launch.py`), and launch arguments after a `--`. Without the `--`, pixi reads the first argument as that word: `file 'seed:=42_launch.py' was not found`.

`colcon_defaults.yaml` sets `--symlink-install` (Python edits take effect without rebuilding), `--merge-install` (a single `install/` tree), compile commands for clangd, and the RoboStack-recommended flags that make CMake find the environment's Python rather than the system one.

### Shell completion

`pixi shell` starts your own shell (`bash` or `zsh`) with the environment exported. For `colcon` and `ros2` tab completion inside it:

```bash
source $CONDA_PREFIX/share/colcon_argcomplete/hook/colcon-argcomplete.zsh   # or .bash
```

### Editors

`pyrightconfig.json` points at the environment's `site-packages`; `compile_commands.json` lands in `build/`. VS Code users can install the `prefix-dev.pixi-vscode` extension or select `.pixi/envs/default/bin/python` as the interpreter.

clangd also needs `--query-driver=**/.pixi/envs/*/bin/*`: the pixi compiler searches `.pixi/envs/default/include` implicitly, so CMake leaves it out of `compile_commands.json`, and without the flag clangd cannot find the headers there (`fmt/core.h` from generated parameter headers, `behaviortree_cpp/`, `nlohmann/json.hpp`). Add it to `clangd.arguments` in VS Code or `lsp.clangd.binary.arguments` in Zed.

## Launch arguments

Both `sim_launch.py` and `pool_test_launch.py` take:

| Argument               | Default     | Description                                                                                                                                                                                                                           |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robot_name`           | `marlin_v3` | Selects `config/vehicles/<robot_name>.yaml`                                                                                                                                                                                           |
| `mission`              | `""`        | Mission to run; empty skips `sub_mission`                                                                                                                                                                                             |
| `role`                 | `SURVEY`    | The mission's vision model role: `SURVEY` or `SEARCH`                                                                                                                                                                                 |
| `groot_port`           | `5555`      | Port of the mission's Groot2 live view, which takes the next port too; `0` turns it off ([Mission system](/thalassic/mission/#live-monitoring-groot2))                                                                                |
| `restart`              | per stack   | Run the mission under `sub_mission`'s restart supervisor, which reruns it from the beginning at each kill-switch release ([Mission system](/thalassic/mission/#restart-supervisor)) — `true` on the vehicle, `false` in the simulator |
| `gains`                | per stack   | Control profile (gains, vehicle model, trajectory limits) in `sub_bringup/config` — `control/gains.yaml` on the vehicle, `control/gains_sim.yaml` in the simulator                                                                    |
| `foxglove_port`        | `8765`      | Websocket port for the Foxglove bridge                                                                                                                                                                                                |
| `foxglove_compression` | per stack   | Deflate the bridge's messages — `true` on the vehicle, for a laptop on its network; `false` in the simulator, where Foxglove connects over localhost and compression only adds latency                                                |
| `use_sim_time`         | per stack   | Run every node on the simulator's `/clock` — `false` on the vehicle, `true` in the simulator                                                                                                                                          |

`record`, `bag_dir` and `jpeg_quality` are in [Recording](/thalassic/recording/).

### Simulation only

| Argument              | Default       | Description                                                                                                                                                                                     |
| --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed`                | `""` (random) | Integer seed for scenario randomization                                                                                                                                                         |
| `DX`                  | `0.25`        | Max X position fuzz of task objects (m)                                                                                                                                                         |
| `DY`                  | `0.25`        | Max Y position fuzz (m)                                                                                                                                                                         |
| `DZ`                  | `0.10`        | Max Z position fuzz (m)                                                                                                                                                                         |
| `DYAW`                | `0.10`        | Max yaw fuzz (rad)                                                                                                                                                                              |
| `segmentation_camera` | `false`       | Add the segmentation camera, whose images the bag records as training labels for remora ([Simulation](/thalassic/simulation/#cameras))                                                          |
| `depth_camera`        | `false`       | Add the simulated depth camera                                                                                                                                                                  |
| `vision_depth`        | `false`       | Run Depth Anything on the front camera beside the detector and publish its maps (`sub_vision/depth`, `sub_vision/depth/color`); each run delays that frame's detections, about 0.4 s on an iGPU |

`course`, `sensor_noise`, `window_width`, `window_height` and `rendering_quality` are in [Simulation](/thalassic/simulation/#simulation-settings).

`role`, `course` and `rendering_quality` refuse values outside their choices. Boolean arguments take `true`/`false` or `1`/`0`.

`ros2 launch sub_bringup sim_launch.py --show-args` prints the live list.

## Launch files

Four files, layered so the two stacks cannot drift apart:

| File                    | Runs                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `common_launch.py`      | Everything both stacks run identically: the transforms, the EKF, `sub_control`, the mission executive, the Foxglove bridge |
| `description_launch.py` | The vehicle's static transforms, from `config/vehicles/<robot_name>.yaml`. Included by `common_launch.py`                  |
| `pool_test_launch.py`   | `common_launch.py` + the hardware drivers, the two cameras, and a `sub_vision` node per camera                             |
| `sim_launch.py`         | `common_launch.py` + Stonefish, the sensor bridges, `robot_state_publisher`, and a `sub_vision` node per camera            |

The two top-level files differ only in where sensor data comes from and in their defaults for `gains`, `restart`, `foxglove_compression` and `use_sim_time`. Everything downstream is in `common_launch.py`, so a node added there runs in both. An include inherits launch configurations, so an argument set on the command line or defaulted by the parent reaches the nodes inside without being passed through.

`common_launch.py` can also run on its own, against a stack whose drivers are already running, to restart the controller and the mission executive without re-enumerating the cameras:

```bash
ros2 launch sub_bringup common_launch.py mission:=pool_a restart:=true
```

Run alone, it defaults to the vehicle's `gains` with `restart:=false`, so pass what the top-level file would: against the simulator, `gains:=control/gains_sim.yaml use_sim_time:=true foxglove_compression:=false`. Its `record` does nothing; the top-level files start the recorder.

A node started by hand needs the stack's namespace:

```bash
ros2 run sub_mission restart --ros-args -r __ns:=/marlin_v3 -p mission:=pid_tuning
```

## The vehicle description

Properties of the physical hull (mounting offsets, thruster geometry, the serial number of the down camera, the udev names of the serial devices) live in `src/sub_bringup/config/vehicles/<robot_name>.yaml`, not in a launch file. `description_launch.py` publishes its transforms from one `static_transforms` node; `sim_launch.py` and `pool_test_launch.py` read the rest.

Node tuning (control gains, EKF configuration, camera exposure) stays in its own config files beside it.

## Formatting and linting

```bash
pixi run format     # rewrite every file this repo owns
pixi run lint       # check only; non-zero exit if anything is off
```

One tool per language, each pinned in `pixi.lock` so a rebuild never reformats the tree under someone:

| Language                      | Tool                        | Config                                        |
| ----------------------------- | --------------------------- | --------------------------------------------- |
| Python                        | `ruff` (formatter + linter) | `ruff.toml` — 100 columns, `py312`            |
| C / C++                       | `clang-format`              | `.clang-format` — 4-space indent, 120 columns |
| Shell (`scripts/`, `deploy/`) | `shfmt`                     | `.editorconfig` — 2-space indent              |

`scripts/format.sh` builds its file list with `git ls-files`, which lists submodule directories but not their contents, so upstream code under `src/sub_sim/stonefish_ros2`, `src/sub_sim/stonefish_vendor/stonefish`, `src/sub_drivers/flir_camera_driver` and `src/sub_drivers/waterlinked_dvl` is never reformatted.

To keep a hand-aligned block, such as a lookup table, wrap it in `// clang-format off` / `// clang-format on`.

Packages have no `ament_lint_auto` blocks, so `colcon test` (`pixi run test`) runs tests, not a second, contradictory style check.

### Git hooks

[pre-commit](https://pre-commit.com) runs the checks of `pixi run lint` on each commit's files, with the same tools from `pixi.lock` (`.pre-commit-config.yaml`), so a file they pass also passes CI's lint step. They only check; when one fails, run `pixi run format`, `git add` what it changed, and commit again.

`install.sh` installs the hooks. In a clone from before they existed, run `pixi run pre-commit install` once.

The hooks use the environment as it is (`pixi run --as-is`), so a commit never installs anything, and a checkout with no `.pixi/envs/default` has to run `pixi install` before it can commit. The Jetson has no default environment and `install.sh` leaves its hooks out, so a commit made on the vehicle is not held up over formatting; CI checks it once it is pushed.

`git commit --no-verify` skips the hooks. `pixi run pre-commit run --all-files` runs them on every tracked file.

## Tests and CI

`pixi run test` runs every package's tests and exits non-zero if any fails; `pixi run colcon test-result --verbose` then shows which. They include unit tests of the controller, the mission nodes, the serial drivers (against a pretend board on a pseudo-terminal), scenario generation, and one run of the whole stack against the headless simulator ([Simulation](/thalassic/simulation/#regression-test)), which takes a minute or two. `colcon test --packages-select <pkg>` runs one package's.

pytest is pinned below 9 in `pixi.toml`: Jazzy's `launch_testing` plugins do not load under pytest 9.

On every pull request and push to `main`, `.github/workflows/ci.yml` runs `pixi run format --check` (the same check as `pixi run lint`), `pixi run build` and `pixi run test` in the `default` environment, from `pixi.lock` (`--frozen`), on Ubuntu 24.04 and 26.04, each on x86 and Arm. Compiles go through ccache, one cache per runner; the `ccache stats` step shows how many it reused. Make its four `build-and-test` checks and one approving review required for `main` (repository settings, Branches, branch protection).

## DDS discovery

`pixi.toml`'s `[activation.env]` tables set how far ROS 2 looks for other nodes:

| Environment | Where          | `ROS_AUTOMATIC_DISCOVERY_RANGE`                        |
| ----------- | -------------- | ------------------------------------------------------ |
| `default`   | laptops and CI | `LOCALHOST`, unless it is already set when pixi starts |
| `jetson`    | the vehicle    | `SUBNET`                                               |

Both pin `RMW_IMPLEMENTATION=rmw_fastrtps_cpp` so every machine runs the same middleware.

With localhost-only discovery, two developers on the same Wi-Fi never see each other's `/marlin_v3` graph. Foxglove is unaffected: it connects to the bridge over a websocket, not DDS. Two users on one machine do share a graph; give one of them another domain, e.g. `ROS_DOMAIN_ID=177 pixi run up`, in every terminal.

To talk to the sub from a laptop:

```bash
ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET pixi shell
ros2 topic list
```

If nodes stop discovering each other after a crash, Fast DDS may have left shared-memory segments behind: `pixi run reset` clears them. A crashed simulator leaves 64 MB, its camera images ([Simulation](/thalassic/simulation/#performance)).

## GPU inference

`pixi.toml` defines two environments. Each installs the first of its platform entries the machine satisfies, and each entry is solved separately, so a developer switching machines rebuilds the workspace rather than copying `install/` across.

- **`default`**, every machine but the vehicle:
  - `linux-64-cuda`: x86 with an NVIDIA GPU whose driver supports CUDA 12 or newer. ONNX Runtime has the CUDA provider and `device: auto` uses it.
  - `linux-64`: every other x86 machine, including CI's. ONNX Runtime's CPU build.
  - `linux-aarch64`: every Arm machine, including CI's. ONNX Runtime's CPU build, so an NVIDIA GPU in one goes unused.
- **`jetson`**, the vehicle: the same packages without the simulator and the developer tools, with ONNX Runtime's CUDA 13 build and the CUDA 13.4 libraries from conda-forge; JetPack only has to provide the driver ([Deployment](/thalassic/deployment/#the-gpu-stack)). Every command on the vehicle names it (`pixi run -e jetson <task>`, `pixi shell -e jetson`); `scripts/setup.sh` warns when a Jetson activates the default environment instead, because both build into the same `build/` and `install/`.

`sub_vision` tries the GPU providers the installed build has, then the CPU ([Device selection](/thalassic/vision/#device-selection)).

## Stonefish

The simulator library is built inside the workspace by the `stonefish_vendor` package from the git submodule at `src/sub_sim/stonefish_vendor/stonefish` (AVBotz fork, branch `claude-extra-features`). It installs to `install/opt/stonefish_vendor` and registers a forwarding `StonefishConfig.cmake` under `install/share/Stonefish/cmake`, so `stonefish_ros2` finds it through the workspace prefix with no environment hook.

Remove any global Stonefish install. To test another Stonefish version:

```bash
git -C src/sub_sim/stonefish_vendor/stonefish fetch
git -C src/sub_sim/stonefish_vendor/stonefish checkout <branch-or-commit>
pixi run build --packages-select stonefish_vendor stonefish_ros2
```

Commit the submodule pointer when the version should become the team default.

## Updating dependencies

```bash
pixi add ros-jazzy-<package>          # adds to pixi.toml and re-locks
pixi update                           # refresh every pin in pixi.lock
```

Commit `pixi.toml` and `pixi.lock` together. `install.sh` and the Jetson use `--frozen`, which installs `pixi.lock` as it is, without checking it against `pixi.toml`, so a manifest change that was not re-locked does not reach them.

Packages RoboStack does not have are built from source as submodules under `src/`: `stonefish_ros2`, `waterlinked_dvl`, `flir_camera_driver` (which downloads the Spinnaker SDK during its build), and Stonefish itself.

## Workspace layout

```
thalassic/
├── pixi.toml / pixi.lock   # the environment: ROS 2, compilers, libraries, Python
├── colcon_defaults.yaml    # colcon flags
├── colcon.meta             # build order and flags for submodules we cannot edit
├── scripts/
│   ├── install.sh          # first-time setup
│   ├── setup.sh            # pixi activation: sources the workspace overlay
│   ├── format.sh           # pixi run format / lint
│   ├── fetch_weights.py    # pixi run fetch-weights
│   ├── sync-mission.sh     # pixi run sync-mission
│   └── prune-symlinks.sh   # removes dangling symlinks; pixi run build runs it first
├── deploy/jetson/          # vehicle-only OS configuration
├── deploy/udev/            # device rules (installed on the Jetson)
├── src/                    # ROS 2 packages + submodules
└── build/ install/ log/    # colcon output (gitignored)
```
