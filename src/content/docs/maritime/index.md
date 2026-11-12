---
title: maritime reference
description: The full details of maritime, the firmware on the board that drives AVBotz's thrusters.
---

maritime is the firmware on the thruster board, a Raspberry Pi Pico (RP2040) running [Zephyr RTOS](https://zephyrproject.org/). It drives the eight thrusters' ESCs and the dropper and torpedo servos, reads the depth sensor and the kill switch, and communicates with thalassic's `sub_low` over USB. The code is at [avbotz/maritime](https://github.com/avbotz/maritime).

## Pages

| Page                                        | What it covers                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Setup and build](/maritime/setup/)         | The installer, the workspace, building, flashing, formatting and CI                                             |
| [Firmware](/maritime/firmware/)             | The source files, the main loop, the kill switch and the safety limits, depth, logging, and how to add a device |
| [Talking to the board](/maritime/protocol/) | `maritime.py`, and the binary protocol between the board and thalassic                                          |
| [Hardware](/maritime/hardware/)             | The pins, the thrusters and ESCs, the servos and how to program them, the pressure sensor, the kill switch      |

## Quick start

In a terminal (do not clone the repository: the installer does):

```sh
curl -sSL https://raw.githubusercontent.com/avbotz/maritime/refs/heads/main/install.sh | bash
```

Then, in `maritime-workspace/maritime`:

```sh
source ./setup.sh          # in every new terminal
west build -b rpi_pico     # build
west flash -r uf2          # flash a board in its UF2 bootloader
./maritime.py              # talk to the board (type help)
```

## Common tasks

| Command                                                  | Does                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `west build -b rpi_pico`                                 | Build `build/zephyr/zephyr.uf2`                                         |
| `west build -b rpi_pico -- -DEXTRA_CONF_FILE=debug.conf` | A debug build, which sends its logs over USB                            |
| `west flash -r uf2`                                      | Copy the build to a board in its UF2 bootloader                         |
| `./maritime.py bootloader`                               | Reboot the board into its UF2 bootloader, ready to flash                |
| `./maritime.py monitor`                                  | Print the board's state at 5 Hz until Ctrl+C                            |
| `./format.sh`                                            | Format C and devicetree, and report checkpatch issues                   |
| `./format.sh --check`                                    | Change nothing, and fail if anything needs fixing (the pre-commit hook) |

## What's the name?

[![A thesaurus listing "maritime" as a synonym for "nautical".](/images/maritime/why-maritime-name.png)](/images/maritime/why-maritime-name.png)

## Why maritime?

maritime was designed from the ground up to solve many deficiencies with the system before it, Nautical:

- Limited computing power on the ATmega2560 (clock, flash and RAM, no FPU)
- Constrained to AVR devices only
- No threading
- No robust communication protocol between the microcontroller and the PC

maritime addresses these, and makes further improvements:

- Switched hardware from the Arduino Mega 2560 to RP2040-based boards
- Uses Zephyr RTOS, for hardware abstraction and multithreading

Planned:

- Ethernet rather than USB between maritime and the PC
- MAVLink between maritime and the PC
- Migration to Flipsky ESCs and CAN-FD
