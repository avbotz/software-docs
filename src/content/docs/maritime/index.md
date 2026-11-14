---
title: "maritime reference"
description: "Introduction to maritime firmware"
---

maritime is AVBotz's firmware for the Raspberry Pi Pico (RP2040), built on [Zephyr RTOS](https://zephyrproject.org).

It interfaces with the eight thrusters ESCs, the servos, the depth sensor, and the kill switch, and communicates with thalassic's `sub_low` over USB. The code is at [avbotz/maritime](https://github.com/avbotz/maritime).

## Pages

1. [Setup and build](/maritime/setup)
1. [Firmware](/maritime/firmware)
1. [Talking to the board](/maritime/protocol)
1. [Hardware](/maritime/hardware)

## Quick start

In a terminal (do not clone the repository, the installer does):

```sh
curl -sSL https://raw.githubusercontent.com/avbotz/maritime/refs/heads/main/install.sh | bash
```

Then, in `maritime-workspace/maritime`:

```sh
source ./setup.sh          # in every new terminal
west build -b rpi_pico     # build for the Raspberry Pi Pico
west flash -r uf2          # flash a board to the Pico's UF2 bootloader
./maritime.py              # communicate with the board (type help)
```

## Useful commands

| Command                                                  | Does                                                     |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `west build -b rpi_pico`                                 | Build                                                    |
| `west build -b rpi_pico -- -DEXTRA_CONF_FILE=debug.conf` | Debug build, which sends logs over USB                   |
| `west flash -r uf2`                                      | Copy the build to a Pico in its UF2 bootloader           |
| `./maritime.py bootloader`                               | Reboot the board into its UF2 bootloader, ready to flash |
| `./maritime.py monitor`                                  | Print the board's state at 5 Hz until Ctrl+C             |
| `./format.sh`                                            | Format C and devicetree, and report checkpatch issues    |
| `./format.sh --check`                                    | Change nothing and fail if anything needs fixing         |

## What's the name?

[![A thesaurus listing "maritime" as a synonym for "nautical".](/images/maritime/why-maritime-name.png)](/images/maritime/why-maritime-name.png)

## Why maritime?

maritime was designed from the ground up to solve many deficiencies with the system before it, [Nautical](https://github.com/avbotz/Nautical):

- Limited computing power on the ATmega2560 (clock, flash and RAM, no FPU)
- Constrained to AVR devices only
- No threading
- No robust communication protocol between the microcontroller and the PC

maritime addresses these, and makes further improvements:

- Switched hardware from the Arduino Mega 2560 to RP2040-based boards
- Uses Zephyr RTOS, for hardware abstraction and multithreading

Planned:

- Ethernet or CAN rather than USB between maritime and the PC
- MAVLink between maritime and the PC
- Migration to VESC ESCs and CAN
