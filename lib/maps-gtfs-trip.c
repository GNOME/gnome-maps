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

#include "maps-gtfs-trip.h"

struct _MapsGTFSTrip
{
  GObject parent_instance;
};

typedef struct
{
  gchar *route_id;
  gchar *service_id;
  gchar *id;
  gchar *headsign;
  gchar *short_name;
} MapsGTFSTripPrivate;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFSTrip, maps_gtfs_trip, G_TYPE_OBJECT)

enum {
  PROP_0,
  PROP_ROUTE_ID,
  PROP_SERVICE_ID,
  PROP_ID,
  PROP_HEADSIGN,
  PROP_SHORT_NAME,
  N_PROPS
};

static GParamSpec *properties [N_PROPS];

/**
 * maps_gtfs_trip_new:
 *
 * Create a new #MapsGTFSTrip.
 *
 * Returns: (transfer full): a newly created #MapsGTFSTrip
 */
MapsGTFSTrip *
maps_gtfs_trip_new (gchar *route_id, gchar *service_id, gchar *id,
                    gchar *headsign, gchar *short_name, gchar *shape_id)
{
  MapsGTFSTrip *trip = MAPS_GTFS_TRIP (g_object_new (MAPS_TYPE_GTFS_TRIP, NULL));
  MapsGTFSTripPrivate *priv = maps_gtfs_trip_get_instance_private (trip);

  priv->route_id = g_strdup (route_id);
  priv->service_id = g_strdup (service_id);
  priv->id = g_strdup (id);
  priv->headsign = g_strdup (headsign);
  priv->short_name = g_strdup (short_name);

  return trip;
}

static void
maps_gtfs_trip_finalize (GObject *object)
{
  MapsGTFSTrip *self = (MapsGTFSTrip *)object;
  MapsGTFSTripPrivate *priv = maps_gtfs_trip_get_instance_private (self);

  g_clear_pointer (&priv->route_id, g_free);
  g_clear_pointer (&priv->service_id, g_free);
  g_clear_pointer (&priv->id, g_free);
  g_clear_pointer (&priv->headsign, g_free);
  g_clear_pointer (&priv->short_name, g_free);

  G_OBJECT_CLASS (maps_gtfs_trip_parent_class)->finalize (object);
}

static void
maps_gtfs_trip_get_property (GObject    *object,
                             guint       prop_id,
                             GValue     *value,
                             GParamSpec *pspec)
{
  MapsGTFSTrip *self = MAPS_GTFS_TRIP (object);
  MapsGTFSTripPrivate *priv = maps_gtfs_trip_get_instance_private (self);

  switch (prop_id)
    {
    case PROP_ROUTE_ID:
      g_value_set_string (value, priv->route_id);
      break;
    case PROP_SERVICE_ID:
      g_value_set_string (value, priv->service_id);
      break;
    case PROP_ID:
      g_value_set_string (value, priv->id);
      break;
    case PROP_HEADSIGN:
      g_value_set_string (value, priv->headsign);
      break;
    case PROP_SHORT_NAME:
      g_value_set_string (value, priv->short_name);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_trip_class_init (MapsGTFSTripClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->finalize = maps_gtfs_trip_finalize;
  object_class->get_property = maps_gtfs_trip_get_property;

  properties[PROP_ROUTE_ID] =
    g_param_spec_string ("route_id",
                         "Route ID", "Reference to the route",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_SERVICE_ID] =
    g_param_spec_string ("service_id",
                         "Service ID", "Reference to calendar or calendar_date",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_ID] =
    g_param_spec_string ("id",
                         "ID", "Unique identifier",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_HEADSIGN] =
    g_param_spec_string ("headsign",
                         "Headsign",
                         "Destination sign for the trip, can be overridden in a StopTime",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);
  properties[PROP_SHORT_NAME] =
    g_param_spec_string ("short_name",
                         "Short name", "Identifier for the trip (e.g. a train number)",
                         NULL,
                         G_PARAM_READABLE|G_PARAM_EXPLICIT_NOTIFY);

  g_object_class_install_properties (object_class, N_PROPS, properties);
}

static void
maps_gtfs_trip_init (MapsGTFSTrip *self)
{
}
