---
title: Set up your computer
description: Get Linux, install Thalassic and its simulator, set up an editor and install Foxglove, step by step.
---

By the end of this page you will have the whole software stack, including the simulator, built on your own computer. Set aside an evening, because the first download is large.

## What you need

- **A computer running Linux.** The next section explains your options if you don't have one.
- **At least 20 GB of free disk space.** A built copy of Thalassic takes about 8 GB, and the packages it downloads take more.
- **8 GB of RAM or more.** 16 GB is much more comfortable, since building the code uses a lot of memory.
- **Graphics that support OpenGL 4.3,** for the simulator's window. Almost any laptop from the last ten years is fine, including ones with no separate graphics card. Our main development laptop only has integrated graphics. Without OpenGL 4.3 you can still run the simulator with no window.
- **A good internet connection** for the first install.

## Step 1: Get Linux

Thalassic only runs on Linux, and we use **Ubuntu 24.04 LTS**. It is free. Here are your options, best first.

| Option | Good | Bad |
| --- | --- | --- |
| **Ubuntu on its own computer**, such as an old laptop | Nothing to lose, and the simulator runs at full speed | You need a spare computer |
| **Dual boot** with Ubuntu beside Windows | Full speed. You pick which one to use when the computer starts | Changes how your disk is divided up, so back up your files first |
| **WSL 2** on Windows | Easy to install, nothing to repartition | Nobody on the team has tested it yet, so expect to figure a few things out |
| **A virtual machine** on Windows or Mac | Easy to delete and start over | Slow, and probably no OpenGL 4.3, so run the simulator without a window |

