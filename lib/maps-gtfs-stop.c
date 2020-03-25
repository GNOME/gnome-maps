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

#include "maps-gtfs-stop.h"
#include "maps-enum-types.h"

#include <math.h>

struct _MapsGTFSStop
{
  GObject parent_instance;
};

typedef struct
{
  gchar *id;
  gchar *code;
  gchar *name;
  gchar *desc;
  float lat;
  float lon;
  MapsGTFSStopLocationType location_type;
  MapsGTFSStop *parent_station;
  GTimeZone *timezone;
} MapsGTFSStopPrivate;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFSStop, maps_gtfs_stop, G_TYPE_OBJECT)

enum {
  PROP_0,
  PROP_ID,
  PROP_CODE,
  PROP_NAME,
  PROP_DESC,
  PROP_LAT,
  PROP_LON,
  PROP_LOCATION_TYPE,
  PROP_PARENT_STATION,
  PROP_TIMEZONE,
  N_PROPS
};

static GParamSpec *properties [N_PROPS];

/**
 * maps_gtfs_stop_new:
 *
 * Create a new #MapsGTFSStop.
 *
 * Returns: (transfer full): a newly created #MapsGTFSStop
 */
MapsGTFSStop *
maps_gtfs_stop_new (const gchar *id, const gchar *code, const gchar *name,
                    const gchar *desc, float lat, float lon,
                    MapsGTFSStopLocationType location_type,
                    MapsGTFSStop *parent_station, GTimeZone *timezone)
{
  MapsGTFSStop *stop = MAPS_GTFS_STOP (g_object_new (MAPS_TYPE_GTFS_STOP, NULL));
  MapsGTFSStopPrivate *priv = maps_gtfs_stop_get_instance_private (stop);

  priv->id = g_strdup (id);
  priv->code = g_strdup (code);
  priv->name = g_strdup (name);
  priv->desc = g_strdup (desc);
  priv->lat = lat;
  priv->lon = lon;
  priv->location_type = location_type;
  priv->parent_station = parent_station ? g_object_ref (parent_station) : NULL;
  priv->timezone = timezone ? g_time_zone_ref (timezone) : NULL;

  return stop;
}

static void
maps_gtfs_stop_finalize (GObject *object)
{
  MapsGTFSStop *self = (MapsGTFSStop *)object;
  MapsGTFSStopPrivate *priv = maps_gtfs_stop_get_instance_private (self);

  g_clear_pointer (&priv->id, g_free);
  g_clear_pointer (&priv->code, g_free);
  g_clear_pointer (&priv->name, g_free);
  g_clear_pointer (&priv->desc, g_free);
  g_clear_pointer (&priv->parent_station, g_object_unref);
  if (priv->timezone)
    g_clear_pointer (&priv->timezone, g_time_zone_unref);

  G_OBJECT_CLASS (maps_gtfs_stop_parent_class)->finalize (object);
}

static void
maps_gtfs_stop_get_property (GObject    *object,
                             guint       prop_id,
                             GValue     *value,
                             GParamSpec *pspec)
{
  MapsGTFSStop *self = MAPS_GTFS_STOP (object);
  MapsGTFSStopPrivate *priv = maps_gtfs_stop_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_ID:
      g_value_set_string (value, priv->id);
      break;
    case PROP_CODE:
      g_value_set_string (value, priv->code);
      break;
    case PROP_NAME:
      g_value_set_string (value, priv->name);
      break;
    case PROP_DESC:
      g_value_set_string (value, priv->desc);
      break;
    case PROP_LAT:
      g_value_set_float (value, priv->lat);
      break;
    case PROP_LON:
      g_value_set_float (value, priv->lon);
      break;
    case PROP_LOCATION_TYPE:
      g_value_set_enum (value, priv->location_type);
      break;
    case PROP_PARENT_STATION:
      g_value_set_object (value, priv->parent_station);
      break;
    case PROP_TIMEZONE:
      g_value_set_boxed (value, priv->timezone);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_stop_class_init (MapsGTFSStopClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_gtfs_stop_finalize;
  object_class->get_property = maps_gtfs_stop_get_property;

  properties[PROP_ID] =
    g_param_spec_string ("id",
                         "ID", "Unique identifier for stop",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_CODE] =
    g_param_spec_string ("code",
                         "Code", "Short text or a number that identifies the location for riders",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_NAME] =
    g_param_spec_string ("name",
                         "Name", "Name of the location",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_DESC] =
    g_param_spec_string ("desc",
                         "Description", "Description of the location that provides useful, quality information",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_LAT] =
    g_param_spec_float ("lat",
                        "Latitude", "Latitude of location",
                        -90, 90, 0,
                        G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_LON] =
    g_param_spec_float ("lon",
                        "Longitude", "Longitude of location",
                        -180, 180, 0,
                        G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_LOCATION_TYPE] =
    g_param_spec_enum ("location_type",
                       "Location type", "Type of the location",
                       MAPS_TYPE_GTFS_STOP_LOCATION_TYPE,
                       MAPS_GTFS_STOP_STOP,
                       G_PARAM_READABLE|G_PARAM_STATIC_STRINGS);
  properties[PROP_PARENT_STATION] =
    g_param_spec_object ("parent_station",
                         "Parent station", "Parent station",
                         MAPS_TYPE_GTFS_STOP,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_TIMEZONE] =
    g_param_spec_boxed ("timezone",
                        "Timezone", "Local timezone for stop (if different from agency's)",
                        G_TYPE_TIME_ZONE,
                        G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);

  g_object_class_install_properties (object_class, N_PROPS, properties);
}

static void
maps_gtfs_stop_init (MapsGTFSStop *self)
{
  MapsGTFSStopPrivate *priv = maps_gtfs_stop_get_instance_private (self);

  priv->id = NULL;
  priv->code = NULL;
  priv->name = NULL;
  priv->desc = NULL;
  priv->lat = 0.0f;
  priv->lon = 0.0f;
  priv->location_type = MAPS_GTFS_STOP_STOP;
  priv->parent_station = NULL;
  priv->timezone = NULL;
}
