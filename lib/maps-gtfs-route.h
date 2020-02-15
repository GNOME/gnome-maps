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

#pragma once

#include <glib-object.h>

G_BEGIN_DECLS

#define MAPS_TYPE_GTFS_ROUTE (maps_gtfs_route_get_type())

G_DECLARE_DERIVABLE_TYPE (MapsGTFSRoute, maps_gtfs_route, MAPS, GTFS_ROUTE, GObject)

struct _MapsGTFSRouteClass
{
  GObjectClass parent_class;
};

MapsGTFSRoute *maps_gtfs_route_new (gchar *id, gchar *agency_id,
                                    gchar *short_name,
                                    gchar *long_name, guint16 type, gchar *color,
                                    gchar *text_color);

G_END_DECLS