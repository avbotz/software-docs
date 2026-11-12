---
title: "Hardware"
description: "The thruster board's pins, the thrusters and ESCs, the servos and how to program them, the pressure sensor and the kill switch."
---

The board is a [Raspberry Pi Pico](https://docs.zephyrproject.org/latest/boards/raspberrypi/rpi_pico/doc/index.html) (RP2040), connected to the Jetson over USB.

## Pins

From `boards/rpi_pico.overlay`, which is the only copy: change a pin there, and then here. A PWM channel _n_ on the RP2040 is slice _n_/2, output A or B, and each slice can only reach certain pins: the `pinmux` in the overlay picks which.

| Pin  | What                    | Overlay                             |
| ---- | ----------------------- | ----------------------------------- |
| GP0  | Thruster 7 ESC signal   | `thruster7`, PWM channel 0 (0A)     |
| GP1  | Thruster 4 ESC signal   | `thruster4`, PWM channel 1 (0B)     |
| GP2  | Thruster 3 ESC signal   | `thruster3`, PWM channel 2 (1A)     |
| GP3  | Thruster 2 ESC signal   | `thruster2`, PWM channel 3 (1B)     |
| GP6  | Thruster 5 ESC signal   | `thruster5`, PWM channel 6 (3A)     |
| GP7  | Thruster 6 ESC signal   | `thruster6`, PWM channel 7 (3B)     |
| GP8  | Thruster 1 ESC signal   | `thruster1`, PWM channel 8 (4A)     |
| GP9  | Thruster 0 ESC signal   | `thruster0`, PWM channel 9 (4B)     |
| GP20 | Torpedo (shooter) servo | `shooter_servo`, PWM channel 4 (2A) |
| GP21 | Dropper servo           | `dropper_servo`, PWM channel 5 (2B) |
| GP26 | Pressure sensor         | `pressure`, ADC channel 0           |
| GP28 | Kill switch             | `killswitch_button`, pulled up      |

## Thrusters and ESCs

The board sends each of the eight ESCs a standard servo pulse at 50 Hz: a thrust of -1 is 1100 µs, 0 is 1500 µs (neutral), and 1 is 1900 µs, linear between them. The firmware caps thrust at ±0.6, so 1260 to 1740 µs ([Safety limits](/maritime/firmware/#safety-limits)).

A thruster's number is its index in thalassic's `control/thrusters`, and its place on the vehicle:

| Thruster | Where                  |
| -------- | ---------------------- |
| 0        | Vertical front left    |
| 1        | Vertical front right   |
| 2        | Vertical back left     |
| 3        | Vertical back right    |
| 4        | Horizontal front left  |
| 5        | Horizontal front right |
| 6        | Horizontal back left   |
| 7        | Horizontal back right  |

The layout's only copy is the `thrusters` list in thalassic's `sub_bringup/config/vehicles/marlin_v3.yaml`, which `sub_control` builds its allocation from. If a thruster spins when another is commanded, the ESC is wired to the wrong pin: fix the wiring or the overlay, not that list.

## Servos

The servos are driven with [PWM](https://www.electronics-tutorials.ws/blog/pulse-width-modulation.html), and each one's pulse range is in the overlay (`min-pulse`, `mid-pulse`, `max-pulse`).

| Servo             | Command            | Pulse                               |
| ----------------- | ------------------ | ----------------------------------- |
| Dropper           | Close (at startup) | 1250 µs, between min and max        |
|                   | Dropper 0 open     | 1700 µs (max): drops the right ball |
|                   | Dropper 1 open     | 800 µs (min): drops the left ball   |
| Torpedo (shooter) | Close (at startup) | 800 µs (min): both holes closed     |
|                   | Torpedo 0 open     | 1150 µs (mid): opens the right hole |
|                   | Torpedo 1 open     | 1700 µs (max): opens the left hole  |

The grabber is not wired up: its node is commented out of the overlay, so the firmware leaves it out, and a `GRABBER` or `SERVO` command for it does nothing.

### Programming a servo

You can test and program a servo (to add overload protection, set its endpoints, …) with a [DPC-11 programmer](https://hitecrcd.com/products/servos/programmers/dpc-11/product) and its [software](https://hitecrcd.com/uploads/DPC-11_Install__2020_12_09_01-2.9.9.zip), on Windows 10 or 11.

1. **Install the software.** It needs .NET 3.5: from the Start menu, open "Turn Windows features on and off" and select ".NET Framework 3.5 (includes .NET 2.0 and 3.0)". Then run `DPC-11_Setup.msi` from `DPC-11_Install__2020_12_09_01-2.9.9/DPC-11_2020_12_09_01-2.9.9/`.
1. **Turn off driver signature enforcement,** which the DPC-11's driver needs. In Settings, go to Recovery > Advanced startup > Restart now. During startup, choose Troubleshoot > Advanced options > Startup Settings > Restart, then press 7 (or F7) to disable driver signature enforcement.
1. **Install the driver.** Once Windows has started, run `install_DPC-11_2020_12_09_01-2.9.9.exe` from `DPC-11_Install__2020_12_09_01-2.9.9/DPC-11_2020_12_09_01-2.9.9/HITECRCD_DPC-11 Driver Installer`. Plug the DPC-11 in, find it in Device Manager, right-click it and choose "Update driver", then "Browse my computer for drivers", select the `HITECRCD_DPC-11 Driver Installer` folder, and choose "Next".
1. **Connect.** Start the DPC-11 software, choose your servo's type from its menu (ours are Blue Trail's D-Series servos), and plug the DPC-11 in over USB: the rectangle at the top left turns green. Wire the servo to the DPC-11 with female Dupont connectors: about 6 V and ground into the "Batt" port, and the servo's power, ground and signal into the servo port. Then press "Connect".

From there, follow [the DPC-11 manual](https://hitecrcd.com/images/products/pdf/411_DPC11_ManualV3.pdf).

## Pressure sensor

An Ashcroft K1 pressure sensor gives a voltage proportional to the pressure, which the RP2040's 12-bit ADC reads on GP26. The ADC gives a unitless count, so the mapping from counts to meters was calibrated by hand: readings at many measured depths, and a linear fit through them. The firmware uses its slope, 365 counts per meter (`COUNTS_PER_METER` in `pressure.c`), and measures depth from a surface reading ([Depth](/maritime/firmware/#depth)). Recalibrate after changing the sensor or its wiring.

## Kill switch

The kill switch cuts power to the ESCs, and is wired to GP28 as well, which the firmware reads ([Kill switch](/maritime/firmware/#kill-switch)). It reads high (voltage on the pin) while killed, and low while released. The pin is pulled up, so a broken or unplugged kill switch wire reads as killed.
