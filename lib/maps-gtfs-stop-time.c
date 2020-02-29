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

struct _MapsGTFSStopTime
{
  GObject parent_instance;
};

typedef struct
{
  guint16 arrival_time_mins;
  guint8 arrival_time_secs;
  guint16 departure_time_diff;
  guint16 stop_sequence;
  gchar *stop_headsign;
  guint8 pickup_dropoff;
  gfloat shape_dist_travelled;
} MapsGTFSStopTimePrivate;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFSStopTime, maps_gtfs_stop_time, G_TYPE_OBJECT)

enum {
  PROP_0,
  PROP_ARRIVAL_TIME,
  PROP_DEPARTURE_TIME,
  PROP_STOP_SEQUENCE,
  PROP_STOP_HEADSIGN,
  PROP_PICKUP_TYPE,
  PROP_DROP_OFF_TYPE,
  PROP_SHAPE_DIST_TRAVELLED,
  N_PROPS
};

static GParamSpec *properties [N_PROPS];

MapsGTFSStopTime *
maps_gtfs_stop_time_new (void)
{
  return g_object_new (MAPS_TYPE_GTFS_STOP_TIME, NULL);
}

static void
maps_gtfs_stop_time_finalize (GObject *object)
{
  MapsGTFSStopTime *self = (MapsGTFSStopTime *)object;

  G_OBJECT_CLASS (maps_gtfs_stop_time_parent_class)->finalize (object);
}

static void
maps_gtfs_stop_time_get_property (GObject    *object,
                                  guint       prop_id,
                                  GValue     *value,
                                  GParamSpec *pspec)
{
  MapsGTFSStopTime *self = MAPS_GTFS_STOP_TIME (object);

  switch (prop_id)
    {
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_stop_time_set_property (GObject      *object,
                                  guint         prop_id,
                                  const GValue *value,
                                  GParamSpec   *pspec)
{
  MapsGTFSStopTime *self = MAPS_GTFS_STOP_TIME (object);

  switch (prop_id)
    {
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_stop_time_class_init (MapsGTFSStopTimeClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_gtfs_stop_time_finalize;
  object_class->get_property = maps_gtfs_stop_time_get_property;
  object_class->set_property = maps_gtfs_stop_time_set_property;
}

static void
maps_gtfs_stop_time_init (MapsGTFSStopTime *self)
{
}
