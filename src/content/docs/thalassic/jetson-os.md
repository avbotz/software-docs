---
title: "Vehicle OS configuration"
description: "What deploy/jetson/setup.sh installs on the Jetson, and why."
---

`deploy/jetson/setup.sh` installs these configuration files, and is safe to re-run. [Deployment](/thalassic/deployment/#what-deployjetsonsetupsh-does) explains when to run it.

```bash
sudo deploy/jetson/setup.sh
```

| What | Installed as | Why |
| --- | --- | --- |
| Static address `192.168.5.245/24` and MTU 9000 on `end0` | `/etc/netplan/60-thalassic-vehicle.yaml` | Static IP for Jetson. Jumbo frames improve performance of GigE camera. |
| NTP server for `192.168.5.0/24` | `/etc/chrony/conf.d/thalassic.conf` | The DVL and the down camera take their time from the Jetson. |
| Power mode MAXN, clocks left to DVFS | `/etc/systemd/system/thalassic-power-mode.service` | Improves inference performance. Kernel still scales every clock with load and throttles it when the SoC runs hot. |
| Fan pinned at full speed | `/etc/systemd/system/thalassic-fan.service` + `/usr/local/sbin/thalassic-fan-max` | Prevents overheating in the sealed hull. |
| Socket buffers, 10 MB | `/etc/sysctl.d/60-thalassic-gige.conf` | The GigE camera bursts a frame faster than the default receive buffer holds. |
| udev rules from `../udev` | `/etc/udev/rules.d/` | Stable device names (`/dev/maritime`, `/dev/naviguider_imu`, `/dev/front_camera`). |
| chrony, if it is missing | the `chrony` package | The NTP server above. Needs a network the first time. |
| user added to `dialout` and `video` groups | `/etc/group` | Allows for non-root access to MCUs and cameras. |
