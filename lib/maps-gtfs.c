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
#include "maps-gtfs-agency.h"
#include "maps-gtfs-db-defs.h"
#include "maps-gtfs-db-funcs.h"
#include "maps-gtfs-route.h"
#include "maps-gtfs-stop.h"
#include "maps-gtfs-trip.h"
#include "mapsintl.h"

#include <archive.h>
#include <archive_entry.h>
#include <glib.h>
#include <string.h>
#include <sqlite3.h>

#define MAPS_GTFS_ERROR maps_gtfs_error_quark ()

#define BLOCK_SIZE 1048576 // 1024 * 1024

GQuark
maps_gtfs_error_quark (void)
{
  return g_quark_from_static_string ("maps-gtfs-error");
}

struct _MapsGTFSPrivate
{
  gchar *file;
  gchar *read_buffer;
  guint read_size;
  guint read_pos;
  GTimeZone *timezone;
  GHashTable *agencies;
  GHashTable *stops;
  GHashTable *routes;
  GHashTable *trips;
  sqlite3 *db;
  gboolean db_needs_commit;
};

enum {
  PROP_0,
};

/*
 * File types expected in a GTFS feed.
 * https://developers.google.com/transit/gtfs/reference/#dataset_files
 */
typedef enum {
  AGENCY,
  STOPS,
  ROUTES,
  TRIPS,
  STOP_TIMES,
  CALENDAR,
  CALENDAR_DATES,
  FARE_ATTRIBUTES,
  FARE_RULES,
  SHAPES,
  FREQUENCIES,
  TRANSFERS,
  PATHWAYS,
  LEVELS,
  FEED_INFO,
  TRANSLATIONS,
  ATTRIBUTIONS
} FileType;

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFS, maps_gtfs, G_TYPE_OBJECT)

static void
maps_gtfs_dispose (GObject *object)
{
  MapsGTFS *gtfs = MAPS_GTFS (object);
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  g_clear_pointer (&priv->file, g_free);
  g_clear_pointer (&priv->read_buffer, g_free);
  g_clear_pointer (&priv->agencies, g_hash_table_destroy);
  g_clear_pointer (&priv->stops, g_hash_table_destroy);
  g_clear_pointer (&priv->routes, g_hash_table_destroy);
  g_clear_pointer (&priv->trips, g_hash_table_destroy);
  g_clear_pointer (&priv->timezone, g_time_zone_unref);
  g_clear_pointer (&priv->db, sqlite3_close);

  G_OBJECT_CLASS (maps_gtfs_parent_class)->dispose (object);
}

static void
maps_gtfs_class_init (MapsGTFSClass *klass)
{
  GObjectClass *maps_class = G_OBJECT_CLASS (klass);

  maps_class->dispose = maps_gtfs_dispose;
}

static void
maps_gtfs_init (MapsGTFS *gtfs)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  priv->file = NULL;
  priv->read_buffer = g_malloc (BLOCK_SIZE);
  /* indicate we need to read a new chunk of data when reading the first line */
  priv->read_pos = 0;
  priv->read_size = 0;
  priv->agencies =
    g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
  priv->stops =
    g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
  priv->routes =
    g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
  priv->trips =
    g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
}

MapsGTFS *
maps_gtfs_new (char *name, GError **error)
{
  MapsGTFS *gtfs = g_object_new (MAPS_TYPE_GTFS, NULL);
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  g_autofree gchar *basedir = g_build_filename (g_get_user_cache_dir (),
                                                "gnome-maps", "gtfs", NULL);
  g_autofree gchar *dbfile = g_strdup_printf ("%s.db", name);
  g_autofree gchar *gtfsfile = g_strdup_printf ("%s.zip", name);
  g_autofree gchar *dbfilename = g_build_filename (basedir, dbfile, NULL);

  gint res = sqlite3_open_v2 (dbfilename, &priv->db,
                              SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, NULL);

  if (res != SQLITE_OK) {
    *error = g_error_new (MAPS_GTFS_ERROR, 0,
                          "Failed to open SQLite database: %s",
                          sqlite3_errmsg (priv->db));
    priv->db = NULL;
  }

  priv->db_needs_commit = sqlite3_get_autocommit (priv->db);
  priv->file = g_build_filename (basedir, gtfsfile, NULL);

  return gtfs;
}

static void
reset_read_buffer (MapsGTFS *gtfs)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  priv->read_pos = 0;
  priv->read_size = 0;
}

