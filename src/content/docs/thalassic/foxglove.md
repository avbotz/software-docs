---
title: "Foxglove"
description: "Connecting, the extensions, and the teleop, tuning and autonomy layouts."
---

Driving, tuning and watching the vehicle from a laptop is done in [Foxglove](https://foxglove.dev), over the `foxglove_bridge` that every launch file starts. Open a _Foxglove WebSocket_ connection to `ws://localhost:8765` for the simulator, or `ws://192.168.5.245:8765` for the vehicle ([Networking](/thalassic/networking/)); the `foxglove_port` launch argument changes the port ([Setup & Build](/thalassic/setup/#launch-arguments)).

## Extensions

The panels that drive and tune `sub_control` and show `sub_vision`'s detections are the three extensions in [avbotz/foxglove-extensions](https://github.com/avbotz/foxglove-extensions), checked out beside this repository as `../foxglove-extensions`: teleop (6-DOF Teleop, Motion Setpoint), tuning (Controller Gains, Tuning Routines, Controller Signals) and vision (Detections, and a converter that lets Foxglove's own Image panel draw the detections as annotations). `pnpm run local-install` there installs them in the desktop app; their READMEs explain the panels.

## Layouts

`src/sub_bringup/foxglove/` has a layout for each job, for the simulator and for the vehicle. Import one with _Layouts → Import from file_; it becomes a personal layout named after the file.

| Layout | For | Shows |
| --- | --- | --- |
| `teleop` | Driving by hand | 6-DOF Teleop; both cameras, every frame, with the detections drawn; Motion Setpoint, diagnostics and the log in tabs |
| `tuning` | [Tuning `sub_control`](/thalassic/control/#tuning) | Controller Gains and Tuning Routines; a tab per axis with Controller Signals graphs (target / reference / measured, tracking error, wrench / disturbance); the thruster commands; diagnostics and the log |
| `autonomy` | Watching a mission run | Arming, kill, failsafe and sensor state; both cameras with the detections, on the frames the detector processed; depth and heading graphs; a top-down map in odom; the position error and each axis's mode over time; the log, diagnostics, Motion Setpoint (to take over: _Hold_ stops the vehicle) and the raw detections in tabs |

The `_sim` files add **KILL** and **RELEASE** buttons for the simulator's kill switch (`sim/kill_switch`) and the robot model on the map. The vehicle's down camera sends a Bayer mosaic, which its JPEG copy stores as a grey image; for colour, add an Image panel on `down_camera/image_raw`.

### Changing them

The layouts are plain JSON files. To change one, make the change in Foxglove, export the layout and save it over the file. The `_sim` and `_vehicle` files are separate, so make the change in both.

Foxglove names an extension's panels `<display name>.<panel name>` when the extension is installed from its `.foxe` file, which is what the layouts use (`AVBotz Teleop.6-DOF Teleop`). An extension published to an organization is named `org:<publisher>:<name>` instead.
