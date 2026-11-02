---
title: "Deployment"
description: "Provisioning the Jetson AGX Orin, running the stack on the vehicle, updates and rollbacks."
---

The vehicle runs the developers' `pixi` packages plus its GPU stack, in an environment of its own, `jetson`, on bare metal. Every `pixi` command on it names that environment (`-e jetson`). The stack is launched by hand.

[![How code, packages and models reach the vehicle, and what runs on it.](/diagrams/thalassic/deployment.svg)](/diagrams/thalassic/deployment.svg)

Click the diagram to open it full size.

## One-time provisioning

As the vehicle user (`avbotz`, created when the Jetson is flashed):

```bash
git clone --recurse-submodules https://github.com/avbotz/thalassic.git ~/thalassic
cd ~/thalassic
scripts/install.sh           # pixi + the jetson environment (ONNX Runtime on CUDA included) + build
sudo deploy/jetson/setup.sh  # OS configuration, see below; installs chrony, which needs a network once
```

Then reboot, so the new groups apply.

### What `deploy/jetson/setup.sh` does

It installs the files in `deploy/jetson/files/` and the udev rules in `deploy/udev/`, and it is idempotent — re-run it after reflashing or after editing anything in either directory. Every setting it applies survives a reboot. [Vehicle OS configuration](/thalassic/jetson-os/) is the table of what lands where and why; the short version:

| Setting | Why it is not just typed in |
| --- | --- |
| Static `192.168.5.245/24` and MTU 9000 on `end0` (netplan) | The DVL and the camera are pointed at that address, and the interface has to allow jumbo frames for the GigE camera. Both used to be re-applied by hand after every boot |
| `chrony` serving `192.168.5.0/24` | The DVL and the down camera take their time from the Jetson, and `systemd-timesyncd` cannot serve |
| MAXN power mode (systemd unit) | JetPack boots power-capped; `nvpmodel -m 0` by hand does not survive a reflash |
| Fan at full speed (systemd unit) | The hull is sealed; the fan is what carries heat to the wall the water cools. `nvfancontrol` waits for heat before it spins up, so it is disabled |
| 10 MB socket buffers | The GigE camera bursts a frame faster than the default receive buffer holds |
| udev rules, `dialout`/`video` groups | Stable device names and non-root access |

Two things to know:

- **`netplan apply`** runs every time, after `netplan generate` has validated the file in a scratch copy (a rejected file changes nothing, so the vehicle keeps its network). It drops any SSH session over `end0` if the address changes, so run the script from the console after changing the network file.
- **`chrony`** is installed with `apt` the first time the script runs, if it is missing. That one run needs a network; later ones do not.

The FLIR-related steps come from the `spinnaker_camera_driver` README for machines _without_ the Spinnaker SDK installed. The driver builds against an SDK it downloads itself, so no SDK package is installed on the Jetson.

### GenTL producer

The GigE camera is opened through a GenTL producer shipped with the source-built driver. Because the workspace uses `--merge-install`, it ends up at `install/lib/spinnaker-gentl/Spinnaker_GenTL.cti`, and `pixi.toml`'s `[activation.env]` sets `SPINNAKER_GENTL64_CTI` to that path.

### The GPU stack

