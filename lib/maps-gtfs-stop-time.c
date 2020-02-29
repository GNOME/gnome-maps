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

#include "maps-gtfs-stop-time.h"
#include "maps-enum-types.h"

#include <math.h>

struct _MapsGTFSStopTime
{
  gchar *stop_headsign;
  guint arrival_time : 20;
  guint departure_time_diff : 10;
  guint stop_sequence       : 10;
  MapsGTFSStopTimePickupDropOffType pickup_type:2;
  MapsGTFSStopTimePickupDropOffType drop_off_type:2;
};

MapsGTFSStopTime *
maps_gtfs_stop_time_new (guint32 arrival_time, guint32 departure_time,
                         guint16 stop_sequence, gchar *stop_headsign,
                         MapsGTFSStopTimePickupDropOffType pickup_type,
                         MapsGTFSStopTimePickupDropOffType drop_off_type)
{
  MapsGTFSStopTime *stop_time = g_malloc (sizeof (MapsGTFSStopTime));

  stop_time->arrival_time = arrival_time;
  stop_time->departure_time_diff = departure_time - arrival_time;
  stop_time->stop_sequence = stop_sequence;
  stop_time->stop_headsign = g_strdup (stop_headsign);
  stop_time->pickup_type = pickup_type;
  stop_time->drop_off_type = drop_off_type;

  return stop_time;
}

void
maps_gtfs_stop_time_destroy (MapsGTFSStopTime *self)
{
  g_clear_pointer (&self->stop_headsign, g_free);
}

