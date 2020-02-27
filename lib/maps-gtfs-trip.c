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

  G_OBJECT_CLASS (maps_gtfs_trip_parent_class)->finalize (object);
}

static void
maps_gtfs_trip_get_property (GObject    *object,
                             guint       prop_id,
                             GValue     *value,
                             GParamSpec *pspec)
{
  MapsGTFSTrip *self = MAPS_GTFS_TRIP (object);

  switch (prop_id)
    {
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_trip_set_property (GObject      *object,
                             guint         prop_id,
                             const GValue *value,
                             GParamSpec   *pspec)
{
  MapsGTFSTrip *self = MAPS_GTFS_TRIP (object);

  switch (prop_id)
    {
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
  object_class->set_property = maps_gtfs_trip_set_property;
}

static void
maps_gtfs_trip_init (MapsGTFSTrip *self)
{
}
