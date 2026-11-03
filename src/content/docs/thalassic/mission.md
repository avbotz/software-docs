---
title: "Mission system"
description: "sub_mission: trees and missions, the competition run, running and monitoring a mission, the behavior tree nodes, how they command sub_control, and how a run ends."
---

`sub_mission` runs a mission: one BehaviorTree.CPP v4 XML file, the format Groot2 edits. C++ nodes provide the movement, vision and actuator primitives, and the XML composes them into tasks.

## Trees and missions

```
resources/
  trees/          # task library, one file per element: gate, slalom, bins,
                  #   torp, octagon, return_home, coin_flip, competition (the
                  #   shared 2026 run); and search, the searches the tasks
                  #   share (SweepCheck, ForwardSweepAlign, DownPatternScan)
  missions/       # runnable entrypoints
  Project.btproj  # Groot2 project covering both, open it to edit any tree
```

A _tree_ is a reusable task (`GateMission`, `SlalomMission`, ...), never selected directly. A _mission_ is an entrypoint you pass to `mission:=`; a single-task mission holds its nodes itself rather than wrapping a tree, so Groot2 shows them directly. Every file in `resources/trees/`, then in `resources/missions/`, is registered with the factory before the selected mission's `main_tree_to_execute` is created, so a mission can run any `BehaviorTree ID` from either directory as a `SubTree`. `hard_coded_competition`, for example, is `HardCodedGateMission`, `HardCodedSlalomMission` and `HardCodedTorpMission` (the missions `hard_coded_gate`, `hard_coded_slalom` and `hard_coded_torp`) in a `Sequence`.

IDs share one namespace: BT.CPP silently replaces a tree when a later file registers the same ID, so a test checks every ID is defined once. The selected mission file is registered last, so an edited copy passed by path may keep the packaged mission's ID and still win.

## Mission selection

The `mission` parameter is the name of a file in `resources/missions/` without `.xml` (read from the installed share directory), or a path to an XML file, which needs no rebuild. If it is missing or unknown, `mission` prints the available names and exits before waiting on the kill switch. `role` is `SURVEY` (the default) or `SEARCH`.

```bash
ros2 launch sub_bringup sim_launch.py mission:=pool_a
ros2 run sub_mission mission --ros-args -r __ns:=/marlin_v3 -p mission:=pid_tuning -p role:=SEARCH
ros2 run sub_mission mission --ros-args -r __ns:=/marlin_v3 -p mission:=/path/to/my_mission.xml
```

The launch files put `sub_mission` in the `robot_name` namespace (`/marlin_v3` by default). Started with `ros2 run`, `mission` and `restart` need the same namespace, or they publish `/motion_setpoint` while `sub_control` listens on `/marlin_v3/motion_setpoint`.

The packaged missions:

- `pool_a`, `pool_b`, `pool_c`, `pool_d`, `prelim`, `pool_test`, `vision_test` and `pid_tuning`.
- Single tasks, for testing: `bins_test`, `gate_test` (the coin flip and the gate), `gate_slalom_test`, `slalom_three_test` and `slalom_perception_hold_test` (the slalom model loaded, holding still).
- Dead-reckoned, without vision: `hard_coded_competition`, `hard_coded_gate`, `hard_coded_slalom`, `hard_coded_torp` and `hard_coded_octagon`.

`GateMission` replaces the `role` parameter with the role shown on the gate's left opening, which the vehicle passes through (`SelectGateRole`), and the slalom passes left of each red pipe to match. The bins tree drops in the fire bins (class `0`) for `SURVEY` and the blood bins (class `1`) for `SEARCH`. `bins_test` has no gate, so it uses the parameter.

## The competition run