static char *
read_line (MapsGTFS *gtfs, struct archive *a)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  int i;
  gchar *result;

  if (priv->read_pos == priv->read_size) {
    priv->read_size = archive_read_data (a, priv->read_buffer, BLOCK_SIZE);
    priv->read_pos = 0;

    if (priv->read_size < 0) {
      g_warning ("Failed to read data");
      return NULL;
    } else if (priv->read_size == 0) {
      g_debug ("No more data to read");
      return NULL;
    }

    // skip any line break characters spilling over into the new buffer
    while ((priv->read_buffer[priv->read_pos] == '\n' ||
            priv->read_buffer[priv->read_pos] == '\r') &&
           priv->read_pos < priv->read_size) {
      priv->read_pos++;
    }
  }

  /* find next line break */
  i = priv->read_pos;
  while (priv->read_buffer[i] != '\n' && priv->read_buffer[i] != '\r' &&
         i < priv->read_size) {
    i++;
  }

  /* if we didn't read til the end of the buffer, just copy the line */
  if (i < priv->read_size) {
    result = g_strndup (priv->read_buffer + priv->read_pos, i - priv->read_pos);
    priv->read_pos = i;
    /* skip upcoming newline(s) */
    while ((priv->read_buffer[priv->read_pos] == '\n' ||
            priv->read_buffer[priv->read_pos] == '\r') &&
           priv->read_pos < priv->read_size) {
      priv->read_pos++;
    }
  } else {
    /* copy the first part up to the buffer end */
    g_autofree gchar *first =
      g_strndup (priv->read_buffer + priv->read_pos, i - priv->read_pos);

    /* read next chunk */
    priv->read_size = archive_read_data (a, priv->read_buffer, BLOCK_SIZE);
    priv->read_pos = 0;

    if (priv->read_size < 0) {
      g_warning ("Failed to read data");
      return NULL;
    } else if (priv->read_size == 0) {
      g_debug ("No more data to read");
      return NULL;
    }

    /* find next line break */
    i = priv->read_pos;
    while (priv->read_buffer[i] != '\n' && priv->read_buffer[i] != '\r' &&
           i < priv->read_size) {
      i++;
    }
    priv->read_pos = i;

    /* copy next part, read from new buffer */
    g_autofree gchar *second = g_strndup (priv->read_buffer, i);

    /* skip upcoming newline(s) */
    while ((priv->read_buffer[priv->read_pos] == '\n' ||
            priv->read_buffer[priv->read_pos] == '\r') &&
           priv->read_pos < priv->read_size) {
      priv->read_pos++;
    }

    /* concatenate parts */
    result = g_strdup_printf("%s%s", first, second);
  }

  return result;
}

static gchar **
parse_header (const gchar *filename, const gchar *header, ...)
{
  gchar **headers = g_strsplit (header, ",", -1);
  va_list ap;
  gboolean missing_required = FALSE;
  g_autoptr(GHashTable) fields = g_hash_table_new (g_str_hash, g_str_equal);

  va_start (ap, header);
  for (;;) {
    gchar *field = va_arg (ap, gchar *);
    gboolean required;

    if (!field)
      break;

    required = va_arg (ap, gboolean);
    g_hash_table_insert (fields, field, field);

    if (required) {
      gboolean found_required = FALSE;

      for (int i = 0; headers[i]; i++) {
        if (g_str_equal (headers[i], field))
          found_required = TRUE;
      }

      if (!found_required) {
        missing_required = TRUE;
        g_error ("Missing required field %s in %s", field, filename);
        break;
      }
    }
  }
  va_end (ap);

  for (int i = 0; headers[i]; i++) {
    const gchar *found_field = g_hash_table_lookup (fields, headers[i]);

    if (!found_field)
      g_warning ("Unknown field %s in %s", headers[i], filename);
  }

  g_debug ("missing required: %s", missing_required ? "true" : "false");

  if (missing_required) {
    g_strfreev (headers);
    return NULL;
  } else {
    return headers;
  }
}

static gboolean
parse_line (const gchar *line, gchar **header_fields, gint num_fields,
            GHashTable *entries)
{
  g_autofree gchar **fields = NULL;
  gboolean in_quotes = FALSE;
  gboolean escape = FALSE;

  if (line[0] == '\0')
    return FALSE;

  if (!g_strstr_len (line, -1, "\"")) {
    // if the input line contains no quoted strings, just do a simple split
    fields = g_strsplit (line, ",", -1);
  } else {
    gint len = strlen (line) + 1;
    g_autofree gchar *field = g_malloc0 (len);
    gint index = 0;
    gint j = 0;

    fields = g_malloc0_n (num_fields + 1, sizeof (gchar *));
    for (gint i = 0; line[i]; i++) {
      gchar c = line[i];

      if (index >= num_fields) {
        g_error ("Too many fields read");
        g_strfreev (fields);
        return FALSE;
      }

      if (escape) {
        field[j] = c;
        escape = FALSE;
        j++;
      } else {
        escape = (c == '\\');
      }

      if (c == ',' && !in_quotes) {
        fields[index] = g_strdup (field);
        memset (field, '\0', len);
        index++;
        j = 0;
        continue;
      }

      if (c == '"') {
        in_quotes = !in_quotes;
      } else {
        field[j] = c;
        j++;
      }
    }

    fields[index] = g_strdup (field);
  }

  if (g_strv_length (fields) != num_fields) {
    g_error ("Number of fields read didn't match header");
    g_clear_pointer (&fields, g_strfreev);
    return FALSE;
  } else {
    for (gint i = 0; i < num_fields; i++) {
      gchar *field = g_strstrip (fields[i]);

      if (field[0] == '\0') {
        g_free (fields[i]);
        field = NULL;
      }

      g_hash_table_insert (entries, header_fields[i], field);
    }
    return TRUE;
  }
}

