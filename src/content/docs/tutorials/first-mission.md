---
title: Write a mission
description: Write your own behavior tree in XML and watch the robot follow it in the simulator.
---

A mission is the robot's plan for a run. Writing one needs no programming, only a [working simulator](/start-here/run-the-simulator/). [Behavior trees](/concepts/behavior-trees/) explains the ideas behind it.

## Your first mission

Make a folder outside the repository and open it in your editor:

```bash
mkdir -p ~/avbotz/playground
code ~/avbotz/playground
```

Create a file in it called `my_first_mission.xml`:

```xml title="my_first_mission.xml"
<?xml version="1.0" encoding="UTF-8"?>
<root BTCPP_format="4" main_tree_to_execute="MyFirstMission">
  <BehaviorTree ID="MyFirstMission">
    <Sequence name="my_first_mission">
      <PosSetpoint z="-1.0"/>
      <MoveRelative x="2.0"/>
      <AddAttSetpoint yaw="1.57079633"/>
      <MoveRelative x="1.0"/>
      <Sleep msec="3000"/>
      <PosSetpoint z="-0.5"/>
    </Sequence>
  </BehaviorTree>
</root>
```

| Line | Meaning |
| --- | --- |
| `<root ... main_tree_to_execute="MyFirstMission">` | This file's main tree is the one called `MyFirstMission` |
| `<Sequence>` | Do the steps inside, in order. Stop if one fails |
| `<PosSetpoint z="-1.0"/>` | Go to a depth of 1 m. z is up, so underwater is negative. Wait until it gets there |
| `<MoveRelative x="2.0"/>` | Swim 2 m forward. In `MoveRelative`, x is forward, y is left and z is up |
| `<AddAttSetpoint yaw="1.57079633"/>` | Turn 90° to the left. Angles are in radians, so π/2 ≈ 1.5708 is 90° |
| `<Sleep msec="3000"/>` | Wait for 3 seconds |

[Coordinates](/concepts/coordinates/) explains x, y, z and radians.

## Run it

```bash
cd ~/avbotz/thalassic
pixi run up -- mission:=$HOME/avbotz/playground/my_first_mission.xml
```

Once the kill switch releases and the thrusters start, the robot dives, swims forward, turns left, swims a little more, and rises. The mission's lines, without timestamps:

```text
[mission-4] [INFO] [marlin_v3.sub_mission]: Sub is killed, waiting...
[mission-4] [INFO] [marlin_v3.sub_mission]: Kill switch released
[mission-4] [INFO] [marlin_v3.sub_mission]: Wait for motors to start up
[mission-4] [INFO] [marlin_v3.sub_mission]: Executing mission '.../my_first_mission.xml'
[mission-4] [INFO] [marlin_v3.sub_mission]: Published position command: xyz=(nan, nan, -1.000)
[mission-4] [INFO] [marlin_v3.sub_mission]: MoveRelative: offset=(2.000, 0.000, 0.000) target=(1.998, 0.013, nan)
[mission-4] [INFO] [marlin_v3.sub_mission]: Published additive attitude target rpy=(nan, nan, 1.570)
[mission-4] [INFO] [marlin_v3.sub_mission]: MoveRelative: offset=(1.000, 0.000, 0.000) target=(1.999, 1.013, nan)
[mission-4] [INFO] [marlin_v3.sub_mission]: Published position command: xyz=(nan, nan, -0.500)
[mission-4] [INFO] [marlin_v3.sub_mission]: Mission '.../my_first_mission.xml' finished with SUCCESS.
[mission-4] [INFO] [marlin_v3.sub_mission]: Stop: holding x, y, z and yaw where they come to rest.
```

`Sub is killed, waiting...` repeats until the release. `nan` ("not a number") means "leave this axis alone".

In the last `MoveRelative` line the robot faces left, so 1 m forward moves the target in _y_, from about 0 to about 1: forward depends on the robot's heading, but the target's x and y are fixed to the pool.

When the mission ends, the robot holds still and the rest of the stack keeps running. Press Ctrl-C to stop it.