The RoboSub 2026 task order (coin flip → gate → slalom → torpedoes → octagon → return home, with the sim-derived transit legs) lives in `trees/competition.xml` as `CompetitionRun`. The four `pool_*` missions differ only in a few pool-side numbers, so each is those numbers plus `<SubTree ID="CompetitionRun"/>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<root BTCPP_format="4" main_tree_to_execute="CompetitionPoolA">
  <BehaviorTree ID="CompetitionPoolA">
    <Sequence name="pool_a">
      <!-- Pool-side + strategy values; task trees read them as {@key}. -->
      <Script code="@gate_exit_yaw := 0.34906585;
                    @torp_search_yaw := -2.35619449;
                    @octagon_search_yaw := -0.61086524"/>
      <SubTree ID="CompetitionRun"/>
    </Sequence>
  </BehaviorTree>
</root>
```

- `Script` with the `@` prefix writes to the **root blackboard** (BT.CPP >= 4.6), which any subtree can read without port remapping.
- Only the coin flip may end the run. It looks for the gate ahead, then a quarter turn right, a half turn and a quarter turn left: heads only puts the AUV parallel to the gate (handbook 3.2.1), so the gate can be on either side. If all four attempts fail, `CoinFlipMission` returns `FAILURE`, which `CompetitionRun` does not wrap in `ForceSuccess`, so the run stops.
- Every later task (gate, slalom, torpedoes, octagon, return home) runs inside the same wrapper:

  ```xml
  <SavePose name="torp_entry" yaw="{@task_entry_yaw}"/>
  <Fallback name="torp">
    <Timeout msec="150000"><SubTree ID="TorpMission"/></Timeout>
    <SubTree ID="RecoverTaskEntry"/>
  </Fallback>
  ```

  `Timeout` is the task's wall-clock budget, sized so the tasks fit the handbook's 15 minutes of performance time. A task that fails or runs over is halted wherever it was, often mid-sweep; `RecoverTaskEntry` stops the vehicle and turns it back to the task's entry heading, so the next transit still heads along the course.

- Transit legs are `<SubTree ID="Transit" z="-1.0" x="3.0" y="-1.0"/>`: `Stop` whatever the last task left running, take the depth, hop `x` forward and `y` left. A transit move that times out is logged and the run carries on.
- Missions and trees are plain BT.CPP XML (`Repeat`, `Timeout`, `Fallback` and the rest), with no custom schema.

To run a subset (say the gate only), copy a mission file, replace `<SubTree ID="CompetitionRun"/>` with the `SubTree`s you want, and point `mission:=` at it.

## Pool-side values

Trees read pool-side values from root blackboard entries (`<AttSetpoint yaw="{@gate_exit_yaw}"/>`), which each pool mission sets in its `Script` node:

| Entry                | Pools A/D   | Pools B/C   | Used by |
| -------------------- | ----------- | ----------- | ------- |
| `gate_exit_yaw`      | 0.34906585  | -0.34906585 | gate    |
| `torp_search_yaw`    | -2.35619449 | 2.35619449  | torp    |
| `octagon_search_yaw` | -0.61086524 | 0.61086524  | octagon |

