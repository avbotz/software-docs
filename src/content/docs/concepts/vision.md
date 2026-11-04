---
title: Computer vision
description: How the robot finds objects in images. Detections, neural networks, bearings and distance, post-processors and training data.
---

`sub_vision` turns camera images into something the mission can use: "a red pipe, 0.3 radians to the left, 2 meters away".

## What is an image to a computer?

An image is a grid of pixels, and each pixel is three numbers: how much red, green and blue. The front camera's images are 1920 × 1080, so each one is around 6 million numbers, 24 times a second.

Hand-written rules for finding a gate in those numbers are hard to get right underwater, where color and lighting keep changing, so a trained neural network does it.

## Detection

**Object detection** means finding objects in an image, and for each one reporting:

- **a box** around it, called a bounding box,
- **a class**: what it is, such as "red pipe", usually stored as a number,
- **a score** from 0 to 1: how confident the network is.

We use **YOLO** ("You Only Look Once"), a family of detection networks fast enough to run on every frame.

## Training and inference

A neural network contains millions of numbers, called **weights**. Using one has two stages:

- **Training** shows it thousands of images on which people have drawn the correct boxes (**labels**), and adjusts the weights until it gets them right. It takes hours on a powerful GPU.
- **Inference** runs the finished network on new images, in a few tens of milliseconds. This is what the robot does.

The weights are fixed during a run. `pixi run fetch-weights` downloads them into `weights/` as `.onnx` files.

**ONNX** is a standard file format for neural networks, and **ONNX Runtime** is the library that runs them. On the robot it uses the Jetson's GPU, and on most laptops the CPU.

## Each task has its own network

There is one network for each task, and **only one is loaded at a time** per camera. The mission asks for the one it needs with a `LoadModel` step:

```xml
<LoadModel camera="front" task="gate" timeout_msec="20000"/>
```

To load one by hand, with the windowed simulator running (`headless:=true` has no cameras), in a `pixi shell`:

```bash
ros2 service call /marlin_v3/sub_vision/load_model sub_vision_interfaces/srv/LoadModel "{task: 'gate'}"
```

```text
response:
sub_vision_interfaces.srv.LoadModel_Response(success=True, message="loaded 'gate' (ffc_rs_26) via onnxruntime/cpu (warmup 78.0 ms/iter)", active_model='gate (onnxruntime/cpu)', load_time_s=0.3296832740306854)
```

It loaded, on the CPU, at 78 ms per image. See what it detects:

```bash
ros2 topic echo --once --field detections /marlin_v3/vision/detections
```

```text
[]
---
```

An empty list means it sees nothing, as expected for this model in the simulator. The [Foxglove](/thalassic/foxglove/#extensions) vision extension draws the detections on the camera image, the easiest way to check a model.

:::caution[Vision in the simulator]

Our gate model was trained on images unlike the simulator's, so it rarely detects anything there. Check vision on recordings of real pool footage, and test mission logic in the simulator with the `hard_coded_*` missions.

:::

## From a box to a direction

To steer, the robot converts the box's position in pixels into an angle, a **bearing**.

The camera's **focal length** `fx`, measured in pixels, sets how pixels relate to angles. If the center of the image is at `cx`, then a box centered at pixel `u` is at this angle:

```text
bearing = atan((u − cx) / fx)
```

The front camera's image is 1920 pixels wide, so `cx` is about 960, and in the simulator `fx` is about 1361. The real value is in the camera's calibration:

```bash
ros2 topic echo --once --field k /marlin_v3/front_camera/camera_info
```

So a box centered at pixel 1300 is at `atan((1300 − 960) / 1361) ≈ 0.245` radians, or 14° to the right.

Bearings use the camera's convention, so positive means right of center and below center. A mission step like `AlignToDetection` turns the robot until the bearing is close to zero. See [Camera frames](/concepts/coordinates/#camera-frames).

## From a box to a distance

An object looks half the size from twice as far away, so the size in pixels of an object of known size gives its distance:

```text
distance = real size × fx / size in pixels
```

For example, the octagon's table is 0.546 m wide. If its box is 200 pixels wide, it's `0.546 × 1361 / 200 ≈ 3.7` m away.

## Post-processors

After the network runs, a **post-processor** does the task-specific work on its detections. Most of our vision code is in post-processors. This is the one for the octagon's table, from `sub_vision/post_processors/octagon.py`:

```python
TABLE_WIDTH_M = 21.5 * 0.0254  # 0.5461 m


def _width_distance_m(width_m: float, bbox, camera_info) -> float:
    """Range from an object's known width and its box width: ``width_m * fx / width_px``."""
    fx = float(camera_info.k[0])
    if bbox.size_x <= 0.0 or fx <= 0.0:
        return float("nan")
    return float(width_m * fx / bbox.size_x)


@register_post_processor("octagon_table")
class OctagonTablePostProcessor(TaskPostProcessor):
    """Range every table detection from the table's width."""

    def process(self, detections, rgb_image, depth_image, camera_info, model_masks=None):
        for det in detections.detections:
            det.distance_m = _width_distance_m(TABLE_WIDTH_M, det.detection.bbox, camera_info)
        return detections
```

That's the distance formula from above. Other post-processors do more:

| Task          | Its post-processor                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `gate`        | Works out which side of the gate is which, reads the icons on it to find its role, and estimates its angle  |
| `slalom`      | Keeps only the nearest red pipe, and checks that it really is red                                           |
| `path_marker` | Works out which way a marker on the floor points, using OpenCV                                              |
| `torp`        | Works out the board's exact position and angle (using a technique called PnP) and picks the hole to aim for |

[Post-processors](/thalassic/vision/#post-processors) describes each one, and [Adding a new mission task](/thalassic/vision/#adding-a-new-mission-task) shows how to add your own.

## From vision to movement

The full path from an image to the robot moving:

```text
front_camera/image_raw
  → sub_vision: YOLO network, then the task's post-processor
    → vision/detections (class, score, bearing, distance)
      → sub_mission: a step like AlignToDetection
        → motion_setpoint
          → sub_control and the thrusters
```

[Align, orient and sweep](/thalassic/vision/#align-orient-and-sweep) defines the words we use in mission XML.

## Where training data comes from

1. **Record.** Run with `record:=true` to save the cameras to a [bag](/thalassic/recording/). Bags from pool tests are the most valuable.
1. **Label.** [remora](https://github.com/avbotz/remora) samples images from a bag, proposes labels with another neural network, and lets people fix them. It is private: ask a lead for access.
1. **Train.** remora trains a YOLO network and exports an `.onnx` file.
1. **Publish.** Upload the file to a [GitHub release](https://github.com/avbotz/thalassic/releases), and update `weights/manifest.toml`. [Model weights](/thalassic/vision/#model-weights) has the steps.

## Learn more

- [OpenCV-Python tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html): classic image processing, used in the post-processors.
- [Ultralytics docs](https://docs.ultralytics.com/): the YOLO models we train.