:::tip[Show only the mission's lines]

```bash
pixi run up -- mission:=$HOME/avbotz/playground/my_first_mission.xml | grep "mission-"
```

:::

## Change it

A mission needs no rebuild: save the file and run it again. Try:

1. Make it go deeper, or further.
1. Make it turn right instead of left.
1. Make it turn left with `AttSetpoint yaw="1.57079633"` instead of `AddAttSetpoint`. `AttSetpoint` turns to an absolute heading, so sending the same one twice turns only once; `AddAttSetpoint` turns relative to the current target.

## Repeat: swim a square

`Repeat` runs what is inside it several times. Save this as a new file:

```xml title="my_square_mission.xml"
<?xml version="1.0" encoding="UTF-8"?>
<root BTCPP_format="4" main_tree_to_execute="MySquareMission">
  <BehaviorTree ID="MySquareMission">
    <Sequence name="my_square_mission">
      <PosSetpoint z="-1.0"/>
      <Repeat num_cycles="4">
        <Sequence name="one_side">
          <MoveRelative x="1.5"/>
          <AddAttSetpoint yaw="1.57079633"/>
        </Sequence>
      </Repeat>
    </Sequence>
  </BehaviorTree>
</root>
```

The robot ends up near where it started, facing the same way.

In each file, `ID` and `main_tree_to_execute` must match, and must not be the name of a tree that already exists.

## Fallback: when things go wrong

A `Fallback` tries its children in order until one succeeds, which gives a mission a plan B.

Every move has a time limit (`timeout_msec`). This mission tries a trip far too long to finish in 5 seconds:

```xml title="my_fallback_mission.xml"
<?xml version="1.0" encoding="UTF-8"?>
<root BTCPP_format="4" main_tree_to_execute="MyFallbackMission">
  <BehaviorTree ID="MyFallbackMission">
    <Sequence name="my_fallback_mission">
      <PosSetpoint z="-1.0"/>
      <Fallback name="try_a_long_trip">
        <MoveRelative x="50.0" timeout_msec="5000"/>
        <Stop/>
      </Fallback>
      <PosSetpoint z="-0.5"/>
    </Sequence>
  </BehaviorTree>
</root>
```

Run it:

```text
[mission-4] [INFO] [marlin_v3.sub_mission]: MoveRelative: offset=(50.000, 0.000, 0.000) target=(50.000, 0.034, nan)
[mission-4] [WARN] [marlin_v3.sub_mission]: MoveRelative timed out; error xyz=(48.900, 0.031, -0.012).
[mission-4] [INFO] [marlin_v3.sub_mission]: Stop: holding x, y, z and yaw where they come to rest.
[mission-4] [INFO] [marlin_v3.sub_mission]: Published position command: xyz=(nan, nan, -0.500)
[mission-4] [INFO] [marlin_v3.sub_mission]: Mission '.../my_fallback_mission.xml' finished with SUCCESS.
```

`MoveRelative` timed out, so the `Fallback` ran `Stop`. `Stop` succeeded, so the `Fallback` did too and the `Sequence` carried on.

Without the `Fallback`, leaving just the `MoveRelative` line, the mission ends with `FAILURE`. Real missions use this pattern so one failed task doesn't end the run.

## Break it on purpose

Change `PosSetpoint`'s `z` to `depth` (`<PosSetpoint depth="-1.0"/>`) and run it again:

```text
[mission-4] [ERROR] [marlin_v3.sub_mission]: Failed to load mission '.../my_first_mission.xml': a port with name [depth] is found in the XML (<PosSetpoint>, line 5) but not in the providedPorts() of its registered node type.
```

`PosSetpoint` has no `depth` setting, and the message gives the line. Now run a mission that doesn't exist:

```bash
pixi run up -- mission:=does_not_exist
```

```text
[mission-4] [ERROR] [marlin_v3.sub_mission]: Mission file '.../resources/missions/does_not_exist.xml' does not exist. Available missions:
[mission-4]   bins_test
[mission-4]   gate_slalom_test
[mission-4]   gate_test
...
```

## Add a mission to the repository

Copy the file to `src/sub_mission/resources/missions/` and build, so ROS 2 finds it. Then it runs by name:

```bash
pixi run build --packages-select sub_mission
pixi run up -- mission:=my_first_mission
```

Later edits to it need no rebuild. When you are done, delete it and rebuild.

## Going further

[Mission system](/thalassic/mission/#behavior-tree-xml) lists every step. A few to try: `VelocitySetpoint` (swim at a set speed), `Spin` (a full turn), `TimedVelocity` and `MoveRelativePos`.

Real missions to read:

- `src/sub_mission/resources/missions/pid_tuning.xml` is like yours.
- `src/sub_mission/resources/missions/hard_coded_gate.xml` goes through the gate without using vision.
- `src/sub_mission/resources/trees/gate.xml` is the real gate task, with vision.
- `src/sub_mission/resources/trees/competition.xml` is a whole competition run.

:::note[Vision missions in the simulator]

Missions that use the gate model, like `pool_a`, fail in the simulator: the model was trained on real footage and detects nothing in simulated images. Test logic with the `hard_coded_*` missions.

:::
