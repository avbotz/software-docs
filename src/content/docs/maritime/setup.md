---
title: "Setup and build"
description: "Installing the Zephyr workspace, building, flashing the board, formatting, and CI."
---

maritime is a Zephyr application in a [T2 workspace](https://docs.zephyrproject.org/latest/develop/west/workspaces.html): the repository is the west manifest, and west checks Zephyr out next to it. The only board is `rpi_pico`.

## Prerequisites

The installer uses `apt`: Ubuntu or Debian, on x86_64 or aarch64.

## First-time setup

In the directory that should hold the workspace (do not clone the repository: the installer does):

```sh
curl -sSL https://raw.githubusercontent.com/avbotz/maritime/refs/heads/main/install.sh | bash
```

`install.sh`:

1. Installs the build tools with `apt` (CMake, Ninja, the device tree compiler, clang-format, Node and npm, …).
1. Creates `maritime-workspace/`, with a Python virtual environment in `maritime-workspace/.venv`, and clones maritime into it.
1. Installs west, then runs `west init -l .` and `west update`, which check out Zephyr at the revision `west.yml` pins, and only the modules an RP2040 build uses.
1. Installs Zephyr's Python packages (`west packages pip --install`), and the Zephyr SDK's Arm toolchain only (`west sdk install -t arm-zephyr-eabi`).
1. Installs `dts-linter`, at the version Zephyr pins, for `format.sh`.
1. Installs a git pre-commit hook that runs `./format.sh --check`.

The workspace it leaves:

```
maritime-workspace/
├── .venv/        # Python, with west and pyserial
├── .west/        # west's configuration
├── zephyr/       # Zephyr, at the revision west.yml pins
├── modules/      # cmsis_6, hal_rpi_pico
└── maritime/     # this repository
```

## Building

In every new terminal, from `maritime/`:

```sh
source ./setup.sh   # activates ../.venv
```

Then:

```sh
west build -b rpi_pico
```

The firmware is `build/zephyr/zephyr.uf2`. `CMakeLists.txt` builds every `src/*.c`, so a new source file needs no change to it.

### Debug build

```sh
west build -b rpi_pico -- -DEXTRA_CONF_FILE=debug.conf
```

`debug.conf` turns logging on. The logs go over the same USB link as the protocol, between frames: `maritime.py` prints them as `board: ...` lines, but thalassic's `sub_low` does not expect them, so never run a debug build on the vehicle ([Logging](/maritime/firmware/#logging)). Build from scratch (`west build -p -b rpi_pico`) when switching between a debug build and a normal one.

## Flashing

The RP2040 is flashed from its UF2 bootloader, in its boot ROM, where it shows up as a USB drive named `RPI-RP2`. To get the board there:

- With maritime running: `./maritime.py bootloader`. It stops the thrusters, then reboots the board into the bootloader.
- Otherwise: unplug the board, then hold its BOOTSEL button while plugging it back in.

Then:

```sh
west flash -r uf2
```

which copies `build/zephyr/zephyr.uf2` to the drive. Copying the file to the drive by hand does the same. The board reboots into the new firmware once the copy finishes, and starts killed: cycle the kill switch before it will drive the thrusters ([Kill switch](/maritime/firmware/#kill-switch)).

Without a desktop to mount the drive (on the Jetson, say), `./mount_pico.sh` mounts it at `/mnt/rpi_pico`, where `west flash -r uf2` finds it.

## Formatting

```sh
./format.sh           # format C and devicetree, and report checkpatch issues
./format.sh --check   # change nothing, and fail if anything needs fixing
```

`format.sh` formats C with clang-format (`.clang-format`, Zephyr's style) and devicetree with `dts-linter`, then checks the C with Zephyr's `checkpatch.pl` (settings in `.checkpatch.conf`). Checkpatch's issues, such as `//` comments, have to be fixed by hand.

The pre-commit hook runs `./format.sh --check`; `git commit --no-verify` skips it. For a clone made before the installer added the hook:

```sh
npm --prefix ../zephyr/scripts/ci ci
printf '#!/bin/sh\nexec ./format.sh --check\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Job      | Does                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `format` | `./format.sh --check`, with clang-format pinned to one version, since its output differs between versions                                |
| `build`  | `west build -b rpi_pico`, and uploads `zephyr.uf2` as the run's `maritime-rpi_pico` artifact: a board can be flashed without a toolchain |
