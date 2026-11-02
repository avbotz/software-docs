---
title: Troubleshooting
description: The errors people actually hit, what they mean, and how to fix them.
---

Search this page for the text of your error (Ctrl-F). If it isn't here, see [Asking for help](#asking-for-help) at the bottom.

## Command not found

### `pixi: command not found`

Your terminal doesn't know where pixi is. Run this, then open a new terminal:

```bash
echo 'export PATH="$HOME/.pixi/bin:$PATH"' >> ~/.bashrc
```

### `ros2: command not found`

You are in a plain terminal. `ros2` only exists inside the pixi environment:

```bash
cd ~/avbotz/thalassic
pixi shell
```

### `Package 'sub_bringup' not found`

```text
Package 'sub_bringup' not found: "package 'sub_bringup' not found, searching: [...]"
```

The workspace hasn't been built, so run `pixi run build`. If you have just built it inside a `pixi shell`, exit that shell and open it again.

## Running `pixi run up`

### `task 'up' received more arguments than expected`

### `file 'seed:=42_launch.py' was not found`

You left out the `--`. Launch arguments have to come after it:

```bash
pixi run up -- seed:=42
```

### The window doesn't open, or it crashes straight away

The simulator's window needs OpenGL 4.3. Check what your computer has:

```bash
sudo apt install mesa-utils
glxinfo -B | grep "core profile version"
```

If that's below 4.3, or you are in a virtual machine, run with no window. Everything but the cameras still works:

```bash
pixi run up -- headless:=true
```

### `Simulation cannot keep up with real time!`

A few at startup are normal. If they keep coming, your computer is overloaded, so close other programs and make the simulator's job easier:

```bash
pixi run up -- rendering_quality:=low window_width:=800 window_height:=450
```

Or, if you don't need the cameras, use `headless:=true`.

### Messages that look like errors but aren't

These appear on normal runs:

| Message | What it is |
| --- | --- |
| `Sub is killed, waiting...` | The mission waiting for the kill switch to release. This takes about 6 seconds |
| `Texture has 1 channels while expected 3 channels!` | Harmless |
| `No timestamp set for diagnostic message` | Harmless |
| `dropped a frame`, while shutting down | Harmless |
| `process has died [... exit code -6 ...]`, while shutting down | The simulator doesn't exit tidily |

### Something else is holding things up, or the next run acts strangely

An earlier run may not have shut down fully. Clear it:

```bash
pixi run reset
```

If the simulator is still going after that, `pkill -f stonefish_simulator` stops it.

## The robot doesn't move

Work through these in order, in a `pixi shell`:

