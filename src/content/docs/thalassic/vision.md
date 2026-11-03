---
title: "Vision system"
description: "sub_vision: topics, model loading and weights, detections, post-processors, and the align, orient and sweep vocabulary of mission XML."
---

Perception for Marlin V3: YOLO detection and segmentation with per-task OpenCV post-processing. Every model is an ONNX file run by **ONNX Runtime**, on the GPU where there is a provider for it, else on the CPU. Missions use the detections through the [vision nodes](/thalassic/mission/#vision-nodes); [Computer vision](/concepts/vision/) introduces the ideas.

The pipeline is two packages:

| Package | Build type | Contents |
| --- | --- | --- |
| `sub_vision_interfaces` | `ament_cmake` | `Detection.msg`, `DetectionArray.msg`, `LoadModel.srv` |
| `sub_vision` | `ament_python` | model manager, post-processors, node |

## Topics

`sub_vision` reads one RGB stream and its intrinsics and publishes detections. The input topics are parameters, so real and simulated cameras are handled the same way, with **no `if sim:` branches or bridge nodes**: each launch file points the node at its camera, and `cv_bridge` converts any 8-bit color encoding to `bgr8`.

All topics are relative to the node namespace (e.g. `/marlin_v3`):

| Topic (parameter) | Type | Notes |
| --- | --- | --- |
| `rgb_topic` (default `front_camera/image_raw`) | `sensor_msgs/Image` | any 8-bit color encoding |
| `camera_info_topic` (default `front_camera/camera_info`) | `sensor_msgs/CameraInfo` | intrinsics; also feed the per-detection bearings |
| **out:** `detections_topic` (default `vision/detections`) | `sub_vision_interfaces/DetectionArray` | detections + bearings + 3D metadata |
| **out:** `/diagnostics` | `diagnostic_msgs/DiagnosticArray` | `<node>: detector` (model state + timing) and, once a model is loaded, `<node>: detections topic status` (rate, frame age) |
| **out:** `~/depth`, `~/depth/color` | `sensor_msgs/Image` | relative depth (32FC1) and a Turbo view (bgr8), only with `depth_debug` |

`sim_launch.py` and `pool_test_launch.py` each run one instance per camera from the shared `config/sub_vision.yaml`, setting the topics (`vision_entities` in `sub_bringup/entities.py`):

| Node              | Camera | `rgb_topic`              | `detections_topic`       |
| ----------------- | ------ | ------------------------ | ------------------------ |
| `sub_vision`      | front  | `front_camera/image_raw` | `vision/detections`      |
| `sub_vision_down` | down   | `down_camera/image_raw`  | `vision/detections_down` |

The depth camera is not used. Boxes, bearings and `pose` are in the camera's **optical** frame (`header.frame_id` from the source image); bearings go through the `CameraInfo` distortion model (`geometry.py`).

Frames are subscribed only once a model is loaded (`CameraInfo` always is): converting each raw frame to a Python message took 40% of a core even with no model to run on it. The simulator also skips rendering a camera nobody subscribes to.

### image_transport

rclpy has no `image_transport` bindings, so a parameter implements the convention: `image_transport: raw` (default) subscribes `<rgb_topic>`, and `compressed` subscribes `<rgb_topic>/compressed` (`sensor_msgs/CompressedImage`), for frames that cross the network, e.g. vision on a laptop against the sub's cameras. Any other value fails at startup.

## Model loading & device selection

### Swapping models

`sub_vision` keeps **one** model resident. Swap it at runtime with the service:

```bash
ros2 service call /marlin_v3/sub_vision/load_model \
    sub_vision_interfaces/srv/LoadModel "{task: 'gate'}"
```

- An already-active task is a no-op that returns `success: true`.
- Otherwise the new model is loaded **outside** the inference lock, then swapped in atomically and the previous one freed, so a swap can never race a frame in flight (`model_manager.ModelManager`).
- `default_task` (param) pre-loads a model on startup.

### Model files

Models are `<model>.onnx` in `model_dir` (default `weights`; a relative path is from the workspace root, `$PIXI_PROJECT_ROOT`).

The model is the task's name unless `model_manager.TASK_MODELS` maps it to another file: `gate` runs `ffc_rs_26`.

`sub_mission` passes role-agnostic task names from the XML unchanged. A task with a `_survey` or `_search` suffix and no post-processor of its own uses its base task's (`gate_survey` → `gate`). The suffix affects only that lookup: loading `gate_survey` still needs a `gate_survey` model file or a `TASK_MODELS` entry.

### Model weights

The ONNX models, and `ffc_rs_26.pt` that `ffc_rs_26.onnx` was exported from, are [GitHub release](https://github.com/avbotz/thalassic/releases) assets, not in git; `pixi run fetch-weights` puts them in `weights/`. `weights/manifest.toml` lists each file's URL and sha256. `fetch-weights` (run by `scripts/install.sh`) downloads any that are missing or differ, keeping a replaced file as `<file>.old`; `--check` only reports.

To add or update a model, upload it to a new release and point the manifest at it:

```bash
gh release create v2026.0.2 --notes "Retrained torp"   # once per release
gh release upload v2026.0.2 weights/torp.onnx
sha256sum weights/torp.onnx
```

then set the file's `url` and `sha256` in `weights/manifest.toml` and commit it with the code that needs it. Do not replace an asset in a release that a commit's manifest already points to: that commit would then fail its checksum.

### Device selection

The `device` param chooses where the model runs (`backends.open_runner`):

- `auto` (default) tries, in order, each of `backends.GPU_PROVIDERS` (CUDA, MIGraphX, WebGPU) the installed ONNX Runtime has, and keeps the first that runs the model; otherwise it runs on the CPU and logs why. A provider must pass a real inference, because a build lists every provider it was compiled with, and one with no kernels for this GPU fails only when it runs. Operators a provider lacks run on the CPU.
- `gpu` is the same, but fails the load instead of using the CPU. `pool_test_launch.py` sets it for the vehicle.
- `cpu` never tries a GPU. CPU inference runs 4 threads that sleep between operators (`CPU_THREADS` in `backends.py`): ONNX Runtime's default, a spinning thread per core, kept 7.7 cores busy for the gate model at 24 Hz on the dev laptop, against 2.7 for 35 ms instead of 25 per frame.

`onnxruntime` comes from pixi, and its build decides the providers: CUDA on the `linux-64-cuda` platform and in the `jetson` environment, CPU only elsewhere ([Setup and build](/thalassic/setup/#gpu-inference)). A started session stays on its provider: ONNX Runtime's own CPU fallback is off, so a GPU failing later fails frames, in the log, instead of quietly slowing every one.

### Inference

`Detector` (`backends.py`) owns all pre- and post-processing: letterbox to the square network input (gray padding), BGR→RGB CHW float normalization, decoding the network's output, and rescaling boxes back to original-image pixels.

End-to-end exports (YOLOv10, YOLO26) emit `(1, N, 6)` boxes directly and need no NMS; raw YOLOv8/11-style exports (`(1, 4+nc, M)`) are decoded with NMS in the backend. Segmentation exports add mask coefficients to each box and a `(1, 32, H, W)` prototype output; the backend turns them into one image-sized mask per detection for the post-processors. Which head a model has comes from its export metadata (`end2end`, `names`).

After loading, `warmup_iterations` (3) inferences run on a blank frame, with mean and last timings on `/diagnostics`. A warmup failure fails the load, and the previous model stays active.

## Relative depth (Depth Anything V2)

`depth_enabled: true` (off by default) runs Depth Anything V2 Small (`depth_model`, default `depth_anything_v2_vits`, looked up in `model_dir` like a task, on the same `device`) beside the detector, at most `depth_rate_hz` (5 Hz) counted from the end of the last run. It runs in the frame callback, delaying that frame's detection (~0.4 s on a laptop CPU). The output is relative inverse depth (larger is nearer, no scale) at the image's resolution, passed to the post-processor only with the frame it came from (`None` on the frames between). Only `torp` uses it. `depth_debug: true` publishes it on `~/depth` and `~/depth/color`.

## Detections

`DetectionArray.msg` is `Header header` + `string task` + `Detection[] detections`. `Detection.msg` builds on `vision_msgs/Detection2D` (bbox + class id/score) and adds:

- `float32 bearing_horizontal` / `bearing_vertical`: radians from the camera optical axis to the bbox center (or a point the post-processor knows better: gate, torp), computed from the `CameraInfo` intrinsics and distortion. Positive is right of / below center. Always filled; 0, with a throttled warning, when the source is uncalibrated (`CameraInfo` K zero). `sub_mission`'s vision nodes steer on it (`AlignToDetection` yaws/dives until the bearing is ~0).
- `float32 distance_m`: distance to the object in meters; NaN unless the task's post-processor ranges it (e.g. from a known width or `cv2.solvePnP`).
- `geometry_msgs/Pose pose` + `bool pose_valid`: 6-DOF pose when recoverable.
- `diagnostic_msgs/KeyValue[] extra`: task-specific metadata, so new tasks never require a message change.

Mission nodes filter detections by:

| Field       | Meaning                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `camera`    | `front` (default; the `sub_vision` node) or `down` (`sub_vision_down`) |
| `task`      | Model/task name, such as `gate`                                        |
| `class_id`  | Optional object class within the model                                 |
| `min_score` | Minimum confidence                                                     |

Each task's [post-processor](#post-processors) decides the classes, ranges and `extra` keys a mission sees.

## Post-processors

Angles follow `Detection.msg`: bearings are radians in the optical convention (positive = right of / below center). Yaws are degrees, counter-clockwise positive (REP-103): the heading change that would square the vehicle up. Values in `extra` are strings.

| Task | Model (classes) | Output |
| --- | --- | --- |
| `gate` | `ffc_rs_26` (0 blood, 1 buoy, 2 compass, 3 circle, 4 fire, 5 hammer_and_wrench, 6 slalom, 7 sos) | the role icons (1, 2, 5, 7) left to right, after a synthetic class `8` left-lane target when the left panel's role is known, carrying the gate's facing when both panels are in view |
| `slalom`, `slalom_redpoles_osu` | `slalom` (0 red pole, 1 white pole), `slalom_redpoles_osu` (0 red pole) | only the nearest red pole, as class `2` |
| `path`, `path_marker` | `path`, `path_marker` (0 marker); down camera | every detection, with the marker's yaw; one OpenCV-found detection when the model finds none |
| `torp`, `torp_find` | `torp` (0 board, 1 hole; segments), `torp_find` (0 board) | boards by score with PnP pose, then the rest; the hole to fire at as class `torp_aim_hole` |
| `octagon_table` | table | `distance_m` from the table's 0.546 m width |
| `octagon_search_image` | 0 SOS, 1 hammer_and_wrench, 2 compass, 3 buoy | classes merged by role: `0` = SOS + buoy, `1` = compass + hammer_and_wrench; `distance_m` from width (0.4 m, 0.3 m) |

A task with no registered processor still publishes detections with 2D boxes and bearings; `distance_m` is NaN and `pose` is left invalid. The trees load one such task, `torp_fire_blood` (front camera in `torp.xml`, down in `bins.xml`).

### gate

The panels are split at the widest gap between icons; with one panel in view it counts as the left one only while near the image's left half. The class-8 target spans the left panel's icons, at their score-weighted centre and the principal point's row: `bearing_vertical` is 0, `distance_m` the median over its icons of `icon height * fy / box height`, `pose_valid` false. Each icon's height on the 0.311 m simulator panel is in `ICON_HEIGHT_M` (0.149 to 0.164 m); a gate turned away from the camera narrows the icons but leaves their height. Icons within 2 px of the image edge, which may be cut off, are not ranged from. With both panels in view, the right panel is ranged the same way, and the two panels' centres give the gate's line: the turn that faces the camera through the gate is `heading_yaw_deg`, published only when the panels are within 50% of the simulator gate's 1.59 m apart. Its `extra`:

| Key | Meaning |
| --- | --- |
| `gate_target` | `left_opening` |
| `gate_role` | `SURVEY` or `SEARCH`: the left panel's role, by summed icon score |
| `gate_role_label` | `Survey & Repair` or `Search & Rescue` |
| `left_icon_classes`, `right_icon_classes` | comma-separated class ids on each panel |
| `left_icon_names`, `right_icon_names` | the same as names |
| `two_panel_view` | `true` when both panels are in view |
| `estimated_distance_m` | `distance_m`, m |
| `aim_bearing_horizontal`, `aim_bearing_vertical` | `bearing_horizontal` (rad) and 0 |
| `pose_semantics` | `left_gate_lane` |
| `right_bearing_horizontal`, `right_distance_m` | the right panel's bearing (rad) and range (m), with both panels in view |
| `panel_spacing_m` | the panels' centres apart, m, with both in view |
| `heading_yaw_deg` | the turn that squares the camera to the gate; only with both panels in view, about 1.59 m apart |

### slalom

Class-0 boxes scoring at least 0.10 whose crop is at least 5% clearly red, deduplicated (IoU 0.7); the tallest wins. `distance_m` is `0.90 m * fy / box height`, its range along the optical axis; `pose_valid` is false.

| Key              | Meaning                        |
| ---------------- | ------------------------------ |
| `target`         | `red_divider_center`           |
| `pole_range_m`   | `distance_m`, m                |
| `source_class`   | the model's class for it (`0`) |
| `pose_semantics` | `pole_center`                  |

### path

The marker's long axis is estimated inside its box from the model's mask (if any), Otsu blobs darker and brighter than the floor, and line segments. Two of them agreeing within 12° are averaged; otherwise only one with confidence of at least 0.68 is used. A box touching the image edge, or holding two similar warm blobs, gets no yaw. The fallback detection (class `0`, score 0.25) is the most central closed elongated dark blob.

| Key | Meaning |
| --- | --- |
| `detection_source` | `opencv_fallback` on the fallback detection only |
| `target` | `path_marker` |
| `orientation_status` | `available` or `unavailable` |
| `yaw_deg` | in [-90, 90): the yaw that lines the vehicle up with the marker, whose ends are not told apart. Assumes the down camera's image top is forward and right is starboard (its mount in `marlin_v3.yaml`) |
| `orientation_confidence` | 0-1 |
| `orientation_source` | the estimates used, `+`-joined: `model_mask`, `dark_contour`, `bright_contour`, `line_segments` |
| `pose_semantics` | `orientation` |

### torp

The board's corners come from the first that works: the relative depth map (`depth_relative`: a plane in the box with an edge inside the padded box), the model's mask (`yolo_segment`), the board's colour in the box (`opencv_contour`: an outline inside the padded box), or the box (`bbox_fallback`). `cv2.solvePnP` (IPPE) on a 0.6096 m square gives the board pose in the optical frame: `pose.position` is the board centre, `pose.orientation` the board frame (x right, y down, z into the board). `bearing_horizontal` is `atan2(x, z)` and `distance_m` `hypot(x, z)` (horizontal range) of that centre. Holes stay in the output; the confident hole (score ≥ 0.5) nearest the aim point on the solved board, or without a pose nearest the box's upper centre, becomes class `torp_aim_hole` with `hole_role: aim_target`.

| Key | Meaning |
| --- | --- |
| `pose_std_dev_txyz_rxyz` | six comma-separated standard deviations (m, m, m, rad, rad, rad) per pixel of corner noise, from the reprojection Jacobian, or `unavailable` |
| `image_roll_deg` | deg, the board's twist in the image (telemetry, not steering) |
| `pnp_reprojection_error_px` | RMS px; fits over 50 px are rejected |
| `bbox_corners_px` | the corners used, `x,y;x,y;x,y;x,y` (top-left, bottom-left, bottom-right, top-right) |
| `corner_source` | `depth_relative`, `yolo_segment`, `opencv_contour` or `bbox_fallback` |
| `corner_quality` | 0-1, how well the corners fit the box |
| `pose_semantics` | `board_normal_heading`: use `heading_yaw_deg`, not the pose orientation, to turn |
| `heading_status` | `available`, or `unavailable` when PnP solved `bbox_fallback` corners or a box at the image edge (neither shows which way the board faces) |
| `heading_yaw_deg` | the yaw that squares the camera to the board face |
| `aim_point_status` | `available` or `unavailable` (box corners, a box at the image edge, depth-plane pose) |
| `aim_bearing_horizontal`, `aim_bearing_vertical` | rad, optical convention: the aim point (board x 0, y −0.18 m, the simulator board's upper-centre hole) on the solved board |
| `pose_error` | why PnP failed |
| `depth_status` | `validated` (depth calibrated on this solve), `calibration_rejected`, `fallback` (pose from depth), or `unavailable` (PnP failed, no fallback: `pose_valid` false, `distance_m` NaN) |
| `depth_pose_source` | `pnp_validated` or `cached_pnp_calibrated_plane` |
| `depth_range_m` | m, median calibrated depth over the board |
| `depth_pnp_range_residual_m` | m, `depth_range_m` minus the PnP centre's z |
| `depth_calibration_age_s` | s, age of the calibration a fallback used (at most 0.5) |
| `depth_plane_residual_m` | m, median distance of the depth points from the fallback plane |

With depth on, a PnP solve on the best board's whole outline (not box corners, nor a box at the image edge) fits metres to the relative depth on the board plane. When PnP fails on a depth frame within 0.5 s of one, the pose comes from a plane fitted to the calibrated depth inside the corners: position and heading only (`aim_point_status: unavailable`).

## Align, orient and sweep

The words mission XML uses for what the [vision nodes](/thalassic/mission/#vision-nodes) do.

### Align

To align is to center the target in the camera view using its bearings. On the front camera the horizontal bearing usually becomes a yaw command; on the down camera both bearings become x/y offsets that move the sub over the target. Some align nodes also adjust depth from the vertical bearing or the measured distance.

| Node | Align behavior |
| --- | --- |
| `AlignToDetection` | Front-camera yaw alignment, optionally depth |
| `ForwardContinuousAlign` | Move forward at a fixed velocity while yaw-aligning to front detections |
| `LateralAlignToDetection` | Move sideways (and in z) onto a front detection, keeping the heading |
| `SquareUpToGate` | Line up in front of the gate's left opening, on its normal, from the gate's `heading_yaw_deg` and the left panel's range |
| `DownAlignToDetection` | Center over a down-camera target |
| `DownForwardAlign` | Move forward while applying down-camera centering offsets |

### Orient

To orient is to face the object's plane at an intended angle, from its reported orientation; aligning only looks at the object. For example, center on a torpedo board, then orient to its face before shooting.

The orientation signal is metadata (`sub_mission` does not read the pose as a yaw): the yaw change that would square the vehicle with the object, in degrees, counter-clockwise positive (REP-103). It is `yaw_deg` for the path marker (a line, so in \[-90, 90)) and `heading_yaw_deg` for the torpedo board face and the gate. A `pose_semantics` other than `orientation` means the pose's rotation is not a vehicle yaw.

`OrientToDetectionAtDist` squares the sub to the object's orientation while holding a desired standoff distance.

### Sweep

To sweep is to search by sampling detections over a pattern of headings or, on the down camera, positions. A yaw sweep succeeds when enough fresh detections are seen, then turns to their average heading ([`SweepAngle`](/thalassic/mission/#movement-nodes)).

| Node                    | Sweep behavior                              |
| ----------------------- | ------------------------------------------- |
| `SweepCheck`            | Yaw sweep in place                          |
| `ForwardSweepAlign`     | Yaw sweep with forward moves between passes |
| `DownForwardSweepAlign` | Down-camera forward scan/align while moving |

## Adding a new mission task

No core edits; add a model and a post-processor:

1. **Model:** drop `<model_dir>/<task>.onnx` (an ultralytics detect or segment export at a fixed input size: end-to-end YOLOv10/YOLO26, or a raw YOLOv8/11 head).
2. **Post-processor:** add `sub_vision/post_processors/<task>.py`:

   ```python
   from sub_vision.post_processors.base import TaskPostProcessor
   from sub_vision.post_processors.registry import register_post_processor


   @register_post_processor("buoy")
   class BuoyPostProcessor(TaskPostProcessor):
       def process(self, detections, rgb_image, depth_image, camera_info, model_masks=None):
           # detections already carry the 2D box; model_masks has each one's
           # mask from a segmentation model, depth_image the relative depth
           # on frames it ran on (else None). Add task-specific work here:
           # fill det.pose / det.pose_valid via cv2.solvePnP on known
           # geometry, set det.distance_m, append det.extra KeyValues, etc.
           return detections
   ```

3. Register the module in `registry._BUILTIN_MODULES` (or import it anywhere the node loads). `torp.py` is a worked `cv2.solvePnP` example. The node keeps one processor per task, so it may carry state between frames.

## Viewing detections

Nothing on the vehicle draws them. The vision extension in [foxglove-extensions](https://github.com/avbotz/foxglove-extensions) draws `vision/detections` on their source frames, in its Detections panel or as annotations in Foxglove's Image panel ([Foxglove](/thalassic/foxglove/#extensions)).

## Tests

```bash
colcon test --packages-select sub_vision --merge-install
```

`test/test_backends.py` checks the execution-provider choice against a stand-in for ONNX Runtime; nothing else has unit tests yet. There are no ament linters by design: `pixi run lint` checks the package with ruff, with the rest of the repo.
