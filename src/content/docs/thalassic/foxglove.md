---
title: "Foxglove"
description: "Connecting, the extensions, and the teleop, tuning and autonomy layouts."
---

The vehicle is driven, tuned and watched from a laptop in [Foxglove](https://foxglove.dev), through the `foxglove_bridge` that every launch file starts.

## Connecting

Open a _Foxglove WebSocket_ connection to `ws://localhost:8765` for the simulator, or `ws://192.168.5.245:8765` for the vehicle ([Networking](/thalassic/networking/)). The `foxglove_port` launch argument changes the port ([Setup and build](/thalassic/setup/#launch-arguments)).

## Extensions

The panels for `sub_control` and `sub_vision` come from the three extensions in [avbotz/foxglove-extensions](https://github.com/avbotz/foxglove-extensions), checked out beside this repository as `../foxglove-extensions`:

| Extension | Panels |
| --- | --- |
| teleop | 6-DOF Teleop, Motion Setpoint |
| tuning | Controller Gains, Tuning Routines, Controller Signals |
| vision | Detections, and a converter that lets Foxglove's own Image panel draw the detections as annotations |

`pnpm run local-install` there installs them in the desktop app; their READMEs describe the panels.

## Layouts

`src/sub_bringup/foxglove/` has a layout for each job, for the simulator and for the vehicle. Import one with _Layouts → Import from file_; it becomes a personal layout named after the file.

| Layout | For | Shows |
| --- | --- | --- |
| `teleop` | Driving by hand | 6-DOF Teleop; both cameras, every frame, with the detections drawn; Motion Setpoint, diagnostics and the log in tabs |
| `tuning` | [Tuning `sub_control`](/thalassic/control/#tuning) | Controller Gains and Tuning Routines; a tab per axis with Controller Signals graphs (target / reference / measured, tracking error, wrench / disturbance); the thruster commands; diagnostics and the log |
| `autonomy` | Watching a mission run | Arming, kill, failsafe and sensor state; both cameras with the detections, on the frames the detector processed; depth and heading graphs; a top-down map in odom; the position error and each axis's mode over time; the log, diagnostics, Motion Setpoint (to take over: _Hold_ stops the vehicle) and the raw detections in tabs |

The `_sim` files add **KILL** and **RELEASE** buttons for the simulator's kill switch (`sim/kill_switch`) and the robot model on the map. The vehicle's down camera sends a Bayer mosaic, which its JPEG copy stores as a grey image; for colour, add an Image panel on `down_camera/image_raw`.

### Changing a layout

The layouts are JSON. Make the change in Foxglove, export the layout over its file, then make the same change in its `_sim` or `_vehicle` counterpart.

The layouts name panels `<display name>.<panel name>` (`AVBotz Teleop.6-DOF Teleop`), as Foxglove does for an extension installed from its `.foxe` file; one published to an organization is named `org:<publisher>:<name>` instead.