1. **Is it armed?** Run `ros2 topic echo --once /marlin_v3/control/armed`. If this says `false`, the kill switch is engaged or a sensor is missing. Look in the terminal for `sub_control`'s messages, which say what it's waiting for. It takes about 12 seconds after startup.
1. **Was your command accepted?** Run `ros2 topic echo --once --field command_rejected /marlin_v3/control/error`. If it's `true`, the terminal running the simulator says why.
1. **Is the topic right?** It needs the `/marlin_v3/` at the start. Compare with `ros2 topic list`.
1. **Is the mode right?** A `mode` of `0` means "leave this axis alone", whatever the target says. See [Send your first command](/start-here/ros-2-hands-on/#send-your-first-command).

### `Waiting for at least 1 matching subscription(s)...` that never ends

It's normal to see this once or twice. If it goes on and on, nothing is listening on that topic. Either the simulator isn't running, or the topic name is wrong.

## Nodes can't see each other

### `ros2 topic list` only shows `/parameter_events` and `/rosout`

Your terminal can't see the stack. Check these:

1. Is the stack actually running, and has it finished starting?
1. Did you use `pixi shell` in this terminal, from the `thalassic` folder?
1. Do both terminals have the same `ROS_DOMAIN_ID` and `ROS_AUTOMATIC_DISCOVERY_RANGE`? Check with `env | grep ROS`.

If that all looks fine, run `ros2 daemon stop` and try again. If it still fails, stop the stack, then run `pixi run reset`.

### An error mentioning `rmw_create_node`, or nodes that stop finding each other after a crash

A crash left stale files behind. Run `pixi run reset`.

## Missions

### `Failed to load mission ...: a port with name [...] is found in the XML`

You used a setting that the step doesn't have, probably a typo. The message gives the step and the line. Check it against [the list of steps](/thalassic/mission/#behavior-tree-xml).

### `Mission file '...' does not exist. Available missions:`

Check the spelling. After a name, it looks in the installed missions. For a file of your own, give the full path: `mission:=$HOME/avbotz/playground/my_mission.xml`. Use `$HOME` here, since `~` doesn't work in this position. And if you have just added a file to `resources/missions/`, build `sub_mission` so it can be found.

### `MoveRelative timed out`

A move took too long, so the step gave up. The target may be further than it can reach in time, or the robot may be stuck on a prop. Look at where it is in the simulator's window. The `error xyz` numbers say how far it still had to go.

For example, `prelim` times out on its way back from the default dock (`course:=D`), about 2.3 m short of its target, but it finishes from `course:=A`.

### My change to the code had no effect

Check whether [it needed a rebuild](/concepts/build-tools/#when-do-i-need-to-rebuild). C++ always does.

### A mission gets stuck looking for the gate

This is expected in the simulator: the gate model [doesn't detect much there](/concepts/vision/#each-task-has-its-own-network). To test mission logic, use a `hard_coded_*` mission.

## Vision

### `vision/detections` is always empty

1. Is a model loaded? Nothing is detected until one is: see [Each task has its own network](/concepts/vision/#each-task-has-its-own-network).
1. Are you using `headless:=true`? That has no cameras.
1. Is it the simulator? Real-world models don't do well on simulated images.

### A model can't be found

Download the models with `pixi run fetch-weights`.

## The build fails

1. **Read the first error, not the last.** Scroll up to the first line containing `error:`. Later errors are often caused by it. Warnings don't matter here.
1. **Did you just pull?** Run the [update steps](/start-here/setup/#updating-later). This fixes most build failures after a pull.
1. **Is a package in a submodule failing, or a folder empty?** Run `git submodule update --init --recursive`.
1. **Is the error in a file you didn't change?** Try a clean build: `pixi run clean`, then `pixi run build`.
1. **Did it run out of memory?** If the build dies with `Killed`, or your computer freezes, build with fewer jobs at once: `pixi run build --parallel-workers 1`.
1. **Did you run out of disk space?** Check with `df -h ~`.

To see the whole log for one package, look in `log/latest_build/<package>/stdout_stderr.log`.

## Git

### My commit was rejected by a hook

A formatting check failed. Have the formatter fix it, then try again:

```bash
pixi run format
git add -u
git commit
```

### `pixi run` errors when committing, about a missing environment

The hooks need the environment to exist. Run `pixi install`.

### `Permission denied (publickey)`, or an error about authentication when pushing

Your SSH key isn't set up, or you cloned with an `https://` address. See [Before you start](/tutorials/first-pull-request/#before-you-start).

### Permission denied, and your key is fine

You may not be in the [avbotz](https://github.com/avbotz) GitHub organization yet. Ask a lead to add you.

## Foxglove

### It won't connect

- Is the stack running? `foxglove_bridge` starts along with it.
- Is the address exactly `ws://localhost:8765`?
- Is it an old run that has hung? Run `pixi run reset`, then start it again.

### The panels are missing, or it says it can't find them

Install the [extensions](/start-here/setup/#step-6-install-foxglove), then restart Foxglove.

### The keyboard doesn't drive the robot

Click on the 6-DOF Teleop panel first: it only listens while it has focus. Then check the status line in the panel, which says if the robot is killed or not armed.

## Asking for help

Everyone gets stuck, so please do ask, ideally after 30 minutes or so. You will get a useful answer much faster if you include:

1. **What you were trying to do.**
1. **The exact command you ran.**
1. **The exact error, as text.** Copy and paste it, rather than taking a photo of the screen. Include the lines before it too.
1. **What you already tried.**

```text
I'm trying to run my mission from the first-mission tutorial.
I ran: pixi run up -- mission:=~/avbotz/playground/my_first_mission.xml
I get: [mission-4] [ERROR] ... Mission file '...' does not exist.
I've checked that the file is there with ls.
```

And when you do solve something that wasn't on this page, add it here. The next person will thank you.
