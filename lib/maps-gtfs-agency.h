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

#define MAPS_TYPE_GTFS_AGENCY (maps_gtfs_agency_get_type())

G_DECLARE_DERIVABLE_TYPE (MapsGTFSAgency, maps_gtfs_agency, MAPS, GTFS_AGENCY, GObject)

struct _MapsGTFSAgencyClass
{
  GObjectClass parent_class;
};

MapsGTFSAgency *maps_gtfs_agency_new (gchar *id, gchar *name, gchar *url,
                                      GTimeZone *timezone, gchar *lang,
                                      gchar *phone, gchar *fare_url,
                                      gchar *email);

G_END_DECLS
