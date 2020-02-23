/*
 * Copyright (c) 2020 Marcus Lundblad
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>
 *
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

#pragma once

#include <glib-object.h>

G_BEGIN_DECLS

/**
 * MapsGTFSStopLocationType:
 * @MAPS_GTFS_STOP_STOP: Stop or platform.
 * @MAPS_GTFS_STOP_STATION: A physical structure or area that contains one or more platform.
 * @MAPS_GTFS_STOP_ENTRANCE_EXIT: Entrance or exit to/from a station.
 * @MAPS_GTFS_STOP_GENERIC_NODE: A location within a station.
 * @MAPS_GTFS_STOP_BOARDING_AREA: A specific location on a platform, where passengers can board and/or alight vehicles.
 */
typedef enum
{
  MAPS_GTFS_STOP_STOP = 0,
  MAPS_GTFS_STOP_STATION = 1,
  MAPS_GTFS_STOP_ENTRANCE_EXIT = 2,
  MAPS_GTFS_STOP_GENERIC_NODE = 3,
  MAPS_GTFS_STOP_BOARDING_AREA = 4
} MapsGTFSStopLocationType;

#define MAPS_TYPE_GTFS_STOP (maps_gtfs_stop_get_type())

G_DECLARE_DERIVABLE_TYPE (MapsGTFSStop, maps_gtfs_stop, MAPS, GTFS_STOP, GObject)

struct _MapsGTFSStopClass
{
  GObjectClass parent_class;
};

MapsGTFSStop *maps_gtfs_stop_new (gchar *id, gchar *code, gchar *name, gchar *desc,
                                  float lat, float lon,
                                  MapsGTFSStopLocationType location_type,
                                  gchar *parent_station, GTimeZone *timezone);

G_END_DECLS

