---
title: Computer vision
description: How the robot finds objects in images. Detections, neural networks, bearings and distance, post-processors and training data.
---

The robot's cameras just produce grids of numbers. `sub_vision` turns those into something useful: "there's a red pipe, 0.3 radians to the left, 2 meters away".

## What is an image to a computer?

An image is a grid of pixels, and each pixel is three numbers: how much red, green and blue. The front camera's images are 1920 × 1080, so each one is around 6 million numbers, 24 times a second.

Writing rules by hand to find a gate in those numbers is very hard, especially underwater, where the color and lighting change all the time. So we train a neural network to do it.

## Detection

**Object detection** means finding objects in an image, and for each one reporting:

- **a box** around it, called a bounding box,
- **a class**: what it is, such as "red pipe", usually stored as a number,
- **a score** from 0 to 1: how confident the network is.

We use **YOLO** ("You Only Look Once"), a popular family of detection networks that is fast enough to run on every frame.

## Training and inference

A neural network has millions of numbers inside it, called **weights**, and using one involves two very different stages:

- **Training** means showing it thousands of images where people have already drawn the correct boxes, called **labels**, and gradually adjusting the weights until it gets them right. This takes hours on a powerful GPU.
- **Inference** means using the finished network on new images. This takes a few tens of milliseconds, and it's what happens on the robot.

So the robot doesn't learn anything during a run. The weights are fixed, and they are downloaded into `weights/` as `.onnx` files by `pixi run fetch-weights`.

**ONNX** is a standard file format for neural networks, and **ONNX Runtime** is the library that runs them. On the robot it is set up to use the Jetson's GPU, and on most laptops it uses the CPU.

## Each task has its own network

Rather than one network for everything, we have one for each task, and **only one is loaded at a time** per camera. The mission asks for the one it needs with a `LoadModel` step:

```xml
<LoadModel camera="front" task="gate" timeout_msec="20000"/>
```

You can do the same by hand. With the windowed simulator running (`headless:=true` has no cameras), in a `pixi shell`:

```bash
ros2 service call /marlin_v3/sub_vision/load_model sub_vision_interfaces/srv/LoadModel "{task: 'gate'}"
```

```text
response:
sub_vision_interfaces.srv.LoadModel_Response(success=True, message="loaded 'gate' (ffc_rs_26) via onnxruntime/cpu (warmup 78.0 ms/iter)", active_model='gate (onnxruntime/cpu)', load_time_s=0.3296832740306854)
```

That says it loaded, what it's running on (`cpu`), and how long each image takes (78 ms). Then see what it detects:

```bash
ros2 topic echo --once --field detections /marlin_v3/vision/detections
```

```text
[]
---
```

An empty list means that it sees nothing. In the simulator that is expected for this model, as the next section explains.

:::caution[Vision in the simulator]

Our gate model was trained on images that look different from the simulator's, so it rarely detects anything there. **This isn't a bug in your code.** The simulator is good for testing logic and control, but vision has to be checked on recordings of real pool footage. Use the `hard_coded_*` missions to test mission logic in the simulator.

:::

## From a box to a direction

A box in an image isn't directly useful: the robot needs a direction to steer. So we convert from pixels to an angle, called a **bearing**.

The camera's **focal length** `fx`, measured in pixels, sets how pixels relate to angles. If the center of the image is at `cx`, then a box centered at pixel `u` is at this angle:

```text
bearing = atan((u − cx) / fx)
```

The front camera's image is 1920 pixels wide, so `cx` is about 960, and in the simulator `fx` is about 1361. You can read the real value from the camera's calibration:

```bash
ros2 topic echo --once --field k /marlin_v3/front_camera/camera_info
```

So a box centered at pixel 1300 is at `atan((1300 − 960) / 1361) ≈ 0.245` radians, or 14° to the right.

Bearings use the camera's convention, so positive means right of center and below center. Then a mission step like `AlignToDetection` turns the robot until the bearing is close to zero. See [Camera frames](/concepts/coordinates/#camera-frames).

## From a box to a distance

If you know how big something really is, you can tell how far away it is from how big it looks. Things twice as far away look half the size:

```text
distance = real size × fx / size in pixels
```

For example, the octagon's table is 0.546 m wide. If its box is 200 pixels wide, it's `0.546 × 1361 / 200 ≈ 3.7` m away.

## Post-processors

Each task needs different things from its detections, so after the network runs, a **post-processor** does the task-specific work. It's where most of the interesting vision code is. Here's the one for the octagon's table, from `sub_vision/post_processors/octagon.py`:

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

That's the distance formula from above, in code. Other post-processors do more:

| Task | Its post-processor |
| --- | --- |
| `gate` | Works out which side of the gate is which, reads the icons on it to find its role, and estimates its angle |
| `slalom` | Keeps only the nearest red pipe, and checks that it really is red |
| `path_marker` | Works out which way a marker on the floor points, using OpenCV |
| `torp` | Works out the board's exact position and angle (using a technique called PnP) and picks the hole to aim for |

[`sub_vision`](/thalassic/sub-vision/#post-processors) describes each one, and [Adding a new mission task](/thalassic/sub-vision/#adding-a-new-mission-task) shows how to add your own.

## From vision to movement

To recap, this is the full path from an image to the robot moving:

```text
front_camera/image_raw
  → sub_vision: YOLO network, then the task's post-processor
    → vision/detections (class, score, bearing, distance)
      → sub_mission: a step like AlignToDetection
        → motion_setpoint
          → sub_control and the thrusters
```

[Vision Terms](/thalassic/vision/) defines the words we use in mission XML: align, orient and sweep.

## Where training data comes from

A network is only as good as its training data, so gathering it is a big part of vision work.

1. **Record.** Run with `record:=true` to save the cameras to a [bag](/thalassic/recording/). Bags from pool tests are the most valuable.
1. **Label.** [remora](https://github.com/avbotz/remora), our tool for this, samples images from a bag, proposes labels using another neural network, and lets people fix them. It's a private repository, so ask a lead for access.
1. **Train.** remora trains a YOLO network and exports an `.onnx` file.
1. **Publish.** Upload the file to a [GitHub release](https://github.com/avbotz/thalassic/releases), and update `weights/manifest.toml`. [Model weights](/thalassic/vision/#model-weights) has the steps.

## See what it sees

The [Foxglove](/thalassic/foxglove/#extensions) vision extension draws the detections on the camera image. That's the easiest way to check what a model is doing.

## Learn more

- [OpenCV-Python tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html): classic image processing, used in the post-processors.
- [Ultralytics docs](https://docs.ultralytics.com/): the YOLO models we train.