The yaws are odom yaws in radians, counter-clockwise from the start heading, like every yaw in the trees ([Frames](#frames)). A test checks that every mission running `CompetitionRun` sets all three.

The gate is not pool-side data: the vehicle always takes the gate's left opening and adopts the role its images show ([Mission selection](#mission-selection)).

New pool-dependent numbers (headings, distances, depths) follow the same pattern: assign `@key` in each pool mission's `Script` and read it with `{@key}` in the task tree, instead of branching on a condition node.

## Restart supervisor

`sub_mission/restart` supervises competition runs without executing the tree. At each kill-switch release it spawns `sub_mission/mission` as a child process, and it stops the child when the sub is killed, so every release starts a fresh mission from the beginning, however the last run ended.

It takes the same parameters as `mission`:

```bash
ros2 run sub_mission restart --ros-args -r __ns:=/marlin_v3 -p mission:=pool_a -p role:=SURVEY
```

Each child is named `sub_mission`, as in the launch files, and gets `restart`'s namespace (if any) and its `mission`, `role`, `groot_port` and `use_sim_time`:

```bash
ros2 run sub_mission mission --ros-args -r __node:=sub_mission -r __ns:=/marlin_v3 -p mission:=<value> -p role:=<value> -p groot_port:=<value> -p use_sim_time:=<value>
```

`restart` exits at startup (FATAL) on an empty `mission`, a bad `role` or `groot_port`, or a missing mission file. Only the child loads the tree, after the release, so XML errors surface there.

Use `restart` for diver resets: kill the sub, put it back at the start, release the kill switch, and the mission starts over. Use `mission` directly for bench tests, XML smoke tests and debugging, where an automatic restart would hide the failure.

| Limitation | Detail |
| --- | --- |
| Restart granularity | Restarts the whole selected mission, not the current subtree |
| State persistence | Blackboard values come from XML parameters/scripts each run; runtime BT state is discarded |
| Stop behavior | Any kill, even one shorter than its 0.5 s poll, stops the run: `SIGINT` to the mission's process group, up to 3 s for the whole group to exit, then `SIGTERM` and `SIGKILL` if needed. Each child's exit status or signal is logged |
| Parameter forwarding | `restart.cpp` forwards only the parameters above; a new mission parameter must be added there |

## Live monitoring (Groot2)

`mission` serves its tree to Groot2's Monitor mode on TCP port `groot_port` (5555 by default) and the next port (5556). In Groot2, switch to Monitor and connect to port 5555 on `localhost` in simulation, or on the Jetson's `192.168.5.245` ([Networking](/thalassic/networking/)). Groot2 shows each node's status as the tree ticks; finished nodes are drawn faded, in their final status.

```bash
ros2 launch sub_bringup sim_launch.py mission:=pool_a                   # live view on 5555
ros2 launch sub_bringup sim_launch.py mission:=pool_a groot_port:=5565  # on 5565 (and 5566)
ros2 launch sub_bringup sim_launch.py mission:=pool_a groot_port:=0     # no live view
ros2 run sub_mission mission --ros-args -r __ns:=/marlin_v3 -p mission:=pool_a -p groot_port:=5565
```

| Behavior | Detail |
| --- | --- |
| When it is up | From when the tree loads, before the kill-switch release. Under `restart`, each run's process loads the tree at the release, so the view is down between runs: reconnect after each release |
| End of a run | The view stays up 2 s after the tree finishes or a kill ends the run, showing where it ended, then the process exits. `SIGINT` and `SIGTERM` skip the wait, so under `restart` a kill takes the view down within its 0.5 s poll |
| Port taken | `mission` logs a warning and runs without the view, e.g. when a leftover mission process holds the port. A `groot_port` above 65534 (the view needs the next port too) or below 0 is FATAL at startup |
| Groot2 edition | The free edition monitors trees of up to 20 nodes. `prelim` (7), `pid_tuning` (10), `pool_test` (13), `vision_test` (3), `slalom_perception_hold_test` (3) and the single `hard_coded_*` tasks (4 to 9) fit; the `pool_*` missions have 277 nodes, `bins_test` 157, `gate_slalom_test` 64, `slalom_three_test` 49, `gate_test` 37, and `hard_coded_competition` 30. Larger trees, the blackboard view and breakpoints need Groot2 PRO |
| Breakpoints (PRO) | A breakpoint pauses the tick, so the mission sees a kill or interrupt only once it is released (`sub_control` drops commands while killed regardless). Groot2Publisher releases every breakpoint after 5 s without contact from Groot2 |

Groot2 is not in the pixi environment: download it from [behaviortree.dev](https://www.behaviortree.dev/groot/). It shows the tree `mission` is running, not `Project.btproj`.

## Behavior tree XML

XML holds mission logic: ordering, fallbacks and retries, pool-specific branches, and calls to reusable nodes. C++ holds the ROS-facing mechanics: publishing commands, waiting on control error, and any nontrivial state. Every custom node has a C++ implementation, and hardware commands go through typed ROS topics, services or actions, never direct serial writes.

### Movement nodes

| BT node | Behavior |
| --- | --- |
| `PosSetpoint` | Position or depth target; waits until it is reached ([Completion semantics](#completion-semantics)) |
| `VelocitySetpoint` | Linear velocity along the heading; unset axes keep holding |
| `AltitudeSetpoint` | DVL altitude target; waits until it is reached |
| `AttSetpoint` | Attitude target; waits until it is reached |
| `AngularVelocitySetpoint` | Angular velocity; unset axes keep holding |
| `MoveRelative` | Move forward/left/up relative to the commanded heading |
| `MoveRelativePos` | Move along odom's x, y and z, whatever the heading |
| `NavigateToTransform` | Move so one vehicle frame takes another's position, e.g. the dropper onto where the down camera is ([Transform navigation](#transform-navigation)) |
| `TimedVelocity` | Linear velocity along the heading for a fixed time, then hold |
| `AddAttSetpoint` | Relative roll/pitch/yaw target |
| `Spin` | Turn through a yaw distance at a set rate, braking into the final heading |
| `Stop` | HOLD x, y, z and yaw where they come to rest, ending any velocity or spin still running |
| `SavePose` | Write the x, y and/or yaw targets to the blackboard (gate home, a task's entry heading) |
| `WaitUntilHit` | Wait for velocity feedback to drop after a velocity command |
| `SweepAngle` | Sweep yaw (ahead, 40° and 80° right, 80° and 40° left, ahead). At the first heading where `attempts` front-camera frames see the target, write their average yaw toward it (each from the heading it was seen on) to `yaw`. `side` limits it to a target on one side of `reference_yaw` |
| `SearchForDetection` | Move at a fixed velocity, holding the heading, until a detection; or sweep left, then right |
| `AlignToDetection` | Turn (and optionally change depth) until a front-camera detection's bearing is within `tolerance` |
| `ForwardContinuousAlign` | Move forward at a fixed velocity, steering toward a front-camera detection, until it is close, lost or passed, or `max_dist` or `timeout_msec` runs out |
| `ForwardFixedTransit` | Move forward at a fixed velocity through something ranged before (the gate, a slalom opening), by odometry |
| `LateralAlignToDetection` | Center a front-camera detection by moving sideways (and in z), keeping the heading; locks one odom target, moves at a fixed speed, or steps |
| `SelectGateRole` | Set the role from the gate's left opening |
| `SquareUpToGate` | Line up `standoff` in front of the gate's left opening, on its normal and facing through it, however the gate is turned ([Squaring up to the gate](#squaring-up-to-the-gate)) |
| `OrientToDetectionAtDist` | Square up to an object's face (`heading_yaw_deg`) at a set distance, looking at its center |
| `OctagonSurfaceSweep` | Turn in steps until an image to surface at is in view, then rise |
| `DownForwardAlign`, `DownForwardSweepAlign` | Move forward while centering a down-camera detection; the sweep zigzags along a track until it sees one |
| `DownSweepAlign` | Search sideways over the down camera, right of the start and then left |
| `DownAlignToDetection`, `DownContinuousAlign` | Center a down-camera detection, optionally hold distance/depth, and yaw to orientation metadata (the second name is an alias) |

### Vision nodes

The nodes that read detections without moving:

| BT node | Kind | Behavior |
| --- | --- | --- |
| `LoadModel` | action | Asks the camera's `sub_vision` node to activate a task's detector (async `load_model` service call; no-op if already active) |
| `DetectionVisible` | condition | `SUCCESS` iff a matching detection newer than `max_age_msec` exists |
| `WaitForDetection` | action | Waits up to `timeout_msec` for a matching detection that arrived **after the node started**, so a stale frame cannot satisfy it |

Only `LoadModel` loads a model, so a tree calls it before the search or align that needs it, which also keeps the active model visible in the tree. It passes the task name (`task="gate"`) to `sub_vision` unchanged.

Vision nodes filter detections by `camera`, `task`, `class_id` and `min_score` ([Detections](/thalassic/vision/#detections)); `LoadModel` takes only `camera` and `task`. The nodes that steer on a front-camera bearing (`AlignToDetection`, `LateralAlignToDetection`, `SweepAngle`, `ForwardContinuousAlign`, `OrientToDetectionAtDist`, `SquareUpToGate`) fail on `camera="down"`, and so do the searches built on `SweepAngle`. The `Down*` nodes read the down camera and have no `camera` port. A camera other than `front` or `down` fails the node.

Detections arrive as `sub_vision_interfaces/DetectionArray` on `vision/detections` (`vision/detections_down` for the down camera), cached per camera by `VisionClient` (`src/vision_client.cpp`). The steering signal is each detection's `bearing_horizontal`/`bearing_vertical`, which `sub_vision` computes from the camera intrinsics (positive = right of / below center). The vision nodes (`src/nodes/vision.cpp`) turn them into the mission's frames: a target right of center is a smaller yaw (clockwise), and one below center on the front camera a smaller z.

`AlignToDetection` re-targets yaw (and optionally depth) once per new camera frame. It references its absolute targets to the _measured_ state (`odometry/filtered`), so re-issuing a command on every frame converges instead of integrating the correction. Its other ports: `yaw` (default true), `depth` (default false), `tolerance` (rad), `depth_gain` (m of depth per rad of vertical bearing), `max_depth_step`, `timeout_msec`.

Vision alignment never steers above z = −0.5 (`MAX_VISION_Z` in `vision.cpp`), so a range missing from a detection, or one held from a target the pool is too shallow for, cannot drive the sub through the surface. Surfacing is always an explicit, unbounded z in the tree: a `PosSetpoint`, as at the octagon, or `OctagonSurfaceSweep`'s `surface_z`.

### Shared searches

`trees/search.xml` composes the searches the tasks share from these nodes. Trees run them as SubTrees, e.g. `<SubTree ID="SweepCheck" task="octagon_table" class_id="" min_score="0.6"/>`:

| SubTree | Behavior |
| --- | --- |
| `SweepCheck` | `SweepAngle`, then `AttSetpoint` to the yaw it found |
| `ForwardSweepAlign` | `SweepAngle` up to `num_sweeps` times with a `forward_step` `MoveRelative` between sweeps (none after the last), then `AttSetpoint` to the yaw found. A forward move that does not arrive ends it with `FAILURE`; a sweep cut short by a yaw step that does not arrive counts as one that saw nothing |
| `DownPatternScan` | `WaitForDetection` on the down camera at the start and at five points around it, (forward, left) of the start in `movement_dist`: (−1, −1), (0, 2), (2, 0), (0, −2), (−1, 1). Each point is a `MoveRelative` from the one before, along the heading the scan started on; a move that does not arrive samples where it got to. `SUCCESS` where a frame shows the target, else back to the start (`SavePose`, `PosSetpoint`) and `FAILURE` |

An omitted setting takes the default from the file's `TreeNodesModel`, which BT.CPP applies to SubTrees and Groot2 displays. `task` and `class_id` have no default, so a SubTree without them fails to load; `class_id=""` takes any class.

### Vision tasks in XML

Task-specific perception behavior ("align with the gate") is XML in `resources/trees/`, composed from the generic [vision nodes](#vision-nodes), not new C++. From `trees/gate.xml`:

```xml
<BehaviorTree ID="AlignWithGate">
  <ForceSuccess>
    <Sequence name="align_with_gate">
      <LoadModel task="gate"/>
      <WaitForDetection task="gate" class_id="8" timeout_msec="15000"/>
      <AlignToDetection task="gate" class_id="8" tolerance="0.05" timeout_msec="30000"/>
    </Sequence>
  </ForceSuccess>
</BehaviorTree>
```

`missions/vision_test.xml` (`LoadModel` + `WaitForDetection`) is the smoke test for the mission↔vision path: run it with `sub_vision` and a camera running, release the kill switch, and it succeeds once the detector sees the task object. It commands no motion, but `sub_control` holds the vehicle while it runs, so run it in the water or the sim, not on the bench.

### Transform navigation

`NavigateToTransform` moves the vehicle so `target_frame` takes the position `source_frame` has now. Both are frames of the vehicle's description (`src/sub_bringup/config/vehicles/<robot_name>.yaml`), looked up in `base_link` on `/tf_static` under the node's namespace (`marlin_v3/front_camera`). The move is relative, by source minus target (`horizontal_only` keeps z), and does not turn the vehicle. The torpedo tree moves `torpedo_0_link` onto where `front_camera` was when it was centered on the target, then `torpedo_1_link` onto a point 0.15 m left of it; the bins tree moves `dropper_link` onto where `down_camera` was when it was centered on a bin. A frame that is not published fails the node.

### Squaring up to the gate

The gate may be turned relative to the course (30° from the start heading in the sim's area A/B1), so `GateMission` crosses along the gate's normal, not the heading the coin flip left:

1. `PosSetpoint z="-0.7"`: to where the role panels hang a little above the camera (the coin flip already leaves it there).
1. `SearchForDetection` and `SelectGateRole` find the left opening and read its role.
1. `SquareUpToGate` lines up 2 m (`standoff`) in front of the left opening, on its normal and facing through it. With both panels in view, the gate post-processor ranges each from its icons' heights, which a turned gate does not shrink, and gives the turn that would square the camera to the gate (`heading_yaw_deg`). Each frame is placed in odom from where the camera was when it was taken (`MissionNode::horizontalPoseAt`, from the last 3 s of odometry and the `front_camera` mount), and the gate is the median of the last 25 frames' facings and left-panel positions. Until `min_facing_frames` frames have shown both panels, it turns to keep both in view and backs off to `look_distance` if the gate is closer. It then moves to the standoff point looking at the middle of the gate, so both panels stay in view and keep refining the estimate, turns square, and finishes once within `position_tolerance` and `yaw_tolerance_deg` for `settle_msec`. If no frame ever shows both panels, after `facing_timeout_msec` it takes the gate to face back along the line of sight to the left panel.
1. `PosSetpoint z="-1.2"`: below the panels and the divider, so only the posts are left to clear.
1. `MoveRelative x="3.0"`: along the gate's normal, the 2 m standoff plus 1 m. Starting from the standoff point, it crosses the gate's line at the left opening even if the estimated facing is a few degrees off; only the crossing angle suffers.

### Ports and the TreeNodesModel

Ports in XML must match the C++ `providedPorts()`: BehaviorTree.CPP rejects unknown ports when it creates the tree. It also reads an attribute that looks like a number as one, and the tree loads only if that matches the port's type: a decimal setting needs its decimal point (`forward_step="1.0"`), and a numbered class comes from a `Script` (`fire_class := '0'`, then `class_id="{fire_class}"`), as in `torp.xml` and `bins.xml`.

When editing in Groot2, keep the `TreeNodesModel`s of `Project.btproj`, `resources/missions/*.xml` and `resources/trees/*.xml` in sync. They list custom nodes only, plus the SubTree models of `trees/search.xml`, whose defaults BT.CPP takes from that file. Built-in nodes (`Sleep`, `Repeat`, `Fallback`, `Sequence`, `Inverter`, the decorators) must not be registered there; Groot2 already has them.

## Control interface

The mission commands `sub_control`, never the low-level board:

| Topic | Type | Use |
| --- | --- | --- |
| `motion_setpoint` | `sub_control_interfaces/MotionSetpoint` | Every movement command: a mode per axis (position, velocity, hold) and its target, with a fresh `id` each |
| `control/error` | `sub_control_interfaces/Error` | Position, velocity, attitude, and angular-rate tracking error, and the id of the last command `sub_control` took up |
| `odometry/filtered` | `nav_msgs/Odometry` | The measured pose, where vision alignment, and relative moves on an axis without a target, start from |
| `kill_switch` | `std_msgs/Bool` | Low-level kill state, published by `sub_low` (`sim_kill_switch` in simulation) |
| `control/armed` | `std_msgs/Bool` | Latched by `sub_control`: the run starts only once it is armed |

`SetpointPublisher` (`commands.hpp`) gives each command its `id`. `MissionNode` counts a `control/error` as an update (`control_error_updates`) only when it carries the last command's id and `sub_control` did not reject it: an earlier error is about the previous command, and would read as arrival. A rejected command is logged and its move times out. Mission velocities have no timeout: they last until replaced, and `MissionNode` sends a stop when the run ends ([Control system](/thalassic/control/#command-interface)).

### Frames

The mission uses `sub_control`'s frames (REP-103) everywhere (C++, trees, ports and blackboard entries) with no conversion: `commands.hpp` copies targets into `MotionSetpoint` unchanged, and `odometry/filtered` and `control/error` are used as they arrive.

| Values | Frame |
| --- | --- |
| Positions: `PosSetpoint`, `SavePose`, `Transit`'s `z`, `OctagonSurfaceSweep`'s `surface_z` | `odom`, ENU. x and y are zero where the kill switch was released, x along the heading there; z is up, so 1 m deep is `z="-1.0"` |
| Yaws: `AttSetpoint`, `SavePose`, `SweepAngle`, the pool headings | `odom`, counter-clockwise from the heading at the release |
| Relative moves and rates: `MoveRelative`, `VelocitySetpoint`, `TimedVelocity`, `SearchForDetection`, `LateralAlignToDetection`'s target offsets, `AddAttSetpoint`, `AngularVelocitySetpoint`, `Spin`, `OctagonSurfaceSweep` | Body FLU along the heading: x forward, y left, z up; a positive yaw turns left |
| `MoveRelativePos` | odom's axes |
| `AltitudeSetpoint`'s `z` | Height above the bottom |
| Roll and pitch | FLU: positive roll lowers the right side, positive pitch the nose |
| `sub_vision` bearings | Camera-optical, positive right of / below the image center; `vision.cpp` converts them where it steers on them |
| `sub_vision` yaw metadata (`yaw_deg`, `heading_yaw_deg`) | Counter-clockwise from the heading, used as is |

Ports named for depth (`AlignToDetection`'s `depth`, `depth_gain` and `max_depth_step`, `LateralAlignToDetection`'s `align_depth` and `max_depth_step`) are flags or gains, never signed values: every vertical value is a z.

### Axes and targets

Each command sets only the axes it names and leaves the rest as they were (`commands.hpp`): `VelocitySetpoint x="0.25"` drives forward while depth and heading stay held. The exception is x and y, which go together: setting one velocity sets the other to zero, and setting one position keeps the other at its target. All commands go out on one topic, so `sub_control` applies them in the order sent, and it smooths every target into a trajectory, so a step in the XML is a smooth move on the vehicle.

The mission remembers the position and attitude targets it sent (`MissionNode::commanded_pos`, `commanded_att`), so relative commands (`MoveRelative`, `AddAttSetpoint`, the sweeps) add to the target, not to wherever the vehicle has drifted. An axis set to a velocity has no target until given one, so a relative command on it starts from the measured pose, as vision alignment always does. Targets are cleared at the kill-switch release, when `sub_control` holds wherever the vehicle is. A `reset_pose` mid-mission (the Tuning Routines panel's Zero pose) re-zeroes x, y and yaw, but leaves the mission's remembered targets in the old frame.

`AltitudeSetpoint` publishes a z position with `altitude=true`, so z is the height above the bottom from the DVL; `sub_control` falls back to holding depth if the DVL loses the bottom. Later commands that leave z unset keep the altitude hold, and a `MoveRelative` z offset moves the altitude target (positive raises it). `sub_control` rejects a whole command with an altitude target below 0, or an altitude hold without DVL bottom lock, and keeps the old target. The rejection shows in `control/error`, so the move times out rather than succeeding on the old target's error. To fail fast instead, `AltitudeSetpoint` fails up front on a z at or below 0, and `MoveRelative`, `MoveRelativePos` and `NavigateToTransform` on an altitude target below 0.

## Completion semantics

Position and attitude commands return `RUNNING` until `control/error` carrying their command's id ([Control interface](#control-interface)) is within `POSITION_TOLERANCE` (0.25 m) and `ANGLE_TOLERANCE` (5°) in `commands.hpp`. These are C++ constants, not XML ports, to keep mission XML about task logic.

`PosSetpoint`, `MoveRelative`, `MoveRelativePos`, `NavigateToTransform`, `AltitudeSetpoint`, `AttSetpoint`, `AddAttSetpoint` and `Spin` return `FAILURE` after `timeout_msec`. At 0 (the default) the timeout scales with the move: 20 s to settle plus the move at about a third of `sub_control`'s speed limits (0.15 m/s horizontal, 0.1 m/s vertical, 0.2 rad/s), e.g. 47 s for a 4 m hop and 36 s for a half turn. `AltitudeSetpoint`, which does not know its starting altitude, allows 41 s, enough for the whole 2.1 m water column. A move blocked by a current or a dead thruster therefore fails and the tree decides what to do, instead of the run stalling. A timed-out `Spin` holds the heading it reached. Timeouts and `TimedVelocity`'s duration run on the steady wall clock, not ROS time.

A port whose blackboard entry is missing (`x="{@gate_home_x}"` before anything set it) fails the node with an error naming the port, rather than commanding 0. This holds for every port of the nodes in `src/nodes/actions/`, `SearchForDetection` and `ForwardFixedTransit`, and for the detection filter (`camera`, `task`, `class_id`, `min_score`) of the other vision nodes but `LoadModel`; their remaining ports (gains, distances, timeouts) keep the port's default.

`VelocitySetpoint` and `AngularVelocitySetpoint` are open-loop: they return `SUCCESS` once published. For a completion condition, follow them with `WaitUntilHit` or a position/attitude hold. `WaitUntilHit` measures the speed against the commanded velocity, so the vehicle must be up to speed first (e.g. a `Sleep` after the `VelocitySetpoint`): started below 0.03 m/s, it succeeds at once. No packaged tree uses it.

`Spin` turns at a yaw velocity, integrating the measured yaw rate from `control/error` over ROS time (the simulator's clock in simulation). From π/2 before the end it holds the final heading instead, which `sub_control`'s trajectory brakes into; stopping the velocity at the end would overshoot by the braking distance and pull back.

The vision nodes that move at a velocity (`SearchForDetection`, `ForwardContinuousAlign`, `ForwardFixedTransit`, `LateralAlignToDetection`) end with a HOLD on the axes they moved, whether they succeed, fail or are halted. `DownForwardAlign` and `DownForwardSweepAlign`, whose position targets run ahead of the vehicle, HOLD x and y when they run out of distance or time or are halted, and the sweep also when it finds a detection; `DownSweepAlign` holds x and y where a detection comes into view mid-move.

## Starting and ending a run

A run starts once the kill switch is released, `sub_control` is armed (`control/armed`: it holds off while the state estimate, the IMU or depth is missing, and logs which), and 7 s more have passed for the ESCs; `mission` logs what it is waiting for.

If the kill switch engages during a run, `mission` halts the tree and exits rather than failing through every remaining task. Even a brief kill ends the run: `sub_control` drops all commands while killed and re-zeroes the pose at the release, so nothing the tree was doing still applies. Under `restart`, the release starts the mission over. The nodes that move the sub also fail immediately when killed; the passive ones (`LoadModel`, `DetectionVisible`, `WaitForDetection`) do not check.

Whatever the tree's result, `mission` then sends a `Stop` (a HOLD on x, y, z and yaw), so no velocity or spin carries on and the vehicle holds where it is, submerged: breaching the surface outside the octagon ends a RoboSub run. `SIGINT` or `SIGTERM` (Ctrl-C, launch shutdown, `restart`) ends the run the same way, between ticks: the tree is halted and the `Stop` sent. `mission` exits non-zero only when the mission cannot be loaded or the node fails at startup (a bad `role` or `groot_port`).

Which task failures end a competition run is up to the tree: see [The competition run](#the-competition-run).

## Tests

```sh
pixi run colcon test --packages-select sub_mission && pixi run colcon test-result --verbose
```

`test/test_mission.cpp` loads every file in `resources/missions/` against the registered C++ nodes, so a port the XML sets but the node no longer declares fails here, not on the pool deck. It also drives the movement and vision nodes, `Transit`, `RecoverTaskEntry` and the searches in `trees/search.xml` against a scripted `control/error` and camera frames, and checks which way they move the vehicle; no other ROS node needs to be running.