static gboolean
process_agency (MapsGTFS *gtfs, GHashTable *entry, sqlite3_stmt *p_stmt)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  GTimeZone *tz;

  const gchar *id = g_hash_table_lookup (entry, "agency_id");
  const gchar *name = g_hash_table_lookup (entry, "agency_name");
  const gchar *url = g_hash_table_lookup (entry, "agency_url");
  const gchar *timezone = g_hash_table_lookup (entry, "agency_timezone");
  const gchar *lang = g_hash_table_lookup (entry, "agency_lang");
  const gchar *phone = g_hash_table_lookup (entry, "agency_phone");
  const gchar *fare_url = g_hash_table_lookup (entry, "agency_fare_url");
  const gchar *email = g_hash_table_lookup (entry, "agency_email");

  /* agency_id is required if there's more than one agency */
  if (!id && g_hash_table_size (priv->agencies) > 0) {
    g_error ("Field agency_id is required when there's more than one agency");
    return FALSE;
  }

  tz = g_time_zone_new (timezone);

  if (!priv->timezone) {
    priv->timezone = g_time_zone_ref (tz);
  } else if (!g_str_equal (g_time_zone_get_identifier (tz),
                           g_time_zone_get_identifier (priv->timezone))) {
    g_error ("All agencies in the feed must use the timezone");
    g_time_zone_unref (tz);
    return FALSE;
  }

  g_time_zone_unref (tz);
  sqlite3_bind_text (p_stmt, 1, id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 2, name, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 3, url, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 4, timezone, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 5, lang, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 6, phone, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 7, fare_url, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 8, email, -1, SQLITE_TRANSIENT);

  return TRUE;
}

static gboolean
process_stop (GHashTable *entry, sqlite3_stmt *p_stmt)
{
  const gchar *id = g_hash_table_lookup (entry, "stop_id");
  const gchar *code = g_hash_table_lookup (entry, "stop_code");
  const gchar *name = g_hash_table_lookup (entry, "stop_name");
  const gchar *desc = g_hash_table_lookup (entry, "stop_desc");
  const gchar *lat = g_hash_table_lookup (entry, "stop_lat");
  const gchar *lon = g_hash_table_lookup (entry, "stop_lon");
  const gchar *zone_id = g_hash_table_lookup (entry, "zone_id");
  const gchar *url = g_hash_table_lookup (entry, "stop_url");
  const gchar *location_type = g_hash_table_lookup (entry, "location_type");
  const gchar *parent_station = g_hash_table_lookup (entry, "parent_station");
  const gchar *timezone = g_hash_table_lookup (entry, "stop_timezone");
  const gchar *wheelchair_boarding = g_hash_table_lookup (entry, "wheelchair_boarding");
  const gchar *level_id = g_hash_table_lookup (entry, "level_id");
  const gchar *platform_code = g_hash_table_lookup (entry, "platform_code");

  sqlite3_bind_text (p_stmt, 1, id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 2, code, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 3, name, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 4, desc, -1, SQLITE_TRANSIENT);

  if (lat)
    sqlite3_bind_double (p_stmt, 5, g_ascii_strtod (lat, NULL));
  else
    sqlite3_bind_null (p_stmt, 5);

  if (lon)
    sqlite3_bind_double (p_stmt, 6, g_ascii_strtod (lon, NULL));
  else
    sqlite3_bind_null (p_stmt, 6);

  sqlite3_bind_text (p_stmt, 7, zone_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 8, url, -1, SQLITE_TRANSIENT);

  if (location_type)
    sqlite3_bind_int (p_stmt, 9, g_ascii_strtoull (location_type, NULL, 10));
  else
    sqlite3_bind_null (p_stmt, 9);

  sqlite3_bind_text (p_stmt, 10, parent_station, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 11, timezone, -1, SQLITE_TRANSIENT);

  if (wheelchair_boarding)
    sqlite3_bind_int (p_stmt, 12, g_ascii_strtoull (wheelchair_boarding, NULL, 10));
  else
    sqlite3_bind_null (p_stmt, 12);

  sqlite3_bind_text (p_stmt, 13, level_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 14, platform_code, -1, SQLITE_TRANSIENT);

  return TRUE;
}

static gboolean
process_route (GHashTable *entry, sqlite3_stmt *p_stmt)
{
  const gchar *id = g_hash_table_lookup (entry, "route_id");
  const gchar *agency_id = g_hash_table_lookup (entry, "agency_id");
  const gchar *short_name = g_hash_table_lookup (entry, "route_short_name");
  const gchar *long_name = g_hash_table_lookup (entry, "route_long_name");
  const gchar *desc = g_hash_table_lookup (entry, "route_desc");
  const gchar *route_type = g_hash_table_lookup (entry, "route_type");
  const gchar *url = g_hash_table_lookup (entry, "route_url");
  const gchar *color = g_hash_table_lookup (entry, "route_color");
  const gchar *text_color = g_hash_table_lookup (entry, "route_text_color");

  // TODO: maybe later add post-check after parsing all files: agency_id is required if there's more than one agency in the feed

  // either route_short_name or route_long_name must be specified
  if (!short_name && !long_name) {
    g_warning ("Route must specify either route_short_name or route_long_name");
    return FALSE;
  }

  sqlite3_bind_text (p_stmt, 1, id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 2, agency_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 3, short_name, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 4, long_name, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 5, desc, -1, SQLITE_TRANSIENT);
  sqlite3_bind_int (p_stmt, 6, g_ascii_strtoull (route_type, NULL, 10));
  sqlite3_bind_text (p_stmt, 7, url, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 8, color, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 9, text_color, -1, SQLITE_TRANSIENT);

  return TRUE;
}

