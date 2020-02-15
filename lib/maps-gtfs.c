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
  char *name;
};

enum {
  PROP_0,
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFS, maps_gtfs, MAPS_TYPE_GTFS)

static void
maps_gtfs_class_init (MapsGTFSClass *klass)
{
}

static void
maps_gtfs_init (MapsGTFS *gtfs)
{
  gtfs->priv->name = NULL;
}

