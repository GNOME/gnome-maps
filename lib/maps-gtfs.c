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

#include "maps-gtfs.h"

struct _MapsGTFSPrivate
{
  char *file;
};

enum {
  PROP_0,
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFS, maps_gtfs, G_TYPE_OBJECT)

static void
maps_gtfs_class_init (MapsGTFSClass *klass)
{
}

static void
maps_gtfs_init (MapsGTFS *gtfs)
{
  gtfs->priv = maps_gtfs_get_instance_private (gtfs);
  gtfs->priv->file = NULL;
}

MapsGTFS *
maps_gtfs_new (char *file)
{
  MapsGTFS *gtfs = g_object_new (MAPS_TYPE_GTFS, NULL);
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  priv->file = g_strdup (file);
  return gtfs;
}

void
maps_gtfs_parse (GError **error)
{

}