static gboolean
process_trip (GHashTable *entry, sqlite3_stmt *p_stmt)
{
  const gchar *route_id = g_hash_table_lookup (entry, "route_id");
  const gchar *service_id = g_hash_table_lookup (entry, "service_id");
  const gchar *id = g_hash_table_lookup (entry, "trip_id");
  const gchar *headsign = g_hash_table_lookup (entry, "trip_headsign");
  const gchar *short_name = g_hash_table_lookup (entry, "trip_short_name");
  const gchar *direction_id = g_hash_table_lookup (entry, "direction_id");
  const gchar *block_id = g_hash_table_lookup (entry, "block_id");
  const gchar *shape_id = g_hash_table_lookup (entry, "shape_id");
  const gchar *wheelchair_accessible =
                     g_hash_table_lookup (entry, "wheelchair_accessible");
  const gchar *bikes_allowed = g_hash_table_lookup (entry, "bikes_allowed");

  sqlite3_bind_text (p_stmt, 1, route_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 2, service_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 3, id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 4, headsign, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 5, short_name, -1, SQLITE_TRANSIENT);
  if (direction_id)
    sqlite3_bind_int (p_stmt, 6, g_ascii_strtoull (direction_id, NULL, 10));
  else
    sqlite3_bind_null (p_stmt, 6);
  sqlite3_bind_text (p_stmt, 7, block_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_text (p_stmt, 8, shape_id, -1, SQLITE_TRANSIENT);
  if (wheelchair_accessible)
    sqlite3_bind_int (p_stmt, 9, g_ascii_strtoull (wheelchair_accessible, NULL, 10));
  else
    sqlite3_bind_null (p_stmt, 9);
  if (bikes_allowed)
    sqlite3_bind_int (p_stmt, 10, g_ascii_strtoull (bikes_allowed, NULL, 10));
  else
    sqlite3_bind_null (p_stmt, 10);

  return TRUE;
}

static gint32
parse_time (const gchar *time)
{
  gint len = strlen (time);

  switch (len) {
  case 7:
    if (time[1] != ':' || time[4] != ':' || time[0] < '0' || time[0] > '9' ||
        time[2] < '0' || time[2] > '9' || time[3] < '0' || time[3] > '9' ||
        time[5] < '0' || time[5] > '9' || time[6] < '0' || time[6] > '9') {
      g_warning ("Failed to parse time string: %s", time);
      return -1;
    }
    return (time[0] - '0') * 3600 + (time[2] - '0') * 600 +
           (time[3] - '0') * 60 + (time[5] - '0') * 10 + (time[6] - '0');
  case 8:
    if (time[2] != ':' || time[5] != ':' || time[0] < '0' || time[0] > '9' ||
        time[1] < '0' || time[1] > '9' || time[3] < '0' || time[3] > '9' ||
        time[4] < '0' || time[4] > '9' || time[6] < '0' || time[6] > '9' ||
        time[7] < '0' || time[7] > '9') {
      g_warning ("Failed to parse time string: %s", time);
      return -1;
    }
    return (time[0] - '0') * 36000 + (time[1] - '0') * 3600 +
           (time[3] - '0') * 600 + (time[4] - '0') * 60 +
           (time[6] - '0') * 10 + (time[7] - '0');
  default:
    g_warning ("Failed to parse time string: %s", time);
    return -1;
  }
}

static gboolean
parse_boolean (const gchar *text)
{
  return text && text[0] == '1';
}

static gboolean
process_stop_time (GHashTable *entry, sqlite3_stmt *p_stmt)
{
  const gchar *trip_id = g_hash_table_lookup (entry, "trip_id");
  const gchar *arrival_time = g_hash_table_lookup (entry, "arrival_time");
  const gchar *departure_time = g_hash_table_lookup (entry, "departure_time");
  const gchar *stop_id = g_hash_table_lookup (entry, "stop_id");
  const gchar *stop_sequence = g_hash_table_lookup (entry, "stop_sequence");
  const gchar *stop_headsign = g_hash_table_lookup (entry, "stop_headsign");
  const gchar *pickup_type = g_hash_table_lookup (entry, "pickup_type");
  const gchar *drop_off_type = g_hash_table_lookup (entry, "drop_off_type");

  if (!arrival_time && !departure_time) {
    g_warning ("Must specify arrival_time or departure_time");
    return FALSE;
  }

  sqlite3_bind_text (p_stmt, 1, trip_id, -1, SQLITE_TRANSIENT);
  if (arrival_time)
    sqlite3_bind_int (p_stmt, 2, parse_time (arrival_time));
  else
    sqlite3_bind_null (p_stmt, 2);
  if (departure_time)
    sqlite3_bind_int (p_stmt, 3, parse_time (departure_time));
  else
    sqlite3_bind_null (p_stmt, 3);
  sqlite3_bind_text (p_stmt, 4, stop_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_int (p_stmt, 5, g_ascii_strtoull (stop_sequence, NULL, 10));
  sqlite3_bind_text (p_stmt, 6, stop_headsign, -1, SQLITE_TRANSIENT);
  sqlite3_bind_int (p_stmt, 7, parse_boolean (pickup_type));
  sqlite3_bind_int (p_stmt, 8, parse_boolean (drop_off_type));

  return TRUE;
}

static gboolean
process_calendar (GHashTable *entry, sqlite3_stmt *p_stmt)
{
  const gchar *service_id = g_hash_table_lookup (entry, "service_id");
  const gchar *monday = g_hash_table_lookup (entry, "monday");
  const gchar *tuesday = g_hash_table_lookup (entry, "tuesday");
  const gchar *wednesday = g_hash_table_lookup (entry, "wednesday");
  const gchar *thursday = g_hash_table_lookup (entry, "thursday");
  const gchar *friday = g_hash_table_lookup (entry, "friday");
  const gchar *saturday = g_hash_table_lookup (entry, "saturday");
  const gchar *sunday = g_hash_table_lookup (entry, "sunday");
  const gchar *start_date = g_hash_table_lookup (entry, "start_date");
  const gchar *end_date = g_hash_table_lookup (entry, "end_date");

  sqlite3_bind_text (p_stmt, 1, service_id, -1, SQLITE_TRANSIENT);
  sqlite3_bind_int (p_stmt, 2, parse_boolean (monday));
  sqlite3_bind_int (p_stmt, 3, parse_boolean (tuesday));
  sqlite3_bind_int (p_stmt, 4, parse_boolean (wednesday));
  sqlite3_bind_int (p_stmt, 5, parse_boolean (thursday));
  sqlite3_bind_int (p_stmt, 6, parse_boolean (friday));
  sqlite3_bind_int (p_stmt, 7, parse_boolean (saturday));
  sqlite3_bind_int (p_stmt, 8, parse_boolean (sunday));
  sqlite3_bind_int (p_stmt, 9, g_ascii_strtoull (start_date, NULL, 10));
  sqlite3_bind_int (p_stmt, 10, g_ascii_strtoull (end_date, NULL, 10));

  return TRUE;
}

static gboolean
process_calendar_date (GHashTable *entry, sqlite3_stmt *p_stmt)
{
  const gchar *service_id = g_hash_table_lookup (entry, "service_id");
  const gchar *date = g_hash_table_lookup (entry, "date");
  const gchar *exception_type = g_hash_table_lookup (entry, "exception_type");

  sqlite3_bind_text (p_stmt, 1, service_id, -1, SQLITE_TRANSIENT);

  if (!date) {
    g_warning ("Missing date in calendar_dates");
    return FALSE;
  }
  sqlite3_bind_int (p_stmt, 2, g_ascii_strtoull (date, NULL, 10));

  if (!exception_type) {
    g_warning ("Missing exception_type in calendar_dates");
    return FALSE;
  }

  sqlite3_bind_int (p_stmt, 3, g_ascii_strtoull (exception_type, NULL, 10));

  return TRUE;
}


static gboolean
process_entry (MapsGTFS *gtfs, FileType file_type, GHashTable *entry,
               sqlite3_stmt *p_stmt)
{
  switch (file_type) {
  case AGENCY:         return process_agency (gtfs, entry, p_stmt);
  case STOPS:          return process_stop (entry, p_stmt);
  case ROUTES:         return process_route (entry, p_stmt);
  case TRIPS:          return process_trip (entry, p_stmt);
  case STOP_TIMES:     return process_stop_time (entry, p_stmt);
  case CALENDAR:       return process_calendar (entry, p_stmt);
  case CALENDAR_DATES: return process_calendar_date (entry, p_stmt);
  default:     return TRUE; /* this shouldn't happen */
  }
}

static gboolean
parse_file (MapsGTFS *gtfs, struct archive *a, FileType file_type,
            const gchar *filename)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  g_autofree gchar *header;
  g_auto(GStrv) header_fields = NULL;
  g_autoptr(GHashTable) fields =
      g_hash_table_new_full (g_str_hash, g_str_equal, NULL, g_free);
  gint num_fields;
  gchar *insert_sql;
  sqlite3_stmt *p_stmt;

  reset_read_buffer (gtfs);
  header = read_line (gtfs, a);

  if (!header) {
    g_error ("Failed to read header in %s", filename);
    return FALSE;
  }

  g_debug ("Header for %s: %s", filename, header);

  switch (file_type) {
  case AGENCY:
    header_fields = parse_header (filename, header, "agency_id", FALSE,
                                  "agency_name", TRUE, "agency_url", TRUE,
                                  "agency_timezone", TRUE, "agency_lang", FALSE,
                                  "agency_phone", FALSE,
                                  "agency_fare_url", FALSE,
                                  "agency_email", FALSE, NULL);
    insert_sql = "INSERT INTO agency VALUES (?,?,?,?,?,?,?,?)";
    break;
  case STOPS:
    header_fields = parse_header (filename, header, "stop_id", TRUE,
                                  "stop_code", FALSE, "stop_name", FALSE,
                                  "stop_desc", FALSE, "stop_lat", FALSE,
                                  "stop_lon", FALSE, "zone_id", FALSE,
                                  "stop_url", FALSE, "location_type", FALSE,
                                  "parent_station", FALSE, "stop_timezone", FALSE,
                                  "wheelchair_boarding", FALSE, "level_id", FALSE,
                                  "platform_code", FALSE, NULL);
    insert_sql = "INSERT INTO stops VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    break;
  case ROUTES:
    header_fields = parse_header (filename, header, "route_id", TRUE,
                                  "agency_id", FALSE, "route_short_name", FALSE,
                                  "route_long_name", FALSE, "route_desc", FALSE,
                                  "route_type", TRUE, "route_url", FALSE,
                                  "route_color", FALSE,
                                  "route_text_color", FALSE,
                                  "route_sort_order", FALSE, NULL);
    insert_sql = "INSERT INTO routes VALUES (?,?,?,?,?,?,?,?,?,?)";
    break;
  case TRIPS:
    header_fields = parse_header (filename, header, "route_id", TRUE,
                                  "service_id", TRUE, "trip_id", TRUE,
                                  "trip_headsign", FALSE,
                                  "trip_short_name", FALSE,
                                  "direction_id", FALSE, "block_id", FALSE,
                                  "shape_id", FALSE,
                                  "wheelchair_accesibility", FALSE,
                                  "bikes_allowed", FALSE, NULL);
    insert_sql = "INSERT INTO trips VALUES (?,?,?,?,?,?,?,?,?,?)";
    break;
  case STOP_TIMES:
    header_fields = parse_header (filename, header, "trip_id", TRUE,
                                  "arrival_time", FALSE, "departure_time", FALSE,
                                  "stop_id", TRUE, "stop_sequence", TRUE,
                                  "stop_headsign", FALSE, "pickup_type", FALSE,
                                  "drop_off_type", FALSE,
                                  "shape_dist_travelled", FALSE,
                                  "timepoint", FALSE, NULL);
    insert_sql = "INSERT INTO stop_times VALUES (?,?,?,?,?,?,?,?,?,?)";
    break;
  case CALENDAR:
    header_fields = parse_header (filename, header, "service_id", TRUE,
                                  "monday", TRUE, "tuesday", TRUE,
                                  "wednesday", TRUE, "thursday", TRUE,
                                  "friday", TRUE, "saturday", TRUE,
                                  "sunday", TRUE, "start_date", TRUE,
                                  "end_date", TRUE, NULL);
    insert_sql = "INSERT INTO calendar VALUES (?,?,?,?,?,?,?,?,?,?)";
    break;
  case CALENDAR_DATES:
    header_fields = parse_header (filename, header, "service_id", TRUE,
                                  "date", TRUE, "exception_type", TRUE, NULL);
    insert_sql = "INSERT INTO calendar_dates VALUES (?,?,?)";
    break;
  default:
    // skip other files for now
    return TRUE;
    break;
  }

  num_fields = g_strv_length (header_fields);

  if (sqlite3_prepare_v2 (priv->db, insert_sql, -1, &p_stmt, NULL) != SQLITE_OK) {
    g_warning ("Failed to create prepared statement: %s", insert_sql);
    sqlite3_finalize (p_stmt);
    return FALSE;
  }

  if (priv->db_needs_commit)
    sqlite3_exec (priv->db, "BEGIN", NULL, NULL, NULL);

  for (;;) {
    g_autofree gchar *line = read_line (gtfs, a);

    if (!line)
      break;

    if (!parse_line (line, header_fields, num_fields, fields)) {
      g_warning ("Failed to parse line in %s: %s", filename, line);
      return FALSE;
    }

    if (!process_entry (gtfs, file_type, fields, p_stmt)) {
      g_error ("Failed to parse entry in %s: %s", filename, line);
      return FALSE;
    }

    sqlite3_step (p_stmt);
    if (sqlite3_reset (p_stmt) != SQLITE_OK) {
      g_warning ("Failed to insert record in %s: %s", filename,
                 sqlite3_errmsg (priv->db));
      return FALSE;
    }
  }

  sqlite3_finalize (p_stmt);

  if (priv->db_needs_commit)
    sqlite3_exec (priv->db, "COMMIT", NULL, NULL, NULL);

  return TRUE;
}

static gboolean
parse_entries (MapsGTFS *gtfs, struct archive *a)
{
  struct archive_entry *entry;
  gboolean found_agency = FALSE;
  gboolean found_stops = FALSE;
  gboolean found_routes = FALSE;
  gboolean found_trips = FALSE;
  gboolean found_stop_times = FALSE;

  while (archive_read_next_header(a, &entry) == ARCHIVE_OK) {
    const char *filename = archive_entry_pathname (entry);
    FileType file_type;

    g_debug ("Entry %s", archive_entry_pathname(entry));

    if (g_str_equal (filename, "agency.txt")) {
      file_type = AGENCY;
      found_agency = TRUE;
    } else if (g_str_equal (filename, "stops.txt")) {
      file_type = STOPS;
      found_stops = TRUE;
    } else if (g_str_equal (filename, "routes.txt")) {
      file_type = ROUTES;
      found_routes = TRUE;
    } else if (g_str_equal (filename, "trips.txt")) {
      file_type = TRIPS;
      found_trips = TRUE;
    } else if (g_str_equal (filename, "stop_times.txt")) {
      file_type = STOP_TIMES;
      found_stop_times = TRUE;
    } else if (g_str_equal (filename, "calendar.txt")) {
      file_type = CALENDAR;
    } else if (g_str_equal (filename, "calendar_dates.txt")) {
      file_type = CALENDAR_DATES;
    } else if (g_str_equal (filename, "fare_attributes.txt")) {
      file_type = FARE_ATTRIBUTES;
    } else if (g_str_equal (filename, "fare_rules.txt")) {
      file_type = FARE_RULES;
    } else if (g_str_equal (filename, "shapes.txt")) {
      file_type = SHAPES;
    } else if (g_str_equal (filename, "frequencies.txt")) {
      file_type = FREQUENCIES;
    } else if (g_str_equal (filename, "transfers.txt")) {
      file_type = TRANSFERS;
    } else if (g_str_equal (filename, "pathways.txt")) {
      file_type = PATHWAYS;
    } else if (g_str_equal (filename, "levels.txt")) {
      file_type = LEVELS;
    } else if (g_str_equal (filename, "feed_info.txt")) {
      file_type = FEED_INFO;
    } else if (g_str_equal (filename, "translations.txt")) {
      file_type = TRANSLATIONS;
    } else if (g_str_equal (filename, "attributions.txt")) {
      file_type = ATTRIBUTIONS;
    } else {
      g_warning ("Unrecognized file: %s", filename);
      continue;
    }

    if (!parse_file (gtfs, a, file_type, filename))
        return FALSE;

    archive_read_data_skip (a);
  }

  if (found_agency && found_stops && found_routes && found_trips && found_stop_times)
    return TRUE;
  else
    return FALSE;
}

static void
create_tables (MapsGTFS *gtfs)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  gchar *create_table_defs[N_TABLES] =
    { CREATE_TABLE_AGENCY, CREATE_TABLE_STOPS, CREATE_TABLE_ROUTES,
      CREATE_TABLE_TRIPS, CREATE_TABLE_STOP_TIMES, CREATE_TABLE_CALENDAR,
      CREATE_TABLE_CALENDAR_DATES, CREATE_TABLE_SHAPES, CREATE_TABLE_FREQUENCIES,
      CREATE_TABLE_TRANSFERS };

  // reset db
  sqlite3_db_config (priv->db, SQLITE_DBCONFIG_RESET_DATABASE, 1, 0);
  sqlite3_exec (priv->db, "VACUUM", NULL, NULL, NULL);
  sqlite3_db_config (priv->db, SQLITE_DBCONFIG_RESET_DATABASE, 0, 0);

  for (gint i = 0; i < N_TABLES; i++) {
    sqlite3_exec (priv->db, create_table_defs[i], NULL, NULL, NULL);
  }
}

