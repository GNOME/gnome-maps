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

#ifndef __MAPS_GTFS__
#define __MAPS_GTFS__

#include <glib-object.h>

#define MAPS_TYPE_GTFS maps_gtfs_get_type ()
G_DECLARE_FINAL_TYPE(MapsGTFS, maps_gtfs, MAPS, GTFS, GObject)

typedef struct _MapsGTFSPrivate MapsGTFSPrivate;

struct _MapsGTFS
{
  GObject parent_instance;
  MapsGTFSPrivate *priv;
};


struct _MapsGTFSClass
{
  GObjectClass parent_class;
};

MapsGTFS *maps_gtfs_new (char *file);

void maps_gtfs_parse (MapsGTFS *gtfs, GError **error);

#endif //__MAPS_GTFS__