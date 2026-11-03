---
title: Run the simulator
description: Start the full robot software in a simulated pool, run a mission, and drive the robot with Foxglove.
---

## Start it

```bash
cd ~/avbotz/thalassic
pixi run up
```

This starts the simulator and around 15 other programs. A window showing the pool opens after a few seconds, and the terminal fills with their messages.

After about 12 seconds, the controller prints that it is ready to drive:

```text
[sub_control-3] [INFO] [1793584627.894890485] [marlin_v3.sub_control]: armed
```

The simulated kill switch starts engaged and releases itself after 6 seconds, and the thrusters take 3 more seconds to start. As on the real robot, the controller arms only after the release ([Staying safe](/start-here/big-picture/#staying-safe)). The robot then holds just under the surface, waiting for commands.

:::note[Messages that look bad but are fine]

- `Simulation cannot keep up with real time!`: a few at startup are normal. A steady stream means your computer is struggling; see [Options](#options).
- `Texture has 1 channels while expected 3 channels!` and `No timestamp set for diagnostic message`: these appear every run.
- `dropped a frame`, or `process has died ... exit code -6`, as you shut down: the simulator does not exit tidily.

:::

## Look around

Click on the simulator window, then:

| Press                       | To                                                   |
| --------------------------- | ---------------------------------------------------- |
| Right mouse button and drag | Rotate the view                                      |
| W, A, S, D, Q, Z            | Fly the view forward, left, back, right, up and down |
| K                           | Show the keyboard shortcuts                          |
| H                           | Show or hide the on-screen display                   |
| Esc                         | Close the simulator                                  |

Apart from Esc, these only move your view, not the robot.

## Stop it

Press **Ctrl-C** in the terminal. Shutting everything down takes a few seconds. Always stop one simulator before starting another.

If something is stuck, or the next run behaves strangely, clean up what is left over:

```bash
pixi run reset
```

## Options

Launch arguments change how it runs. Write them as `name:=value` after a `--`:

```bash
pixi run up -- course:=C1 seed:=7
```

:::caution[Don't forget the `--`]

Without it:

```text
Error:   × task 'up' received more arguments than expected
```

:::

| Argument | What it does |
| --- | --- |
| `headless:=true` | No window, cameras or GPU, for slow computers or no OpenGL 4.3. Everything except vision works |
| `rendering_quality:=low` | Cheaper graphics, for slower computers |
| `window_width:=800 window_height:=450` | A smaller window, also faster |
| `mission:=prelim` | Run a mission ([below](#run-a-mission)) |
| `course:=C1` | Which dock to start from: `A`, `B1`, `C1` or `D` (the default) |
| `seed:=7` | Puts the props in the same random positions every time |
| `sensor_noise:=false` | Perfect sensors, to rule out noise |
| `record:=true` | Record the run to a [bag file](/thalassic/recording/) in `bags/` |

`pixi run up -- --show-args` lists all of them.

## Run a mission

A **mission** is the robot's plan for a run. The team tests the controller with this short one:

```bash
pixi run up -- mission:=pid_tuning
```

Once the robot is armed and its thrusters have started, it dives to 1 m, swims 2 m forward, turns 90° right, and rises to the surface in two steps, pausing 8 seconds after each move. It takes about a minute. `sub_mission` logs each step, and at the end prints:

```text
[mission-4] [INFO] [...] [marlin_v3.sub_mission]: Mission 'pid_tuning' finished with SUCCESS.
```

The robot then holds where it is, and the rest of the stack keeps running until you press Ctrl-C.

You write your own mission in [the first tutorial](/tutorials/first-mission/).

## Drive it with Foxglove

You need [Foxglove installed](/start-here/setup/#step-6-install-foxglove) for this.

1. Start the simulator with `pixi run up`, and wait for `armed`.
1. In Foxglove, choose **Open connection**, then **Foxglove WebSocket**, and enter `ws://localhost:8765`.
1. Import the driving layout: **Layouts → Import from file**, then `~/avbotz/thalassic/src/sub_bringup/foxglove/teleop_sim.json`.
1. Click on the **6-DOF Teleop** panel. A purple outline means it is listening to your keyboard.

Now drive:

| Keys  | Moves the robot     |
| ----- | ------------------- |
| W / S | Forward / back      |
| A / D | Left / right        |
| R / F | Up / down           |
| Q / E | Turn left / right   |
| Space | Stop and hold still |

The layout also shows both cameras, and has **KILL** and **RELEASE** buttons for the simulated kill switch. Press KILL while moving: the thrusters stop and the robot floats up. After RELEASE, it arms again a few seconds later.

The same folder has `autonomy_sim.json`, for watching a mission run, and `tuning_sim.json`, for tuning the controller. See [Foxglove](/thalassic/foxglove/).