Ubuntu has a good [install guide](https://ubuntu.com/tutorials/install-ubuntu-desktop), which also explains dual booting. For WSL, follow [Microsoft's guide](https://learn.microsoft.com/en-us/windows/wsl/install). For a virtual machine, try [VirtualBox](https://www.virtualbox.org/), or UTM on a Mac.

:::caution

If this is a family computer, ask before you change anything, and **back up everything important before dual booting.** It is safe when done carefully, but a mistake when dividing up the disk can erase your files. If you are unsure, ask a lead to sit with you while you do it.

:::

## Step 2: Install git and curl

Open a terminal (on Ubuntu, press Ctrl-Alt-T) and run:

```bash
sudo apt update
sudo apt install git curl
```

`sudo` runs a command as the administrator, so it asks for your password. Nothing appears as you type it. That is normal: type it and press Enter.

:::danger[Do not install ROS 2 yourself]

If you find a ROS 2 install guide elsewhere, don't follow it. Pixi installs the exact version we need, and a second copy from `apt` causes confusing errors. If you already have one, do not `source` it in the terminal you use for Thalassic.

:::

## Step 3: Get the code and build it

```bash
mkdir -p ~/avbotz
cd ~/avbotz
git clone --recurse-submodules https://github.com/avbotz/thalassic.git
cd thalassic
scripts/install.sh
```

What these do:

- `mkdir -p ~/avbotz` makes a folder called `avbotz` in your home folder, and `cd` moves into it.
- `git clone` downloads the code. `--recurse-submodules` also downloads the other repositories Thalassic includes.
- `scripts/install.sh` does everything else. It is safe to run again if it gets interrupted.

Now wait. `install.sh` does these steps, and prints a line as it starts each one:

| It prints | What is happening | How long |
| --- | --- | --- |
| `Installing pixi` | Installs [pixi](/concepts/build-tools/#pixi-installs-everything), the tool that manages everything else | Seconds |
| `Fetching submodules` | Makes sure the submodules are there | Seconds |
| `Creating the pixi environment` | Downloads ROS 2, the compilers and libraries, several GB in all | Depends on your internet, often 10 to 30 minutes |
| `Installing the git hooks` | Sets up the automatic checks that run when you commit | Seconds |
| `Building the workspace` | Compiles all the code | About 5 minutes on a recent 8-core laptop, longer on older ones |
| `Downloading the model weights` | Downloads the trained neural networks | A minute or two |

The build prints a lot of text, including many warnings. **Warnings are fine.** This is what a successful build ends with:

```text
Summary: 18 packages finished [5min 14s]
  15 packages had stderr output: flir_camera_description flir_camera_msgs ...
Downloading the model weights
downloading  bins_blood.onnx (missing)
downloading  bins_fire.onnx (missing)
...
downloading  torp_find.onnx (missing)
```

"Had stderr output" just means that those packages printed warnings. If it stopped with `Failed <<<` or `Aborted`, see [Troubleshooting](/help/troubleshooting/#the-build-fails).

## Step 4: Check that it worked

Close your terminal and open a new one, so it picks up pixi. Then:

```bash
cd ~/avbotz/thalassic
pixi task list
```

You should see this list of everything pixi can do for you:

```text
Task           Description
build          Build the workspace
clean          Remove build, install, and log directories
fetch-weights  Download the models in weights/manifest.toml into weights/ (--check only reports)
format         Format files (--check just lints)
lint           Lint files
preflight      Check a running stack before it goes in the water (--sim for the simulator)
reset          Stop all ROS2 processes and clear stale Fast DDS shared memory
sync-mission   Test the mission behavior trees and copy them to the vehicle
test           Run tests
up             Launch the $arg_launch.py
```

If it says `pixi: command not found`, run this, then close the terminal and open a new one:

```bash
echo 'export PATH="$HOME/.pixi/bin:$PATH"' >> ~/.bashrc
```

Congratulations: you have a working copy of the robot's software. The rest of this page sets up the tools around it. If you are impatient, jump to [Run the simulator](/start-here/run-the-simulator/) and come back.

## Step 5: Set up an editor

Use any editor you like. If you don't have a favorite, use [VS Code](https://code.visualstudio.com/docs/setup/linux). Open the code with:

```bash
cd ~/avbotz/thalassic
code .
```

Install these from its Extensions panel:

| Extension               | For                                                   |
| ----------------------- | ----------------------------------------------------- |
| Python (from Microsoft) | Python code                                           |
| clangd (from LLVM)      | C++ code: jump to definitions, see errors as you type |
| Pixi (from prefix.dev)  | Using the pixi environment                            |

Two settings make those work. Press Ctrl-Shift-P and run **Python: Select Interpreter**, then choose `.pixi/envs/default/bin/python`. Then open your settings (Ctrl-comma), search for `clangd.arguments`, and add this:

```text
--query-driver=**/.pixi/envs/*/bin/*
```

[Editors](/thalassic/setup/#editors) explains why that is needed.

## Step 6: Install Foxglove

[Foxglove](https://foxglove.dev) is the app we use to see what the robot is doing and to drive it by hand: its cameras, graphs of its signals, and buttons and keyboard controls.

1. [Download Foxglove](https://foxglove.dev/download), choosing the Linux `.deb` file.
1. Install it from the folder you downloaded it to. The file's name will include a version number:

   ```bash
   cd ~/Downloads
   sudo apt install ./foxglove-*.deb
   ```

1. Open it. It asks you to sign in, and a free account is all you need.

Next, install our own panels. They are built with Node.js, which a tool called [mise](https://mise.jdx.dev/getting-started.html) installs for you:

```bash
curl https://mise.run | sh
```

Close the terminal, open a new one, then:

```bash
cd ~/avbotz
git clone https://github.com/avbotz/foxglove-extensions.git
cd foxglove-extensions
mise trust
mise install
mise x -- npx --yes pnpm install
mise x -- npx --yes pnpm run local-install
```

If you get `mise: command not found`, use `~/.local/bin/mise` instead of `mise`. Restart Foxglove when that finishes.

[Run the simulator](/start-here/run-the-simulator/#drive-it-with-foxglove) shows you how to use it.

## Updating later

When you come back after other people have changed the code, this brings your copy up to date:

```bash
cd ~/avbotz/thalassic
git pull --recurse-submodules
pixi install --frozen
pixi run build
pixi run fetch-weights
```

Next: [run the simulator](/start-here/run-the-simulator/).
