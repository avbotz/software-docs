---
title: "Talking to the board"
description: "maritime.py, and the binary protocol between the thruster board and thalassic."
---

The board speaks a binary protocol over USB, so a terminal emulator cannot talk to it. On the vehicle, thalassic's `sub_low` does; on the bench, `maritime.py`.

## maritime.py

`maritime.py` needs pyserial: the workspace's virtual environment has it (`source ./setup.sh`); elsewhere, `pip install pyserial` or `apt install python3-serial`.

```sh
./maritime.py                      # interactive shell; type help
./maritime.py monitor              # print the board's state at 5 Hz until Ctrl+C
./maritime.py status
./maritime.py one 3 0.2            # thruster 3 at 0.2 until Ctrl+C
./maritime.py torpedo 0 open
./maritime.py grabber close
./maritime.py servo dropper 1200
./maritime.py bootloader           # reboot into the UF2 bootloader for flashing
```

With a command, it runs that one shell command and exits; a command that holds throttle keeps going until Ctrl+C. The shell's commands:

| Command                                        | Does                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `status`                                       | The board's last state, and the link's counts                                                           |
| `monitor`                                      | Print every state the board sends (5 Hz) until Ctrl+C                                                   |
| `throttle <t0> ... <t7>`                       | Hold all eight thrusters (each -1 to 1; the board scales them down if they would draw too much current) |
| `all <t>`                                      | Hold every thruster at `t`                                                                              |
| `one <id> <t>`                                 | Hold thruster `id` (0 to 7) at `t`, and the others at 0                                                 |
| `stop`                                         | Hold every thruster at 0                                                                                |
| `torpedo <0\|1> <open\|close>`                 | Open or close a torpedo                                                                                 |
| `dropper <0\|1> <open\|close>`                 | Open or close a dropper                                                                                 |
| `grabber <open\|close\|0-1>`                   | Open or close the grabber, or set how closed it is (0 open, 1 closed)                                   |
| `servo <dropper\|grabber\|shooter> <pulse_us>` | A raw pulse, clamped to the servo's range                                                               |
| `bootloader`                                   | Reboot into the UF2 bootloader (stops the thrusters first)                                              |
| `quit`                                         | Stop the thrusters and exit                                                                             |

- It finds the board at `/dev/maritime` (thalassic's [udev rule](/thalassic/deployment/#udev-rules)), or else by its USB ID; `--port` names another.
- The board stops every thruster 500 ms after the last throttle command, so the script resends the current one until it changes, and quitting stops them.
- The board obeys throttle commands only once the kill switch has been released, and after a reset, only once it has been cycled ([Kill switch](/maritime/firmware/#kill-switch)).
- `sub_low` and the script cannot have the board open at the same time.
- A [debug build](/maritime/setup/#debug-build)'s logs come over the same link, between frames: the script prints them as `board: ...` lines.

## Protocol

The board talks to thalassic over USB CDC ACM (`/dev/ttyACM*` on Linux, a COM port on Windows). Every frame on the wire is

```
0x00, COBS(type, payload), 0x00
```

- `type` is a byte. Every multi-byte field is little-endian, and floats are IEEE 754 single precision.
- [COBS](https://en.wikipedia.org/wiki/Consistent_Overhead_Byte_Stuffing) (Consistent Overhead Byte Stuffing) removes every zero byte from the frame, so a zero only ever marks where one ends: a receiver that opens the port mid-frame, or is cut off mid-frame by a reset, is back in step at the next zero.
- There is no checksum or sequence number: USB checks every packet and resends any that fail, so bytes are not corrupted or lost on the way.
- A frame whose payload is the wrong size for its type is dropped and counted.

`include/protocol.h` defines it all.

### Host to board

| Type   | Name       | Payload                                                                                                                                                                                                       |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x01` | THRUSTERS  | `f32 throttle[8]`, each between -1 and 1 (all scaled down if they would draw too much current). Only obeyed while released; if none arrives for 500 ms, every thruster stops. NaN or inf stops that thruster. |
| `0x02` | TORPEDO    | `u8 id` (0, 1), `u8 open` (0 closes, 1 opens)                                                                                                                                                                 |
| `0x03` | DROPPER    | `u8 id` (0, 1), `u8 open` (0 closes, 1 opens)                                                                                                                                                                 |
| `0x04` | GRABBER    | `f32 closed`, from 0 (open) to 1 (closed); out of range is clamped, NaN or inf ignored. Does nothing while the grabber is not in the overlay ([Servos](/maritime/hardware/#servos))                           |
| `0x05` | SERVO      | `u8 servo` (0 dropper, 1 grabber, 2 shooter), `u16 pulse_us`, clamped to the servo's range in the overlay                                                                                                     |
| `0x06` | BOOTLOADER | `u32 0x544f4f42` ("BOOT"): stops the thrusters and reboots into the UF2 bootloader                                                                                                                            |

### Board to host

| Type   | Name  | Payload                                                                                                      |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------ |
| `0x81` | STATE | 5 Hz. `u8 protocol` (3), `u8 flags`, `f32 depth_m`, `u32 uptime_ms`, `u32 command_timeouts`, `u32 rx_errors` |

In `STATE`:

- `flags` bit 0 is set while killed: throttle commands are not obeyed, including in the 750 ms after a release while the ESCs initialize.
- `flags` bit 1 is set while `depth_m` is a reading: meters below the surface reading, or 0 when the sensor cannot be read ([Depth](/maritime/firmware/#depth)).
- `uptime_ms` going down means the board restarted.
- `command_timeouts` counts the times the board stopped the thrusters because throttle commands stopped coming.
- `rx_errors` counts the frames from the host the board dropped.

### Changing the protocol

Three copies of it have to agree: the firmware's `include/protocol.h`, `maritime.py`, and thalassic's `sub_low`. A change that breaks compatibility bumps the version in all three (`PROTOCOL_VERSION` in the first two, `maritime::PROTOCOL` in `sub_low`), and this page.
