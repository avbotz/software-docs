---
title: Run the simulator
description: Start the full robot software in a simulated pool, run a mission, and drive the robot with Foxglove.
---

Time to see the robot swim.

## Start it

```bash
cd ~/avbotz/thalassic
pixi run up
```

`pixi run up` starts the whole software stack: the simulator and around 15 other programs. A window showing the pool opens after a few seconds, and the terminal fills with messages from all of those programs.

About 12 seconds after you start it, you should see this line in the terminal. It is the controller saying that it is ready to drive:

```text
[sub_control-3] [INFO] [1793584627.894890485] [marlin_v3.sub_control]: armed
```

Why the wait? The simulated kill switch starts engaged and releases itself after 6 seconds, and then the simulated thrusters take 3 more seconds to start. The real robot does the same thing, as you can read in [Staying safe](/start-here/big-picture/#staying-safe).

The robot now holds itself just under the surface, waiting for instructions.

:::note[Messages that look bad but are fine]

There is a lot of noise in the terminal. These are normal:

- `Simulation cannot keep up with real time!`: a few of these are expected at startup. Lots of them, all the time, mean your computer is struggling, and [Options](#options) has some fixes.
- `Texture has 1 channels while expected 3 channels!` and `No timestamp set for diagnostic message`: harmless, and they appear on every run.
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

Apart from Esc, these only change your view. They do not move the robot.

## Stop it

Click on the terminal and press **Ctrl-C**. It takes a few seconds to shut everything down. Always stop one simulator before starting another.

If something seems stuck, or the next run behaves strangely, this cleans up anything left over:

```bash
pixi run reset
```

## Options

You can change how it runs with launch arguments, written as `name:=value` after a `--`:

```bash
pixi run up -- course:=C1 seed:=7
```

:::caution[Don't forget the `--`]

Without it, you get this error:

```text
Error:   × task 'up' received more arguments than expected
```

:::

| Argument | What it does |
| --- | --- |
| `headless:=true` | No window, no cameras and no GPU needed. Use this if your computer struggles or has no OpenGL 4.3. Everything except vision still works |
| `rendering_quality:=low` | Cheaper graphics, for slower computers |
| `window_width:=800 window_height:=450` | A smaller window, which also helps slow computers |
| `mission:=prelim` | Run a mission automatically. See the next section |
| `course:=C1` | Which dock to start from: `A`, `B1`, `C1` or `D` (the default) |
| `seed:=7` | Puts the props in the same random positions every time |
| `sensor_noise:=false` | Perfect sensors, for when you want to rule out noise |
| `record:=true` | Save everything that happens to a [bag file](/thalassic/recording/) in `bags/` |

`pixi run up -- --show-args` lists all of them.

## Run a mission

A **mission** is the robot's plan for a run. Try a short one, which the team uses to test the controller:

```bash
pixi run up -- mission:=pid_tuning
```

Once the robot arms and its thrusters have started, it dives to 1 m, swims 2 m forward, turns 90° to the right, and rises to the surface in two steps, pausing for 8 seconds after each move. It takes about a minute. Watch the terminal for lines from `sub_mission`, which say what it is doing. When it is done, you will see this:

```text
[mission-4] [INFO] [...] [marlin_v3.sub_mission]: Mission 'pid_tuning' finished with SUCCESS.
```

The robot then just holds where it is, and the rest of the stack keeps running until you press Ctrl-C.

You will write your own mission in [the first tutorial](/tutorials/first-mission/).

## Drive it with Foxglove

You need [Foxglove installed](/start-here/setup/#step-6-install-foxglove) for this.

:::note

The steps in this section come from the Foxglove extensions' documentation. The connection itself was tested, but these menus and panels were not clicked through when this page was checked, so names may differ a little in your version.

:::

1. Start the simulator with `pixi run up`, and wait for `armed`.
1. In Foxglove, choose **Open connection**, then **Foxglove WebSocket**, and enter `ws://localhost:8765`.
1. Import the driving layout. Use **Layouts → Import from file**, and pick `~/avbotz/thalassic/src/sub_bringup/foxglove/teleop_sim.json`.
1. Click on the **6-DOF Teleop** panel. A purple outline means that it is listening to your keyboard.

Now drive:

| Keys  | Moves the robot     |
| ----- | ------------------- |
| W / S | Forward / back      |
| A / D | Left / right        |
| R / F | Up / down           |
| Q / E | Turn left / right   |
| Space | Stop and hold still |

You will see both cameras in the layout. It also has **KILL** and **RELEASE** buttons for the simulated kill switch. Try pressing KILL while you are moving: the thrusters stop and the robot floats up. After RELEASE, it arms again a few seconds later.

There are other layouts in the same folder: `autonomy_sim.json` for watching a mission run, and `tuning_sim.json` for tuning the controller. The [Foxglove](/thalassic/foxglove/) page has the details.

Next: [ROS 2, hands on](/start-here/ros-2-hands-on/).
