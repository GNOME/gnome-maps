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

#include "maps-gtfs-db-funcs.h"

#include <glib.h>
#include <math.h>

#define EARTH_RADIUS_M 6372795

static void
distance_func (sqlite3_context *ctx, gint argc, sqlite3_value **argv)
{
  gdouble lat_a = sqlite3_value_double (argv[0]);
  gdouble lon_a = sqlite3_value_double (argv[1]);
  gdouble lat_b = sqlite3_value_double (argv[2]);
  gdouble lon_b = sqlite3_value_double (argv[3]);

  gdouble dlat, dlon, lat1, lat2;
  gdouble a, c;

  dlat = (lat_b - lat_a) * M_PI / 180.0;
  dlon = (lon_b - lon_a) * M_PI / 180.0;
  lat1 = lat_a * M_PI / 180.0;
  lat2 = lat_b * M_PI / 180.0;

  a = sin (dlat / 2) * sin (dlat / 2) +
      sin (dlon / 2) * sin (dlon / 2) * cos (lat1) * cos (lat2);
  c = 2 * atan2 (sqrt (a), sqrt (1-a));

  sqlite3_result_double (ctx, EARTH_RADIUS_M * c);
}

void
maps_gtfs_db_funcs_init (sqlite3 *db)
{
  sqlite3_create_function_v2 (db, "DISTANCE", 4,
                              SQLITE_UTF8  | SQLITE_DETERMINISTIC,
                              NULL, distance_func, NULL, NULL, NULL);
}
