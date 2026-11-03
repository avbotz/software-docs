---
title: Change the C++
description: Add a new behavior tree step in C++, compile it, use it in a mission, and write a test for it.
---

You add a mission step, `Say`, that logs a message so a mission can report its progress:

```xml
<Say message="Reached 1 metre deep"/>
```

This covers every part of a real change: write, compile, use, test and format. Little C++ is needed, because you follow the pattern of the code around it.

:::note

This is practice. Do it on a branch, or [undo it](#undo-it) at the end.

:::

## Look at an example first

Open `src/sub_mission/src/nodes/actions/stop.cpp`, the simplest step. It has three parts: a class that does the work, a `tick()` function that runs when the tree reaches the step, and a function at the bottom that registers it with a name.

## Step 1: Write the step

Create `src/sub_mission/src/nodes/actions/say.cpp`:

```cpp title="say.cpp"
#include "actions.hpp"

#include <string>

namespace {

// Logs a message, so a mission can say how far it has got.
class SayAction : public BT::SyncActionNode {
   public:
    SayAction(const std::string &name, const BT::NodeConfig &config, rclcpp::Logger logger)
        : BT::SyncActionNode(name, config), logger_(logger) {}

    static BT::PortsList providedPorts() { return {BT::InputPort<std::string>("message", "What to log")}; }

    BT::NodeStatus tick() override {
        std::string message;
        if (!readPort(*this, "message", message, logger_)) {
            return BT::NodeStatus::FAILURE;
        }
        RCLCPP_INFO(logger_, "%s", message.c_str());
        return BT::NodeStatus::SUCCESS;
    }

   private:
    rclcpp::Logger logger_;
};

}  // namespace

void registerSayAction(BT::BehaviorTreeFactory &factory, rclcpp::Logger logger) {
    factory.registerNodeType<SayAction>("Say", logger);
}
```

| Code | What it does |
| --- | --- |
| `#include "actions.hpp"` | Brings in the declarations this file needs |
| `namespace { ... }` | Keeps `SayAction` private to this file |
| `class SayAction : public BT::SyncActionNode` | A step that finishes right away. Moves that take time use another base class (see `pos_setpoint.cpp`) |
| The constructor | Stores the logger for `tick()` |
| `providedPorts()` | The settings this step accepts in XML, here `message` |
| `tick()` | Runs when the behavior tree reaches this step, and returns whether it worked |
| `readPort(...)` | A helper from `actions.hpp` that reads a setting and logs an error if it fails. Our rule: a mistake in a mission should fail the step, never carry on with a made-up value |
| `RCLCPP_INFO(...)` | Prints a ROS 2 log line, with the text in place of `%s` |
| `registerSayAction` | Tells the behavior tree library that `Say` in XML means this class |

## Step 2: Connect it

Three other files, all in `src/sub_mission/`, need to know about it.

**In `src/nodes/actions/actions.hpp`,** declare the function. Find this line:

```cpp
void registerStopAction(BT::BehaviorTreeFactory &factory, MissionNode &node, rclcpp::Logger logger);
```

and add this one below it:

```cpp
void registerSayAction(BT::BehaviorTreeFactory &factory, rclcpp::Logger logger);
```

**In `src/nodes/node.cpp`,** call it. Find this line:

```cpp
    registerStopAction(factory, node, logger);
```

and add this one below it:

```cpp
    registerSayAction(factory, logger);
```

**In `CMakeLists.txt`,** add the new file to the list of files to compile. Find this line:

```cmake
    src/nodes/actions/save_pose.cpp
```

and add this one below it:

```cmake
    src/nodes/actions/say.cpp
```

## Step 3: Compile it

Python runs directly, but C++ has to be compiled first:

```bash
cd ~/avbotz/thalassic
pixi run build --packages-select sub_mission
```

`--packages-select` builds this one package instead of everything.

```text
Finished <<< sub_mission [1min 3s]

Summary: 1 package finished [1min 3s]
  1 package had stderr output: sub_mission
```

"Had stderr output" means it printed warnings.

A compiler error gives the file and line. **Read the first error, not the last**: one typo can cause dozens after it, and fixing it often fixes them all.

## Step 4: Use it

Create `~/avbotz/playground/say_mission.xml`:

```xml title="say_mission.xml"
<?xml version="1.0" encoding="UTF-8"?>
<root BTCPP_format="4" main_tree_to_execute="SayMission">
  <BehaviorTree ID="SayMission">
    <Sequence name="say_mission">
      <Say message="Starting the dive"/>
      <PosSetpoint z="-1.0"/>
      <Say message="Reached 1 metre deep"/>
    </Sequence>
  </BehaviorTree>
</root>
```

Run it:

```bash
pixi run up -- mission:=$HOME/avbotz/playground/say_mission.xml | grep "mission-"
```

```text
[mission-4] [INFO] [marlin_v3.sub_mission]: Executing mission '.../say_mission.xml'
[mission-4] [INFO] [marlin_v3.sub_mission]: Starting the dive
[mission-4] [INFO] [marlin_v3.sub_mission]: Published position command: xyz=(nan, nan, -1.000)
[mission-4] [INFO] [marlin_v3.sub_mission]: Reached 1 metre deep
[mission-4] [INFO] [marlin_v3.sub_mission]: Mission '.../say_mission.xml' finished with SUCCESS.
```

## Step 5: Test it

A **test** is code that checks other code automatically. The tests for `sub_mission` run on every pull request. Open `test/test_mission.cpp` and read a few tests, then find this line:

```cpp
TEST_F(MissionTest, StopReleasesEveryTarget) {
```

and add this above it:

```cpp
TEST_F(MissionTest, SayFailsWithoutItsMessage) {
    auto with_message = tree(R"(<Say message="hello"/>)");
    EXPECT_EQ(run(with_message, false), BT::NodeStatus::SUCCESS);
    auto without_message = tree(R"(<Say message="{@not_set_anywhere}"/>)");
    EXPECT_EQ(run(without_message, false), BT::NodeStatus::FAILURE);
}

```

This checks that `Say` succeeds with a message, and _fails_ when its message comes from a value that was never set: the mistake that would otherwise go unnoticed.

Build it and run the package's tests:

```bash
pixi run build --packages-select sub_mission
pixi run colcon test --packages-select sub_mission
pixi run colcon test-result --test-result-base build/sub_mission
```

```text
Summary: 82 tests, 0 errors, 0 failures, 0 skipped
```

**Try it:** break `Say`, for example by returning `SUCCESS` when `readPort` fails, then rebuild and rerun the tests. The test should fail; `--verbose` on `test-result` shows the details. Then put it back.

## Step 6: Format it

Every file must follow the team's formatting rules:

```bash
pixi run format
pixi run lint
```

`format` rewrites your files to follow them, and `lint` checks that they do. CI runs the same check on your pull request, and a git hook blocks commits that break them.

## Undo it

:::caution

`git restore .` throws away **every** uncommitted change in the current folder and those below it. Check `git status` first if you have been working on anything else.

:::

```bash
git restore .
rm src/sub_mission/src/nodes/actions/say.cpp
pixi run build --packages-select sub_mission
```

To keep going, read `save_pose.cpp`, a step that writes a value for later steps to use, and `pos_setpoint.cpp`, one that takes time.
