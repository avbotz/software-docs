---
title: "Decisions"
description: "Short records of the decisions in this repository, and why they were made."
---

Each decision about the [thalassic](https://github.com/avbotz/thalassic) repository records what it replaced (**Was**), what is there now (**Now**), and why.

## 1. pixi + RoboStack instead of apt ROS, rosdep, and a venv

**Was:** `install.sh` installed `ros-jazzy-desktop` from apt at whatever version was newest that day, built Stonefish into `/usr/local` with `sudo`, downloaded the Spinnaker SDK from a Google Drive link, and pip-installed three unlisted packages into a `--system-site-packages` venv; the Dockerfile repeated a different subset by hand. Two machines set up a week apart had different simulators, `torch` builds and ROS patch versions.

**Now:** `pixi.toml` declares every dependency (ROS 2 from the `robostack-jazzy` channel, compilers, PCL, SDL2, ONNX Runtime, and so on) and `pixi.lock` pins exact builds for `linux-64` and `linux-aarch64`. `pixi install --frozen` reproduces the environment bit for bit, without `sudo`, on any Linux distribution and the Jetson.

**Why pixi:**

- One lockfile covers conda and PyPI packages, native libraries, and the compiler, which `requirements.txt` + `rosdep` never could.
- Nothing global. Different checkouts (branches, older releases) coexist with different dependency sets.
- RoboStack itself recommends pixi, and packaged every ROS package we use except `rtabmap` and the submodules of decision 3.
- The same manifest serves developers, CI, and the vehicle, so "works on my machine" differences shrink to hardware.

**Why not nix:** it is more reproducible, but much harder to configure, especially on the Jetson, which would probably need NixOS.

## 2. Stonefish is built inside the workspace

**Was:** a global `/usr/local` build from a branch tip, installed with `sudo` by `install.sh` or baked into the Docker image. Trying another Stonefish version meant overwriting every machine's global install, and `stonefish_ros2` demands an exact library version, so mismatches failed at configure time.

**Now:** `src/sub_sim/stonefish_vendor` is an `ament_vendor` package that builds the git submodule `stonefish_vendor/stonefish` (AVBotz fork, pinned by commit) and installs it under `install/opt/stonefish_vendor`. It also installs a forwarding `StonefishConfig.cmake` at `install/share/Stonefish/cmake`, so `find_package(Stonefish)` in `stonefish_ros2` resolves from the workspace prefix alone; relying on the vendor package's environment hook to add `opt/stonefish_vendor` to `CMAKE_PREFIX_PATH` left CI unable to find Stonefish. Switching versions is `git checkout` in the submodule plus a rebuild of two packages, and the submodule pointer in git records exactly which simulator every commit was tested with.

**Submodule fixes go in `colcon.meta` first and upstream second,** so the workspace never depends on a patched checkout:

- `stonefish_ros2` depends on `stonefish_vendor`. The submodule's own `package.xml` cannot know about our vendor package, and colcon needs the edge to order the build.
- `libwaterlinked` gets `-pthread`. It uses `std::thread` without linking pthread, which passes on hosts whose glibc merged libpthread but not against conda-forge's glibc 2.28 sysroot.
- The FLIR driver gets an implicit `<cstdint>` include, because its headers rely on a transitive include that GCC 15 dropped and the package builds with `-Werror`.
- The FLIR driver also gets `--allow-shlib-undefined`, because the prebuilt Spinnaker library it downloads references glibc 2.34+ symbols that the conda sysroot cannot verify at link time. They resolve against the host's glibc at runtime, as on any apt-based install.

## 3. DDS discovery is limited per developer

**Was:** default Fast DDS settings. Anyone running the simulator on the same network as another developer saw both `/marlin_v2` graphs, and stale shared-memory segments after crashes produced the `rmw_create_node` error the old README worked around with `pkill -f ros`.

**Now:** `pixi.toml`'s `[activation.env]` sets the discovery range per environment. `default` restricts discovery to localhost, so the network does not leak graphs; a laptop plugged into the sub opts out with `ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET pixi shell`. `jetson` uses subnet discovery. `pixi run reset` clears leftover shared memory.

The middleware is pinned to `rmw_fastrtps_cpp` in both, so all machines behave the same. Switching to CycloneDDS is a one-line change.

## 4. The Jetson's GPU stack comes from pixi, not JetPack

**Was:** TensorRT's Python bindings existed only in JetPack's system interpreter, and conda-forge's `linux-aarch64` PyTorch had no build for the Orin's `sm_87` GPU, so `deploy/jetson/link_jetpack_python.sh` wrote a `.pth` file that let the environment import JetPack's `tensorrt` and `cuda` modules. That tied `pixi.toml` to the Jetson's Python minor version and left the GPU stack outside the lockfile. TensorRT later came from the isaac-forge channel, with engines built from the ONNX files on the vehicle; that channel's only Python build, 3.12, pinned the workspace's.

**Now:** the Jetson runs the ONNX files through the same runtime as every other machine: ONNX Runtime, on its CUDA execution provider, from conda-forge's CUDA 13 build in the `jetson` pixi environment ([The GPU stack](/thalassic/deployment/#the-gpu-stack)). JetPack 7.2 moved the Orin onto the unified CUDA 13 Arm toolkit, so plain `linux-aarch64` CUDA packages run on it, and JetPack provides only the driver. Nothing is built from the models. `jetson` is an environment rather than a platform entry of the default one because the vehicle also leaves out the simulator and the developer tools; the default environment's `linux-aarch64` entry covers every other Arm machine, on the CPU.

**Why this build:** neither conda-forge's ONNX Runtime nor PyPI's has `sm_87` kernels, but conda-forge's has `sm_80` ones, as do the cuDNN and cuBLAS it depends on, and [code compiled for `sm_80` runs on every 8.x GPU](https://docs.nvidia.com/cuda/cuda-compiler-driver-nvcc/index.html); a [forum reply on NVIDIA's own board](https://forums.developer.nvidia.com/t/orin-agx-jp-7-2-pytorch-and-sm-87-support/378368) says the same of the Orin under JetPack 7.2, about a PyTorch wheel. PyPI's `onnxruntime-gpu` starts at `sm_89` on `linux-aarch64`, which the Orin cannot run. The package's CUDA libraries are 13.4 over JetPack's 13.2 driver, which [minor version compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html) allows from driver 580 on.

**Not yet proven:** only the listings above have been checked; nobody has run this build on the Orin ([Deployment](/thalassic/deployment/#open-items)). If its `sm_80` kernels fail there, `sub_vision` says so when it loads a model, and the way out is ONNX Runtime built from source with `CMAKE_CUDA_ARCHITECTURES=87`, [reported to take about four hours on an Orin Nano](https://github.com/straga/jetson-jp7-onnxruntime).

**Cost:** TensorRT engines ran in FP16, compiled for the one GPU. ONNX Runtime runs the models as exported, in FP32, so they may be slower; that has not been measured either.

**Not done:** CUDA is the only GPU provider packaged; an x86 laptop with an NVIDIA GPU gets its CUDA 12 build ([GPU inference](/thalassic/setup/#gpu-inference)). `sub_vision` uses any other provider the installed build has. Python stays pinned to 3.12 because raising it moves ROS to RoboStack's Python 3.14 rebuild, which is its own change.

## 5. Hardware identity lives in a vehicle description

**Was:** the down camera's serial number, `/dev/maritime`, `/dev/naviguider_imu`, every mounting offset, and all eight thruster poses were Python literals in `marlin_v2_launch.py` and `pool_test_launch.py`. Swapping a camera meant editing a launch file; the frame id `marlin_v2/imu_link` was hardcoded in one place while the node beside it built the same string from `robot_name`.

**Now:** `sub_bringup/config/vehicles/<robot_name>.yaml` holds everything that is a property of the physical hull, and the launch files read it through `sub_bringup.vehicle`. `description_launch.py` publishes its `transforms`, `thrusters` and each device's `mount` as static transforms (one `static_transforms` node); the hardware launch file reads each device's address (serial port, video device, camera serial, IP) and frame from its `devices` entry. Node _tuning_ — controller gains, EKF configuration, camera exposure — is not vehicle identity and stays in its own file next to it.

Rotations in that file are degrees: `pitch: -90` is exact and readable where `-math.pi / 2` needed the launch file to import `math`.

**Thrusters too:** the thruster poses used to be copied into the Stonefish scenario template and a compile-time table in `sub_control`. Now `sim_launch.py` renders the simulated thrusters from the description and the launch files pass the layout to `sub_control` as parameters (`Vehicle.thruster_layout()`), so all three read the one block. The copies had diverged: the allocator's had hand-edited offsets (horizontal z zeroed, a stray `+0.08` in the verticals' roll), the description's frames pointed the other way, and none recorded which thrusters have left-hand propellers, which the allocator needs to command them correctly.

## 6. Vehicle OS configuration is files in the repository

**Was:** the static address, the NTP server, and the camera interface MTU were typed into the Jetson by hand. `deploy/jetson/setup.sh` wrote the rest from heredocs, so the only way to see what the vehicle ran was to read a shell script, and the MTU had to be re-applied after every boot by a second script.

**Now:** everything installed on the vehicle is a file in `deploy/jetson/files/`, and `setup.sh` is a list of `install` commands ([What `deploy/jetson/setup.sh` does](/thalassic/deployment/#what-deployjetsonsetupsh-does)). The address and MTU are a netplan file, so they survive a reboot.

**Why not a configuration management tool** (Ansible, salt): the fleet is one Jetson, reachable over one cable, and the failure mode that matters is a change made at a competition at 2 a.m. `install`ing eleven files is inspectable by anyone on the team without learning anything new.

**The fan is pinned at full speed** rather than handed to `nvfancontrol`. Every profile that daemon ships is a temperature curve, so the airflow starts _after_ the heat does. In the sealed hull the fan is the only thing moving heat from the SoC to the water-cooled wall, and the noise bothers nobody. `nvfancontrol` is disabled rather than reconfigured, because otherwise it would wind the PWM back down. `jetson_clocks` stays off: DVFS is still the SoC's only way to back off if the fan is not enough.

**Not files:** the `avbotz` user is created when the Jetson is flashed, and `setup.sh` installs `chrony` with `apt` if it is missing.

## 7. Model-based control with a trajectory generator, not a deeper cascade or MPC

**Was:** four banks of per-axis PIDs (position → velocity → force, attitude → rate → torque) acting on raw step setpoints, with a feedforward model whose terms were all zero, and one `velocity` flag per topic switching all three translational (or rotational) axes between position and velocity control at once.

**Now:** Bumblebee's structure (NUS, RoboSub 2025 champion): a jerk-limited trajectory generator per axis, a control law that feeds forward a vehicle model and closes the loop with PID in accelerations, and a QP thrust allocator whose achieved wrench feeds the integrators' anti-windup, with a mode per axis ([Control system](/thalassic/control/)).

**Why not LQR or MPC:** they need a better model than a student team keeps current on a hull that changes every season, and other teams who tried them went back (ARVP dropped LQR in 2023; Tartan's MPC never left simulation; Brasília dropped computed torque as too sensitive to model error). Here the model is only feedforward, so a wrong one costs performance, not stability, and an LQR is still useful to _design_ the gains from an identified model.

**Why not keep the cascade:** the gains in a model-based law are the same accelerations on every axis whatever the vehicle weighs, the trajectory generator gives the controller acceleration to feed forward (step setpoints have none), and saturation is handled where it happens (the allocator) rather than by per-PID output clamps that do not know the thrusters' limits.

## 8. One node publishes the vehicle's static transforms

**Was:** `description_launch.py` started a `static_transform_publisher` process per transform in the vehicle description, twenty of them.

**Now:** one `sub_bringup` `static_transforms` node publishes them all in one latched `/tf_static` message.

**Why:** each process is a DDS participant, and with `ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST` Fast DDS announces a participant only to the first 32 on the machine. The sim had reached 33 processes with the annotators, so two late participants could miss each other: runs where the mission never heard `sub_vision` and searched forever, intermittently. The stack is now 15 processes, the diagnostics aggregator included.

## 9. Safety is layered through the nodes that already own the vehicle, not a supervisor node

**Was:** `sub_control` cut thrust without odometry and dropped axes without their sensors, judging freshness by arrival time, and `sub_low` stopped the thrusters if `sub_control` went quiet. Nothing else: an IMU that stopped went unnoticed (the EKF's predicted attitude kept being flown), a mission move could "arrive" on a `control/error` computed before its command applied, maritime kept its last thruster command forever if the host stopped talking, a stack started with the kill switch released drove at once, and only `sub_vision` published `/diagnostics`, which nothing read.

**Now:** each layer stops the thrusters on what it can see, and each layer below catches the one above dying ([Control system](/thalassic/control/#safety)):

- `sub_control` arms only after the kill switch has been engaged since it started and with the state estimate, IMU and depth fresh; cuts thrust without odometry or IMU; judges every sensor by its stamp; and acknowledges each `MotionSetpoint` by `id` in `control/error`.
- `sub_low` (and `sim_thrusters`) stops the thrusters when `sub_control` goes quiet or its commands arrive stale, and reopens a dropped link.
- The board stops them after 0.5 s without a command, resets on a stalled main loop, and stays killed after any reset until the switch is cycled.
- `diagnostic_updater` in every driver and `sub_control`, `diagnostic_aggregator` over them (stale when a node dies), and `preflight` reading the result.

**Not covered:** a velocity the mission latched runs on if the mission process dies without sending its stop (a crash, `SIGKILL`) or hangs, until the kill switch.

**Why not a separate supervisor node** (COLA2's `safety_supervisor`, the 2026-10-10 report's `sub_safety`): every action it could take on this vehicle (hold, float up, thrust off) goes through `sub_control` anyway, and a node in between is one more process to keep alive and one more place for the two to disagree. The checks are pure functions with unit tests (`sub_control/safety.hpp`), and the headless simulator test exercises them end to end. Revisit when there is hardware to supervise that `sub_control` does not own: battery, leak and temperature sensing.

**Why not a `Move` action for the mission:** the acknowledgment closes the race that made polling wrong, with a two-line change to how the mission counts errors, where an action would rewrite every movement node.
