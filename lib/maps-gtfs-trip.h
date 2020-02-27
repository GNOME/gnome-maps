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

#define MAPS_TYPE_GTFS_TRIP (maps_gtfs_trip_get_type())

G_DECLARE_DERIVABLE_TYPE (MapsGTFSTrip, maps_gtfs_trip, MAPS, GTFS_TRIP, GObject)

struct _MapsGTFSTripClass
{
  GObjectClass parent_class;
};

MapsGTFSTrip *maps_gtfs_trip_new (gchar *route_id, gchar *service_id, gchar *id,
                                  gchar *headsign, gchar *short_name,
                                  gchar *shape_id);

G_END_DECLS
