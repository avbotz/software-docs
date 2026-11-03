---
title: Set up your computer
description: Get Linux, install Thalassic and its simulator, set up an editor and install Foxglove, step by step.
---

## What you need

- **A computer running Linux.** [Step 1](#step-1-get-linux) lists the options.
- **20 GB of free disk space:** about 8 GB for the build, plus the downloaded packages.
- **8 GB of RAM or more.** Building uses a lot of memory, so 16 GB is better.
- **OpenGL 4.3 graphics** for the simulator's window. Almost any laptop from the last ten years has it, even with only integrated graphics. Without it, the simulator runs with no window.
- **A good internet connection:** the first install downloads several GB.

## Step 1: Get Linux

Thalassic runs only on Linux; we use **Ubuntu 24.04 LTS**. Your options, best first:

| Option | Good | Bad |
| --- | --- | --- |
| **Ubuntu on its own computer**, such as an old laptop | Nothing to lose, and full speed | Needs a spare computer |
| **Dual boot** with Ubuntu beside Windows | Full speed. You pick which one to use at startup | Repartitions your disk, so back up first |
| **WSL 2** on Windows | Easy to install, nothing to repartition | Untested on the team |
| **A virtual machine** on Windows or Mac | Easy to delete and start over | Slow, and probably no OpenGL 4.3, so run the simulator without a window |

Ubuntu's [install guide](https://ubuntu.com/tutorials/install-ubuntu-desktop) also covers dual booting. For WSL, follow [Microsoft's guide](https://learn.microsoft.com/en-us/windows/wsl/install). For a virtual machine, try [VirtualBox](https://www.virtualbox.org/), or UTM on a Mac.

:::caution

On a family computer, ask before changing anything. **Back up everything important before dual booting:** a partitioning mistake can erase your files. If unsure, ask a lead to sit with you.

:::

## Step 2: Install git and curl

Open a terminal (on Ubuntu, press Ctrl-Alt-T) and run:

```bash
sudo apt update
sudo apt install git curl
```

`sudo` runs a command as the administrator, so it asks for your password. Nothing appears as you type it; press Enter when done.

:::danger[Do not install ROS 2 yourself]

Pixi installs the exact version we need, and a second copy from `apt` causes confusing errors. If you already have one, don't `source` it in a terminal you use for Thalassic.

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
- `git clone` downloads the code, and `--recurse-submodules` the other repositories Thalassic includes.
- `scripts/install.sh` does the rest. It is safe to rerun if interrupted.

`install.sh` prints a line as it starts each step:

| It prints | What is happening |
| --- | --- |
| `Installing pixi` | Installs [pixi](/concepts/build-tools/#pixi-installs-everything), the tool that manages everything else |
| `Fetching submodules` | Makes sure the submodules are there |
| `Creating the pixi environment` | Downloads ROS 2, the compilers and libraries, several GB in all |
| `Installing the git hooks` | Sets up the automatic checks that run when you commit |
| `Building the workspace` | Compiles all the code |
| `Downloading the model weights` | Downloads the trained neural networks |

The build prints many warnings, which are fine. A successful build ends like this:

```text
Summary: 18 packages finished [5min 14s]
  15 packages had stderr output: flir_camera_description flir_camera_msgs ...
Downloading the model weights
downloading  bins_blood.onnx (missing)
downloading  bins_fire.onnx (missing)
...
downloading  torp_find.onnx (missing)
```

"Had stderr output" means those packages printed warnings. If it stopped with `Failed <<<` or `Aborted`, see [Troubleshooting](/help/troubleshooting/#the-build-fails).

## Step 4: Check that it worked

Close your terminal and open a new one, so it picks up pixi. Then:

```bash
cd ~/avbotz/thalassic
pixi task list
```

It lists every pixi task:

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

Steps 5 and 6 can wait: [Run the simulator](/start-here/run-the-simulator/) needs them only for its Foxglove section.

## Step 5: Set up an editor

Any editor works. If you don't have a favorite, use [VS Code](https://code.visualstudio.com/docs/setup/linux), and open the code with:

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

[Editors](/thalassic/setup/#editors) explains why.

## Step 6: Install Foxglove

[Foxglove](https://foxglove.dev) shows the robot's cameras, graphs its signals, and lets you drive it by hand.

1. [Download Foxglove](https://foxglove.dev/download), choosing the Linux `.deb` file.
1. Install it. The file's name includes a version number:

   ```bash
   cd ~/Downloads
   sudo apt install ./foxglove-*.deb
   ```

1. Open it and sign in; a free account is enough.

Then install our own panels. They are built with Node.js, which [mise](https://mise.jdx.dev/getting-started.html) installs:

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

[Run the simulator](/start-here/run-the-simulator/#drive-it-with-foxglove) shows how to use it.

## Updating later

To pull in other people's changes:

```bash
cd ~/avbotz/thalassic
git pull --recurse-submodules
pixi install --frozen
pixi run build
pixi run fetch-weights
```
