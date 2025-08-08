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

#ifndef __MAPS_OSM_H__
#define __MAPS_OSM_H__

#include <glib.h>

#include "maps-osm-node.h"
#include "maps-osm-way.h"
#include "maps-osm-relation.h"

void maps_osm_init (void);
void maps_osm_finalize (void);

MapsOSMObject *maps_osm_parse (const char *content, guint length,
                               GError **error);

#endif
