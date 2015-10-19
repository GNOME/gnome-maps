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

#ifndef __MAPS_OSM_RELATION_H__
#define __MAPS_OSM_RELATION_H__

#include "maps-osm-object.h"

#include <glib-object.h>

#define MAPS_TYPE_OSMRELATION maps_osm_relation_get_type ()
G_DECLARE_FINAL_TYPE(MapsOSMRelation, maps_osm_relation, MAPS, OSMRELATION,
                     MapsOSMObject)

typedef struct _MapsOSMRelationPrivate MapsOSMRelationPrivate;

struct _MapsOSMRelation
{
  MapsOSMObject parent_instance;
  MapsOSMRelationPrivate *priv;
};

struct _MapsOSMRelationClass
{
  MapsOSMObjectClass parent_class;
};

enum {
  MEMBER_TYPE_NODE,
  MEMBER_TYPE_WAY,
  MEMBER_TYPE_RELATION
};

MapsOSMRelation *maps_osm_relation_new (guint64 id, guint version,
                                        guint64 changeset);

void maps_osm_relation_add_member (MapsOSMRelation *relation, const char *role,
                                   guint type, guint64 ref);

#endif /* __MAPS_OSM_RELATION_H__ */

