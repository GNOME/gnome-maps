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

#ifndef __MAPS_OSM_NODE_H__
#define __MAPS_OSM_NODE_H__

#include "maps-osm-object.h"

#include <glib-object.h>

#define MAPS_TYPE_OSMNODE maps_osm_node_get_type ()
G_DECLARE_FINAL_TYPE(MapsOSMNode, maps_osm_node, MAPS, OSMNODE, MapsOSMObject)

typedef struct _MapsOSMNodePrivate MapsOSMNodePrivate;

struct _MapsOSMNode
{
  MapsOSMObject parent_instance;
  MapsOSMNodePrivate *priv;
};

struct _MapsOSMNodeClass
{
  MapsOSMObjectClass parent_class;
};

MapsOSMNode *maps_osm_node_new (guint64 id, guint version, guint64 changeset,
                                double longitude, double latitude);

#endif //__MAPS_OSM_NODE_H__
