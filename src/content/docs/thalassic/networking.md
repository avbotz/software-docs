---
title: "Networking"
description: "Vehicle addresses, changing the subnet, MTU, time and discovery."
---

The Jetson, the DVL, the GigE down camera, and the router all connect to a switch inside the MEB.

| Device | Address | Set by |
| --- | --- | --- |
| Jetson AGX Orin | `192.168.5.245/24` | `deploy/jetson/files/60-thalassic-vehicle.yaml`, installed as a netplan file |
| Water Linked DVL A50 | `192.168.5.250` | Configured on the DVL itself; the driver is pointed at it by `sub_bringup/config/vehicles/marlin_v3.yaml` |
| FLIR Blackfly S (down camera) | `192.168.5.249` | Configured on the camera itself; the driver finds it by the serial number in `sub_bringup/config/vehicles/marlin_v3.yaml` |
| Laptops and anything else temporary | DHCP, `192.168.5.10`–`192.168.5.100` | The router |

The netplan file gives the Jetson a default route through the router (`192.168.5.1`), which is not always on the network (autonomous runs, for one), and no nameservers. `end0` is `optional`, so boot does not wait for the link.

`192.168.5.0/24` rather than the `192.168.0.0/24` this used to be on: that is the default subnet of most consumer routers, so a laptop that has ever been on a home network already has routes for it.

## Changing the subnet

The router's, the DVL's and the down camera's addresses live on the devices, not in this repository, so the order matters — get it wrong and the sub is unreachable until it is on a bench with a serial console:

1. **The router**: LAN address and DHCP pool.
1. **The DVL**, through its web interface, and **the down camera**. Each answers at its old address until you change it, so do this from a laptop that can still reach both subnets.
1. **The Jetson**: change the subnet in `deploy/jetson/files/` (the netplan file's address and route, `thalassic-ntp.conf`'s `allow`) and the DVL's address in `marlin_v3.yaml`, then `sudo deploy/jetson/setup.sh`, from the console rather than over SSH — the link drops as it is applied.

## MTU

`end0` runs at MTU 9000. GigE Vision sends a frame as a burst of packets, and jumbo frames are what let the down camera hold its frame rate. The switch and the camera have to agree; a 1500-byte hop anywhere in the path shows up as incomplete frames rather than as an error.

The driver still requests 1500-byte GigE packets (`gev_scps_packet_size` in `sub_bringup/config/devices/flir_blackfly_s.yaml`) — raising it to 9000 now that the interface allows it has not been tested end to end.

## Time

The Jetson serves NTP to the DVL and the camera (`deploy/jetson/files/thalassic-ntp.conf`). It has no battery-backed clock and no upstream server, so it advertises stratum 10: the sensors agree with the Jetson, not with UTC, which is all the timestamps need. `chronyc clients` on the Jetson lists who has asked.

## ROS 2 discovery

Discovery is separate from addressing and is set by `ROS_AUTOMATIC_DISCOVERY_RANGE` — see [DDS discovery](/thalassic/setup/#dds-discovery). To reach the vehicle's nodes from a laptop plugged into its network, use `ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET pixi shell`.