static void
create_indices (MapsGTFS *gtfs)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  gchar *create_index_defs[N_INDICES] =
    { CREATE_INDEX_STOPS_STOP_ID, CREATE_INDEX_TRIPS_TRIP_ID,
      CREATE_INDEX_ROUTES_ROUTE_ID, CREATE_INDEX_STOP_TIMES_STOP_ID };

  for (gint i = 0; i < N_INDICES; i++) {
    sqlite3_exec (priv->db, create_index_defs[i], NULL, NULL, NULL);
  }
}

static void
parse_thread (GTask *task, gpointer source_object, gpointer task_data,
              GCancellable *cancellable)
{
  MapsGTFS *gtfs = source_object;
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  struct archive *a;
  int r;
  GError *error = NULL;

  a = archive_read_new ();
  archive_read_support_format_zip (a);
  r = archive_read_open_filename (a, priv->file, BLOCK_SIZE);

  if (r != ARCHIVE_OK) {
    error = g_error_new_literal (MAPS_GTFS_ERROR, 0,
                                 _("Failed to open GTFS ZIP file"));
    g_task_return_error (task, error);
  }

  create_tables (gtfs);
  create_indices (gtfs);
  maps_gtfs_db_funcs_init (priv->db);

  if (!parse_entries (gtfs, a)) {
    error = g_error_new_literal (MAPS_GTFS_ERROR, 0,
                                 _("Failed to parse GTFS file"));
    g_task_return_error (task, error);
  }

  r = archive_read_free(a);
  if (r != ARCHIVE_OK) {
    error = g_error_new_literal (MAPS_GTFS_ERROR, 0,
                                  _("Failed to free GTFS ZIP file"));
    g_task_return_error (task, error);
  }

  g_task_return_boolean (task, TRUE);
}

