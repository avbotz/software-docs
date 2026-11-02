---
title: Change the C++
description: Add a new behavior tree step in C++, compile it, use it in a mission, and write a test for it.
---

In this tutorial you add a new step that missions can use, written in C++. It is called `Say`, and it prints a message to the log, so a mission can report how far it has got:

```xml
<Say message="Reached 1 metre deep"/>
```

You will touch each piece of real code that a change like this needs: the code itself, compiling, using it, testing and formatting. You don't need to know much C++, because you will follow the pattern of the code around it, which is how most people start.

:::note

This is for practice, so you will undo it at the end. Do it on a branch, or just discard it afterward.

:::

## Look at an example first

The best way to add something new is to copy something similar. Open `src/sub_mission/src/nodes/actions/stop.cpp`, the simplest step there is. It has three parts: a class that does the work, a `tick()` function that runs when the tree reaches the step, and a function at the bottom that registers it with a name.

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

Here is what the pieces do:

| Code | What it does |
| --- | --- |
| `#include "actions.hpp"` | Brings in the declarations this file needs |
| `namespace { ... }` | Keeps `SayAction` private to this file |
| `class SayAction : public BT::SyncActionNode` | A step that finishes right away. Moves that take time use a different base class, as you can see in `pos_setpoint.cpp` |
| The constructor | Stores the logger, so that `tick()` can use it |
| `providedPorts()` | The settings this step accepts in XML. This is where `message="..."` comes from |
| `tick()` | Runs when the behavior tree reaches this step, and returns whether it worked |
| `readPort(...)` | A helper from `actions.hpp` that reads a setting and logs an error if it fails. Our rule: a mistake in a mission should fail the step, never carry on with a made-up value |
| `RCLCPP_INFO(...)` | The ROS 2 way of printing a log line. `%s` is where the text goes |
| `registerSayAction` | Tells the behavior tree library that `Say` in XML means this class |

## Step 2: Connect it

Writing the file isn't enough. Three other places need to know about it. All of these paths are in `src/sub_mission/`.

**In `src/nodes/actions/actions.hpp`,** declare the function, next to the others like it. Find this line:

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

`--packages-select` builds just this one package instead of everything. It takes a minute or two.

```text
Finished <<< sub_mission [1min 3s]

Summary: 1 package finished [1min 3s]
  1 package had stderr output: sub_mission
```

"Had stderr output" just means that it printed warnings.

If you made a mistake, the compiler tells you the file and line. **Read the first error, not the last.** One typo can cause dozens of errors after it, and fixing the first often fixes them all.

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

Those are your words, printed by your code, running inside the robot's mission program.

## Step 5: Test it

A **test** is code that checks other code automatically. Before anything reaches the robot, the tests for `sub_mission` run on every pull request. Open `test/test_mission.cpp`, and read a few tests to get the idea. Then find this line:

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

This checks that `Say` works when given a message, and that it _fails_ when its message comes from a value that was never set. Testing the failure matters just as much, since that is the mistake that would otherwise go unnoticed.

Build it and run the package's tests:

```bash
pixi run build --packages-select sub_mission
pixi run colcon test --packages-select sub_mission
pixi run colcon test-result --test-result-base build/sub_mission
```

```text
Summary: 82 tests, 0 errors, 0 failures, 0 skipped
```

**Try it:** break `Say` on purpose, say by returning `SUCCESS` when `readPort` fails, then rebuild and run the tests again. The test should fail, and that shows it is really checking something. Add `--verbose` to `test-result` to see the details. Then put it back.

## Step 6: Format it

Every file has to follow the team's formatting rules. Instead of doing that by hand, have a tool do it:

```bash
pixi run format
pixi run lint
```

`format` rewrites your files to follow the rules, and `lint` checks that they do. CI runs that same check on your pull request. If you had committed code that broke the rules, the git hook would have stopped you.

## Undo it

This was practice, so put everything back:

```bash
git restore .
rm src/sub_mission/src/nodes/actions/say.cpp
pixi run build --packages-select sub_mission
```

:::caution

`git restore .` throws away **every** uncommitted change in the current folder and those below it. Check `git status` first if you have been working on anything else.

:::

If you want to keep going, try a step that takes a setting and does something with it. Read `save_pose.cpp` to see a step that writes a value for later steps to use, and `pos_setpoint.cpp` for one that takes time.

Next: [your first pull request](/tutorials/first-pull-request/).
