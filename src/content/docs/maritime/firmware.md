---
title: "Firmware"
description: "maritime's source files, its main loop, the kill switch and safety limits, depth, logging, and adding a device."
---

The firmware is one thread, `main()`, which loops every millisecond. Bytes from the host arrive in an interrupt, which hands whole frames to the loop through a queue.

## Source files

| File                      | What it does                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/main.c`              | The main loop: the kill switch, the frames from the host, the safety limits, and the state it sends |
| `src/protocol.c`          | The [binary protocol](/maritime/protocol/#protocol): COBS framing, in both directions               |
| `src/thruster.c`          | Thrust (-1 to 1) to an ESC pulse                                                                    |
| `src/servo.c`             | The dropper, torpedo and grabber servos                                                             |
| `src/pressure.c`          | The pressure sensor's ADC readings to depth                                                         |
| `src/killswitch.c`        | Reads the kill switch's pin                                                                         |
| `include/*.h`             | Their interfaces. `include/protocol.h` defines the protocol                                         |
| `boards/rpi_pico.overlay` | Which pin is which device ([Pins](/maritime/hardware/#pins))                                        |
| `dts/bindings/`           | The devicetree bindings Zephyr does not have: `pwm-servo` and `pwm-thrusters`                       |
| `prj.conf`                | The Kconfig options: the drivers, USB, the watchdog and COBS                                        |
| `debug.conf`              | Added to `prj.conf` for a [debug build](/maritime/setup/#debug-build)                               |

## The main loop

Each pass, `main()`:

1. Feeds the hardware watchdog.
1. Reads and debounces the kill switch, and starts or stops the thrusters ([Kill switch](#kill-switch)).
1. Handles every frame that has arrived from the host: thrust, the torpedoes, the dropper, the grabber, a raw servo pulse, or a reboot into the bootloader.
1. Stops the thrusters if they are running and no thrust command has arrived for 500 ms.
1. Every 100 ms, sends the host a `STATE` frame, and sets the thrusters to neutral again if they are not running.
1. Sleeps for 1 ms.

Nothing in the loop may block: a pass that takes over a second resets the board. Anything that waits on a device needs a bound, as the pressure readings have ([Depth](#depth)).

## Kill switch

The kill switch cuts power to the ESCs. The firmware reads it on a pin as well, and only drives the thrusters while it is released:

- A change counts once the switch has read the same for 75 ms.
- On a release, the ESCs power up, and need neutral before they take a command: the thrusters stay at neutral for 750 ms, and only then does the board obey thrust commands. `STATE` reports the board killed until then.
- On a kill, every thruster goes to neutral at once.
- The board starts killed, whatever the switch reads, and a release counts only after the switch has read killed since boot. **After any reset (flashing, a brownout, the watchdog), cycle the kill switch:** a board that resets mid-run stays killed rather than driving again on its own.

## Safety limits

| Limit                            | Value         | What happens                                                                                                                                    |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Command timeout                  | 500 ms        | Once thrust commands have started, every thruster goes to neutral if none arrives for this long. `STATE` counts the times in `command_timeouts` |
| Hardware watchdog                | 1 s           | The RP2040 resets if the main loop stalls this long, which stops the thruster PWM. It is paused while a debugger halts the chip                 |
| Power cap                        | ±0.6          | Thrust beyond it is clamped: 1260 to 1740 µs to the ESCs. thalassic's `sub_control` and `sub_low` clamp to the same value                       |
| A thrust that is NaN or infinite | 0             | That thruster goes to neutral                                                                                                                   |
| Servo pulse                      | The overlay's | A raw `SERVO` pulse is clamped to the servo's `min-pulse` and `max-pulse`                                                                       |

## Depth

`pressure.c` turns the pressure sensor's ADC readings into depth in meters, positive down, below a surface reading:

- Each reading is the mean of 10 good ADC samples. A sample of 0 (a disconnected sensor) is not good, and after 30 tries without 10 good ones, the reading fails: `STATE` then flags the depth invalid, rather than making one up.
- Depth is (reading − surface reading) / 365, the ADC counts per meter from a linear fit of readings against measured depths ([Pressure sensor](/maritime/hardware/#pressure-sensor)).
- The surface reading is taken at startup, and again at each kill switch release, but only if the vehicle is within 0.5 m of the old surface reading, so that a release underwater does not move the surface.

## Receiving and sending

The USB link is a CDC ACM serial port. Its receive interrupt decodes COBS a byte at a time, and queues each whole frame (up to 8) for the main loop, which checks its length against its type. A frame that is garbled, too long, the wrong size for its type, or arrives to a full queue is dropped and counted in `STATE`'s `rx_errors`. Frames are sent only from the main loop.

## Logging

Logging is off (`CONFIG_LOG=n`): Zephyr's console shares the USB link with the protocol, and a log line in the middle of a frame would corrupt it. A [debug build](/maritime/setup/#debug-build) turns it on, for the bench only. Every frame starts with a `0x00` delimiter, which ends whatever came before it, so logs between frames do not break the frames themselves, and `maritime.py` prints them.

## Adding a device

Every device goes through Zephyr's devicetree and drivers. The kill switch is the simplest example.

1. **Describe it in `boards/rpi_pico.overlay`.** The overlay goes on top of the board's own devicetree (`boards/raspberrypi/rpi_pico/` in Zephyr). Give the node a label, a compatible with a binding, and the properties the binding needs. The kill switch is a GPIO "button", on GP28, read high when killed:

   ```dts
   buttons {
   	compatible = "gpio-keys";

   	/* Debounced in software by main.c, not by the input subsystem. */
   	killswitch_button: killswitch_button {
   		gpios = <&gpio0 28 (GPIO_ACTIVE_HIGH | GPIO_PULL_UP)>;
   		label = "Killswitch";
   	};
   };
   ```

   If Zephyr has no binding for the device, add one in `dts/bindings/`, as `pwm-servo.yaml` and `pwm-thrusters.yaml` are.

1. **Get it in C by its label,** in its own `src/<device>.c`:

   ```c
   static const struct gpio_dt_spec killswitch =
   	GPIO_DT_SPEC_GET(DT_NODELABEL(killswitch_button), gpios);
   ```

1. **Set it up in a `setup_<device>()`,** declared in `include/<device>.h` and called from `main()` before the loop. The kill switch is an input ([GPIO flags](https://docs.zephyrproject.org/latest/hardware/peripherals/gpio.html)):

   ```c
   gpio_pin_configure_dt(&killswitch, GPIO_INPUT);
   ```

1. **Turn its driver class on in `prj.conf`,** if it is not already (`CONFIG_GPIO`, `CONFIG_PWM`, `CONFIG_ADC`, …).

Zephyr's [basic samples](https://github.com/zephyrproject-rtos/zephyr/tree/main/samples/basic) (buttons, servos, …) show most kinds of device.

A device that streams data (a UART sensor, say) sends a byte at a time. Handle each byte in the driver's callback, which has to be quick so that no byte is lost, and hand each whole message to the main loop through a `k_msgq` to parse, as `protocol.c` does with frames from the host.