void
maps_gtfs_parse (MapsGTFS *gtfs, GAsyncReadyCallback callback)
{
  GTask *task = g_task_new (gtfs, NULL, callback, NULL);

  g_task_run_in_thread (task, parse_thread);
  g_object_unref (task);
}

static GList *
get_stops_from_result (MapsGTFS *gtfs, sqlite3_stmt *p_stmt)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  GList *result = NULL;
  gboolean done = FALSE;

  while (!done) {
    gint rc = sqlite3_step (p_stmt);
    const gchar *id;
    MapsGTFSStop *stop;

    switch (rc) {
    case SQLITE_ROW:
      id = sqlite3_column_text (p_stmt, 0);
      stop = g_hash_table_lookup (priv->stops, id);

      if (stop == NULL) {
        const gchar *code = sqlite3_column_text (p_stmt, 1);
        const gchar *name = sqlite3_column_text (p_stmt, 2);
        const gchar *desc = sqlite3_column_text (p_stmt, 3);
        gfloat lat = sqlite3_column_double (p_stmt, 4);
        gfloat lon = sqlite3_column_double (p_stmt, 5);
        gint location_type = sqlite3_column_int (p_stmt, 6);
        const gchar *timezone = sqlite3_column_text (p_stmt, 7);

        stop = maps_gtfs_stop_new (id, code, name, desc, lat, lon,
                                   location_type, NULL,
                                   timezone ? g_time_zone_new (timezone) : NULL);
        g_hash_table_insert (priv->stops, g_strdup (id), stop);
      }

      result = g_list_append (result, stop);
      break;
    case SQLITE_DONE:
      done = TRUE;
      break;
    default:
      g_warning ("Error looking up stops: %s", sqlite3_errmsg (priv->db));
      sqlite3_finalize (p_stmt);
      g_list_free (result);
      return NULL;
    }
  }

  return result;
}