JetPack 7.2 provides the GPU driver (CUDA 13.2) and nothing else the stack uses. ONNX Runtime's CUDA 13 build and the CUDA 13.4 libraries it depends on (cuDNN, cuBLAS and the runtime) are the `jetson` environment's dependencies in `pixi.toml`, about 1.7 GB to download, so `pixi install --frozen -e jetson` is the whole GPU install and only a `pixi.lock` change can change them ([Decision 5](/thalassic/decisions/#5-the-jetsons-gpu-stack-comes-from-pixi-not-jetpack)). `pixi.toml` declares the Jetson platform with its driver (CUDA 13) and compute capability (8.7), and pixi checks both against the host when it installs, so a JetPack upgrade to a newer CUDA major version means updating that entry. If `pixi install` reports that the host has no `__cuda`, the driver is not visible to pixi: `CONDA_OVERRIDE_CUDA=13.2 CONDA_OVERRIDE_CUDA_ARCH=8.7 pixi install --frozen -e jetson` declares it by hand.

To see what a model runs on, load it with the stack running. The reply names the provider and the time per inference:

```bash
ros2 service call /marlin_v3/sub_vision/load_model sub_vision_interfaces/srv/LoadModel "{task: 'gate'}"
# message: loaded 'gate' (ffc_rs_26) via onnxruntime/cuda (warmup 25.0 ms/iter)
```

The vehicle's launch file sets `device: gpu`, so a GPU that cannot run a model fails this call and says why, rather than leaving the model on the CPU ([`sub_vision`](/thalassic/sub-vision/#model-loading--device-selection)).

## Running

```bash
cd ~/thalassic
pixi run -e jetson up pool_test                     # hardware stack
pixi run -e jetson up pool_test -- mission:=pool_a  # with a mission
pixi shell -e jetson                                # ros2 topic echo ... etc.
```

Nothing drives until the kill switch has been engaged and released _after_ the stack started: if it starts with the switch released, pull the switch and release it again. `sub_control` logs what it is waiting for, and `control/armed` says when it is armed ([Control System](/thalassic/control/#safety)).

### Pool-day checklist

1. On the bench, with the stack running and the vehicle killed: `pixi run -e jetson preflight`. It listens for 5 s and fails on any sensor or controller topic below its rate, a missing kill switch state, an uncalibrated camera, anything in error or stale on `/diagnostics_agg`, or a missing model. Fix what it reports.
1. Tag what is running: `git tag pool-$(date +%F) && git push origin pool-$(date +%F)` (bags record `git describe`, so each bag then names its tag).
1. In the water, killed: check `control/status` in Foxglove: `dvl_ok` once the DVL has bottom lock, `depth_ok`, `imu_ok`.
1. Release the kill switch, watch `armed` come up, and run.

### maritime

The thruster board runs [maritime](https://github.com/avbotz/maritime). `sub_low` needs firmware with protocol 2: older firmware does not understand its `m` thruster lines and has no command watchdog to stop the thrusters when the commands stop. `/diagnostics_agg` shows the protocol the board reports under `sub_low: board`. Build and flash it as maritime's README says (`west build -b rpi_pico`, then `west flash -r uf2`, or copy `build/zephyr/zephyr.uf2` to the board in BOOTSEL mode).

On the vehicle a mission runs under `sub_mission`'s restart supervisor ([Mission System](/thalassic/mission/#restart-supervisor)): pulling the kill switch stops it, and releasing it starts it again from the beginning, so a botched run is rerun by carrying the vehicle back to the start. `restart:=false` runs it once, as the simulator does.

`pixi run -e jetson up pool_test -- record:=true` records the run into `~/thalassic/bags/` ([Recording](/thalassic/recording/)), which grows until it is cleared. To copy the bags to a laptop on the vehicle network:

```bash
rsync -av avbotz@192.168.5.245:thalassic/bags/ bags/
```

## Updating the vehicle

```bash
cd ~/thalassic
git pull --recurse-submodules
pixi install --frozen -e jetson        # only changes anything if pixi.lock changed
pixi run --frozen -e jetson build
pixi run --frozen -e jetson fetch-weights   # downloads only models whose manifest entry changed
```

`--frozen` installs `pixi.lock` as it is: it never re-solves or rewrites the lockfile, even if `pixi.toml` has changed without it, which is what you want on a competition day.

If the pull touched `deploy/`, re-run `sudo deploy/jetson/setup.sh`.

### Updating only the missions

From a laptop on the vehicle network, with the vehicle killed:

```bash
pixi run sync-mission                  # to avbotz@192.168.5.245
pixi run sync-mission user@host        # to another vehicle
```

It runs `sub_mission`'s tests on the laptop, and copies nothing if they fail or if the vehicle's `sub_mission` C++ differs from the laptop's, since the tests would not cover what the vehicle runs. Otherwise it copies `src/sub_mission/resources/` across, deleting any tree that is gone from the laptop. An edited file needs no build, as the install space links to it, and a new file gets a build of `sub_mission` on the vehicle. Under `restart`, the next kill switch release runs the new trees; a stack launched with `restart:=false` has to be relaunched.

### Rolling back

Every pool build is tagged (see the checklist), so going back is checking out the tag that last worked:

```bash
git checkout pool-2026-10-10 && git submodule update --init --recursive
pixi install --frozen -e jetson && pixi run --frozen -e jetson build && pixi run --frozen -e jetson fetch-weights
```

This needs no network if the tag's packages are still in pixi's cache (`~/.cache/rattler`) and its models in `weights/` (`fetch-weights` keeps the replaced file as `.old`). A clean build of the FLIR driver downloads the Spinnaker SDK, so do not `pixi run clean` on the vehicle away from a network.

## Network

See [Networking](/thalassic/networking/) for addresses. The Jetson is `192.168.5.245`, the down camera `192.168.5.249`, the DVL `192.168.5.250`. A laptop plugged into the switch gets a DHCP lease and reaches the ROS graph with:

```bash
ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET pixi shell
```

## Open items

- `deploy/jetson/setup.sh` adds `$USER` to the `dialout` and `video` groups, and under `sudo` that is `root`, not the vehicle user. On a newly flashed Jetson, also run `sudo usermod -aG dialout,video avbotz` and reboot, or the drivers cannot open the serial ports and cameras.
- ONNX Runtime's CUDA provider has not been run on the Orin. Load each model on the bench as in [The GPU stack](#the-gpu-stack) and compare its time per inference with what the missions need; [Decision 5](/thalassic/decisions/#5-the-jetsons-gpu-stack-comes-from-pixi-not-jetpack) has the way out if it fails.
- Camera calibrations are not in the repository: neither camera config sets a `camera_info_url`, so on a vehicle without `~/.ros/camera_info/` files every bearing is 0. `sub_vision` reports it on `/diagnostics` and `preflight` fails on it; calibrate both cameras underwater (`camera_calibration`) and commit the files under `sub_bringup/config/devices/`.
- An offline bundle (a packed environment and built `install/`) for updating the vehicle without the internet.
