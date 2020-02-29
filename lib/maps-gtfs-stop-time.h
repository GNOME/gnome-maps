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
 * MapsGTFSStopTimePickupDropOffType:
 * @MAPS_GTFS_STOP_TIME_REGULAR:    Regularly scheduled pickup/drop-off
 * @MAPS_GTFS_STOP_TIME_NO:         No pickup/drop-off available
 * @MAPS_GTFS_STOP_TIME_PHONE:      Must phone agency to arrange pickup/drop-off
 * @MAPS_GTFS_STOP_TIME_COORDINATE: Must coordinate with driver to arrange pickup/drop-off
 */
typedef enum
{
  MAPS_GTFS_STOP_TIME_REGULAR,
  MAPS_GTFS_STOP_TIME_NO,
  MAPS_GTFS_STOP_TIME_PHONE,
  MAPS_GTFS_STOP_TIME_COORDINATE
} MapsGTFSStopTimePickupDropOffType;

#define MAPS_TYPE_GTFS_STOP_TIME (maps_gtfs_stop_time_get_type())

G_DECLARE_FINAL_TYPE (MapsGTFSStopTime, maps_gtfs_stop_time, MAPS, GTFS_STOP_TIME, GObject)

MapsGTFSStopTime *maps_gtfs_stop_time_new (void);

G_END_DECLS