/**
 * maps_gtfs_get_nearby_stops:
 * @gtfs: A #MapsGTFS object
 * @lat:  Latitude of center point of search circle
 * @lon:  Longitude of center point of search circle
 * @distance: Radius of search circle
 *
 * Returns: (element-type MapsGTFSStop) (transfer container): a list of #GTFSStop
 */
GList *
maps_gtfs_get_nearby_stops (MapsGTFS *gtfs, gfloat lat, gfloat lon,
                            gfloat distance)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  const gchar *sql = "SELECT stop_id, stop_code, stop_name, stop_desc, "
                            "stop_lat, stop_lon, location_type, stop_timezone, "
                            "DISTANCE(stop_lat, stop_lon, ?, ?) d "
                     "FROM stops "
                     "WHERE d <= ? AND location_type in (0,1) "
                     "ORDER BY d";
  sqlite3_stmt *p_stmt;
  GList *result;

  if (sqlite3_prepare_v2 (priv->db, sql, -1, &p_stmt, NULL) != SQLITE_OK) {
    g_warning ("Failed to create prepared statement: %s", sql);
    sqlite3_finalize (p_stmt);
    return NULL;
  }

  sqlite3_bind_double (p_stmt, 1, lat);
  sqlite3_bind_double (p_stmt, 2, lon);
  sqlite3_bind_double (p_stmt, 3, distance);

  result = get_stops_from_result (gtfs, p_stmt);
  sqlite3_finalize (p_stmt);

  return result;
}

