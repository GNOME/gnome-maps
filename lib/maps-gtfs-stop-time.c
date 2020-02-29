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
  GObject parent_instance;
};

typedef struct
{
  guint32 arrival_time:24;
  guint16 departure_time_diff;
  guint16 stop_sequence;
  gchar *stop_headsign;
  MapsGTFSStopTimePickupDropOffType pickup_type:2;
  MapsGTFSStopTimePickupDropOffType drop_off_type:2;
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
maps_gtfs_stop_time_new (guint32 arrival_time, guint32 departure_time,
                         guint16 stop_sequence, gchar *stop_headsign,
                         MapsGTFSStopTimePickupDropOffType pickup_type,
                         MapsGTFSStopTimePickupDropOffType drop_off_type,
                         gfloat shape_dist_travelled)
{
  MapsGTFSStopTime *stop_time =
    MAPS_GTFS_STOP_TIME (g_object_new (MAPS_TYPE_GTFS_STOP_TIME, NULL));
  MapsGTFSStopTimePrivate *priv =
    maps_gtfs_stop_time_get_instance_private (stop_time);

  priv->arrival_time = arrival_time;
  priv->departure_time_diff = departure_time - arrival_time;
  priv->stop_sequence = stop_sequence;
  priv->stop_headsign = g_strdup (stop_headsign);
  priv->pickup_type = pickup_type;
  priv->drop_off_type = drop_off_type;
  priv->shape_dist_travelled = shape_dist_travelled;

  return stop_time;
}

static void
maps_gtfs_stop_time_finalize (GObject *object)
{
  MapsGTFSStopTime *self = (MapsGTFSStopTime *)object;
  MapsGTFSStopTimePrivate *priv = maps_gtfs_stop_time_get_instance_private (self);

  g_clear_pointer (&priv->stop_headsign, g_free);

  G_OBJECT_CLASS (maps_gtfs_stop_time_parent_class)->finalize (object);
}

static void
maps_gtfs_stop_time_get_property (GObject    *object,
                                  guint       prop_id,
                                  GValue     *value,
                                  GParamSpec *pspec)
{
  MapsGTFSStopTime *self = MAPS_GTFS_STOP_TIME (object);
  MapsGTFSStopTimePrivate *priv = maps_gtfs_stop_time_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_ARRIVAL_TIME:
      g_value_set_uint (value, priv->arrival_time);
      break;
    case PROP_DEPARTURE_TIME:
      g_value_set_uint (value, priv->arrival_time + priv->departure_time_diff);
      break;
    case PROP_STOP_SEQUENCE:
      g_value_set_uint (value, priv->stop_sequence);
      break;
    case PROP_STOP_HEADSIGN:
      g_value_set_string (value, priv->stop_headsign);
      break;
    case PROP_PICKUP_TYPE:
      g_value_set_enum (value, priv->pickup_type);
      break;
    case PROP_DROP_OFF_TYPE:
      g_value_set_enum (value, priv->drop_off_type);
      break;
    case PROP_SHAPE_DIST_TRAVELLED:
      g_value_set_float (value, priv->shape_dist_travelled);
      break;
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

  properties[PROP_ARRIVAL_TIME] =
    g_param_spec_uint ("arrival_time",
                       "Arrival time",
                       "Arrival time, in seconds since start of service day",
                       0, G_MAXUINT32, 0,
                       G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_DEPARTURE_TIME] =
    g_param_spec_uint ("departue_time",
                       "Departure time",
                       "Departure time, in seconds since start of service day",
                       0, G_MAXUINT32, 0,
                       G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_STOP_SEQUENCE] =
    g_param_spec_uint ("stop_sequence",
                       "Stop sequence",
                       "Order of stops for a particular trip. The values must increase along the trip but do not need to be consecutive.",
                       0, G_MAXUINT16, 0,
                       G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_STOP_HEADSIGN] =
    g_param_spec_string ("stop_headsign",
                         "Stop headsign",
                         "Text that appears on signage identifying the trip's destination to riders. This field overrides the default in Trips",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_PICKUP_TYPE] =
    g_param_spec_enum ("pickup_type",
                       "Pickup type",
                       "Indicates pickup method",
                       MAPS_TYPE_GTFS_STOP_TIME_PICKUP_DROP_OFF_TYPE,
                       MAPS_GTFS_STOP_TIME_REGULAR,
                       G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_DROP_OFF_TYPE] =
    g_param_spec_enum ("drop_off_type",
                       "Drop-off type",
                       "Indicates drop-off method",
                       MAPS_TYPE_GTFS_STOP_TIME_PICKUP_DROP_OFF_TYPE,
                       MAPS_GTFS_STOP_TIME_REGULAR,
                       G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_SHAPE_DIST_TRAVELLED] =
    g_param_spec_float ("shape_dist_travelled",
                        "Shape distance travelled",
                        "Actual distance traveled along the associated shape, from the first stop to the stop specified in this record",
                        G_MINFLOAT,
                        G_MAXFLOAT,
                        G_MINFLOAT,
                        G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);

  g_object_class_install_properties (object_class, N_PROPS, properties);
}

static void
maps_gtfs_stop_time_init (MapsGTFSStopTime *self)
{
}
