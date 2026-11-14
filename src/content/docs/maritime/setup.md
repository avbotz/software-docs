---
title: "Setup and build"
description: "Installing the Zephyr workspace, building, flashing the board, formatting, and CI."
---

maritime is a Zephyr application in a [T2 workspace](https://docs.zephyrproject.org/latest/develop/west/workspaces.html#t2-star-topology-application-is-the-manifest-repository).

The repository is the west manifest, and west checks Zephyr out at a specified version next to it. Read the [workspaces documentation](https://docs.zephyrproject.org/latest/develop/west/workspaces.html) for more information.

The only board currently supported is `rpi_pico`.

## Prerequisites

The installer is written for Ubuntu on x86_64 or aarch64. Debian should also be supported, as it also uses `apt`, but it has not been tested. The installer does not currently support other Linux distributions, Windows, or macOS.

## First-time setup

In the directory that should hold the workspace (do not clone the repository, the installer does):

```sh
curl -sSL https://raw.githubusercontent.com/avbotz/maritime/refs/heads/main/install.sh | bash
```

`install.sh`:

1. Installs the build tools and other necessary utils with `apt`.
1. Creates `maritime-workspace/`, with a Python virtual environment in `maritime-workspace/.venv`, and clones maritime into it.
1. Installs west, then runs `west init -l .` and `west update`, which check out Zephyr at the revision `west.yml` pins and downloads the modules the RP2040 build uses.
1. Installs Zephyr's Python packages (`west packages pip --install`), and the Zephyr SDK's Arm toolchain (`west sdk install -t arm-zephyr-eabi`).
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

The built firmware is located in `build/zephyr`, specifically `build/zephyr/zephyr.uf2`.

### Debug build

```sh
west build -b rpi_pico -- -DEXTRA_CONF_FILE=debug.conf
```

`debug.conf` turns logging on. The logs are sent over the same USB link as the protocol, between frames. `maritime.py` prints them as `board: ...` lines, but thalassic's `sub_low` does not expect them, so don't run a debug build with thalassic ([Logging](/maritime/firmware/#logging)). Build from scratch (`west build -p -b rpi_pico`) when switching between a debug build and a normal one.

## Flashing

The RP2040 is flashed from its UF2 bootloader, in its boot ROM, where it shows up as a USB drive named `RPI-RP2`. To put the board in this mode:

- With maritime running, run `./maritime.py bootloader`. This command reboots the board into the bootloader.
- Or, unplug the board, then hold its BOOTSEL button while plugging it back in, then release the BOOTSEL button.

Then:

```sh
west flash -r uf2
```

which copies `build/zephyr/zephyr.uf2` to the drive. The board reboots into the new firmware once the copy finishes and starts killed. The kill switch must be cycled before the thrusters can be used ([Kill switch](/maritime/firmware/#kill-switch)).

Without a desktop to mount the drive (on the Jetson for example), `./mount_pico.sh` mounts it at `/mnt/rpi_pico`, after which `west flash -r uf2` can find it and use it as normal.

## Formatting

```sh
./format.sh           # format C and devicetree, and report checkpatch issues
./format.sh --check   # change nothing and fail if anything needs fixing
```

`format.sh` formats C with clang-format (`.clang-format`, Zephyr's style) and devicetree with `dts-linter`, then checks the C with Zephyr's `checkpatch.pl` (settings in `.checkpatch.conf`). Checkpatch's issues, such as `//` comments, have to be fixed by hand.

The pre-commit hook runs `./format.sh --check`. Pre-commit hooks are used to ensure compliance with the project's coding standards. In this case, they are used for compliance with formatting rules. Running `git commit --no-verify` will skip the pre-commit hook. For a clone made before the installer added the hook:

```sh
npm --prefix ../zephyr/scripts/ci ci
printf '#!/bin/sh\nexec ./format.sh --check\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Job      | Does                                                                    |
| -------- | ----------------------------------------------------------------------- |
| `format` | runs `./format.sh --check` and ensures compliance with formatting rules |
| `build`  | runs `west build -b rpi_pico` and uploads generated `zephyr.uf2`        |