/**
 * maps_gtfs_get_nearby_stops_with_route_types:
 * @gtfs: A #MapsGTFS object
 * @lat:  Latitude of center point of search circle
 * @lon:  Longitude of center point of search circle
 * @distance: Radius of search circle
 * @types: (array length=num_types): Types to include (values >= 100 is
 *                                   interpreted as extended types covering
 *                                   a range of 100 subtypes)
 * @num_types: (skip)
 *
 * Returns: (element-type MapsGTFSStop) (transfer container): a list of #GTFSStop
 */
GList *
maps_gtfs_get_nearby_stops_with_route_types (MapsGTFS *gtfs, gfloat lat, gfloat lon,
                                             gfloat distance, guint *types,
                                             guint num_types)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  g_autofree gchar *sql_str;
  GString *sql = g_string_new ("SELECT s.stop_id, s.stop_code, s.stop_name, "
                                      "s.stop_desc, s.stop_lat, s.stop_lon, "
                                      "s.location_type, s.stop_timezone, "
                                      "DISTANCE(s.stop_lat, s.stop_lon, ?, ?) d "
                               "FROM stops s JOIN stop_times st USING (stop_id) "
                                            "JOIN trips t USING (trip_id) "
                                            "JOIN routes r USING (route_id) "
                               "WHERE d <= ? AND location_type in (0,1) "
                                            "AND (");
  guint j = 1;
  sqlite3_stmt *p_stmt;
  GList *result;

  for (guint i = 0; i < num_types; i++) {
    if (types[i] < 100)
      g_string_append (sql, "r.route_type = ?");
    else
      g_string_append (sql, "r.route_type BETWEEN ? AND ?");
    if (i < num_types - 1)
      g_string_append (sql, " OR ");
  }

  g_string_append (sql, ") GROUP BY s.stop_id ORDER BY d");
  sql_str = g_string_free (sql, FALSE);

  if (sqlite3_prepare_v2 (priv->db, sql_str, -1, &p_stmt, NULL) != SQLITE_OK) {
    g_warning ("Failed to create prepared statement: %s", sql_str);
    sqlite3_finalize (p_stmt);
    return NULL;
  }

  sqlite3_bind_double (p_stmt, j++, lat);
  sqlite3_bind_double (p_stmt, j++, lon);
  sqlite3_bind_double (p_stmt, j++, distance);

  for (guint i = 0; i < num_types; i++) {
    if (types[i] < 100) {
      sqlite3_bind_int (p_stmt, j++, types[i]);
    } else {
      sqlite3_bind_int (p_stmt, j++, types[i]);
      sqlite3_bind_int (p_stmt, j++, types[i] + 99);
    }
  }

  result = get_stops_from_result (gtfs, p_stmt);
  sqlite3_finalize (p_stmt);

  return result;
}
