/*
 * Copyright (c) 2015 Marcus Lundblad
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

#ifndef __MAPS_OSM_WAY_H__
#define __MAPS_OSM_WAY_H__

#include "maps-osm-object.h"

#include <glib-object.h>

#define MAPS_TYPE_OSMWAY maps_osm_way_get_type ()
G_DECLARE_FINAL_TYPE(MapsOSMWay, maps_osm_way, MAPS, OSMWAY, MapsOSMObject)

typedef struct _MapsOSMWayPrivate MapsOSMWayPrivate;

struct _MapsOSMWay
{
  MapsOSMObject parent_instance;
  MapsOSMWayPrivate *priv;
};

struct _MapsOSMWayClass
{
  MapsOSMObjectClass parent_class;
};

MapsOSMWay *maps_osm_way_new (guint64 id, guint version, guint64 changeset);

void maps_osm_way_add_node_id (MapsOSMWay *way, guint64 id);

#endif /* __MAPS_OSM_WAY_H__ */

