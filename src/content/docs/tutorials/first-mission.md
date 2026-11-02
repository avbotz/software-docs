---
title: Write a mission
description: Write your own behavior tree in XML and watch the robot follow it in the simulator.
---

In this tutorial you write a mission, the robot's plan for a run, and watch it run in the simulator. You don't need to know any programming.

You will need the simulator [working](/start-here/run-the-simulator/). It helps to have read [Behavior trees](/concepts/behavior-trees/), but it isn't required.

## Your first mission

Make a folder to play in, outside the repository, and open it in your editor:

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

Here is what each part means:

| Line | Meaning |
| --- | --- |
| `<root ... main_tree_to_execute="MyFirstMission">` | This file's main tree is the one called `MyFirstMission` |
| `<Sequence>` | Do the steps inside, in order. Stop if one fails |
| `<PosSetpoint z="-1.0"/>` | Go to a depth of 1 m. z is up, so underwater is negative. Wait until it gets there |
| `<MoveRelative x="2.0"/>` | Swim 2 m forward. In `MoveRelative`, x is forward, y is left and z is up |
| `<AddAttSetpoint yaw="1.57079633"/>` | Turn 90° to the left. Angles are in radians, so π/2 ≈ 1.5708 is 90° |
| `<Sleep msec="3000"/>` | Wait for 3 seconds |

[Coordinates](/concepts/coordinates/) explains x, y, z and radians properly.

## Run it

```bash
cd ~/avbotz/thalassic
pixi run up -- mission:=$HOME/avbotz/playground/my_first_mission.xml
```

Watch the simulator window. When the kill switch releases and the thrusters have started, the robot dives, swims forward, turns left, swims a little more, and rises. There is a lot of output, but you can pick out the lines from `mission-4`, the mission. Here is what they should say, with the timestamps cut out:

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

`Sub is killed, waiting...` repeats until the release, which is normal. `nan` means "not a number", and here it means "leave this axis alone".

Look at the last `MoveRelative` line. The robot had turned left, so its 1 m forward moved the target in _y_, from about 0 to about 1. Forward depends on which way the robot is facing, but x and y in the target are fixed to the pool.

When the mission ends, the robot holds still and the rest of the stack keeps running. Press Ctrl-C to stop it.

:::tip[Finding the mission's lines in the noise]

Filter the output so you only see the mission:

```bash
pixi run up -- mission:=$HOME/avbotz/playground/my_first_mission.xml | grep "mission-"
```

:::

## Change it

You don't need to rebuild anything to change a mission. Save the file and run it again.

**Try these:**

1. Make it go deeper, or further.
1. Make it turn right instead of left.
1. Make it turn left, but with `AttSetpoint yaw="1.57079633"` instead of `AddAttSetpoint`. What is the difference? (`AttSetpoint` turns to an absolute heading, so sending the same one twice only turns once. `AddAttSetpoint` turns relative to its current target.)

## Repeat: swim a square

`Repeat` runs what is inside it several times. Replace the `Sequence` with this:

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

The robot should end up back near where it started, facing the same way.

Each file's `ID` and `main_tree_to_execute` must match, and it must not be the same as any tree that already exists.

## Fallback: when things go wrong

Things go wrong in the water all the time, and a good mission has a plan B. A `Fallback` tries its children in order until one succeeds, the opposite of a `Sequence`.

Every move has a time limit. This mission tries a trip far too long to finish in 5 seconds:

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

Run it, and watch the mission's lines:

```text
[mission-4] [INFO] [marlin_v3.sub_mission]: MoveRelative: offset=(50.000, 0.000, 0.000) target=(50.000, 0.034, nan)
[mission-4] [WARN] [marlin_v3.sub_mission]: MoveRelative timed out; error xyz=(48.900, 0.031, -0.012).
[mission-4] [INFO] [marlin_v3.sub_mission]: Stop: holding x, y, z and yaw where they come to rest.
[mission-4] [INFO] [marlin_v3.sub_mission]: Published position command: xyz=(nan, nan, -0.500)
[mission-4] [INFO] [marlin_v3.sub_mission]: Mission '.../my_fallback_mission.xml' finished with SUCCESS.
```

`MoveRelative` gave up after 5 seconds, so the `Fallback` tried `Stop`, which worked. Since the `Fallback` as a whole succeeded, the `Sequence` carried on, and the mission succeeded.

What would happen without the `Fallback`? Remove it, leaving just the `MoveRelative` line, and see. The mission ends with `FAILURE`, because a `Sequence` stops at the first step that fails. Real missions use this same pattern so that one failed task doesn't end the whole run.

## Break it on purpose

Error messages are much less scary once you have seen them. Change `z` to `depth` in `PosSetpoint`, so it reads `<PosSetpoint depth="-1.0"/>`, and run it again:

```text
[mission-4] [ERROR] [marlin_v3.sub_mission]: Failed to load mission '.../my_first_mission.xml': a port with name [depth] is found in the XML (<PosSetpoint>, line 5) but not in the providedPorts() of its registered node type.
```

The message tells you the problem and the exact line: `PosSetpoint` has no setting called `depth`. Now run one that doesn't exist:

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

It lists every mission it knows about, which is handy.

## What else can a mission do?

[The Mission System page](/thalassic/mission/#behavior-tree-xml) lists every step you can use. A few to try: `VelocitySetpoint` (swim at a set speed), `Spin` (a full turn), `TimedVelocity` and `MoveRelativePos`.

Now read the real missions. They are built the same way as yours:

- `src/sub_mission/resources/missions/pid_tuning.xml` is just like yours.
- `src/sub_mission/resources/missions/hard_coded_gate.xml` goes through the gate without using vision.
- `src/sub_mission/resources/trees/gate.xml` is the real gate task, with vision.
- `src/sub_mission/resources/trees/competition.xml` is a whole competition run.

:::note[Vision missions in the simulator]

Missions that rely on the gate model, like `pool_a`, won't get far in the simulator. Its images don't look enough like the real footage the model was trained on, so it sees nothing. That is a limit of the simulator, not a bug in your mission. Use the `hard_coded_*` missions to test logic.

:::

## Adding a mission to the repository

So far, your mission has been in your own folder. To add one to the real code, copy it to `src/sub_mission/resources/missions/` and build, which tells ROS 2 about the new file:

```bash
pixi run build --packages-select sub_mission
pixi run up -- mission:=my_first_mission
```

Now it can run by name. You can then edit that file without rebuilding again. Delete it when you are done, as nobody needs your test mission in the repository, and rebuild.

Next: [write a ROS 2 node](/tutorials/first-node/).
