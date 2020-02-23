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

typedef struct
{
  gchar *id;
  gchar *code;
  gchar *name;
  gchar *desc;
  float lat;
  float lon;
  MapsGTFSStopLocationType location_type;
  gchar *parent_station;
  GTimeZone *timezone;
} MapsGTFSStopPrivate;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFSStop, maps_gtfs_stop, G_TYPE_OBJECT)

enum {
  PROP_0,
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
maps_gtfs_stop_new (gchar *id, gchar *code, gchar *name, gchar *desc,
                    float lat, float lon,
                    MapsGTFSStopLocationType location_type,
                    gchar *parent_station, GTimeZone *timezone)
{
  return g_object_new (MAPS_TYPE_GTFS_STOP, NULL);
}

static void
maps_gtfs_stop_finalize (GObject *object)
{
  MapsGTFSStop *self = (MapsGTFSStop *)object;
  MapsGTFSStopPrivate *priv = maps_gtfs_stop_get_instance_private (self);

  G_OBJECT_CLASS (maps_gtfs_stop_parent_class)->finalize (object);
}

static void
maps_gtfs_stop_get_property (GObject    *object,
                             guint       prop_id,
                             GValue     *value,
                             GParamSpec *pspec)
{
  MapsGTFSStop *self = MAPS_GTFS_STOP (object);

  switch (prop_id)
    {
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    }
}

static void
maps_gtfs_stop_set_property (GObject      *object,
                             guint         prop_id,
                             const GValue *value,
                             GParamSpec   *pspec)
{
  MapsGTFSStop *self = MAPS_GTFS_STOP (object);

  switch (prop_id)
    {
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
  object_class->set_property = maps_gtfs_stop_set_property;
}

static void
maps_gtfs_stop_init (MapsGTFSStop *self)
{
}
