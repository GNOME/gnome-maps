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
#include "mapsintl.h"

#include <archive.h>
#include <archive_entry.h>
#include <glib.h>
#include <string.h>

#define MAPS_GTFS_ERROR maps_gtfs_error_quark ()

static const int BLOCK_SIZE = 10 * 1024;

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
  g_clear_pointer (&priv->timezone, g_time_zone_unref);

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
  gtfs->priv = maps_gtfs_get_instance_private (gtfs);
  gtfs->priv->file = NULL;
  gtfs->priv->read_buffer = g_malloc (BLOCK_SIZE);
  /* indicate we need to read a new chunk of data when reading the first line */
  gtfs->priv->read_pos = 0;
  gtfs->priv->read_size = 0;
  gtfs->priv->agencies =
    g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_object_unref);
}

MapsGTFS *
maps_gtfs_new (char *file)
{
  MapsGTFS *gtfs = g_object_new (MAPS_TYPE_GTFS, NULL);
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  priv->file = g_strdup (file);
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
    g_debug ("Read new chunk");
    priv->read_size = archive_read_data (a, priv->read_buffer, BLOCK_SIZE);
    priv->read_pos = 0;

    if (priv->read_size < 0) {
      g_error ("Failed to read data");
      return NULL;
    } else if (priv->read_size == 0) {
      g_debug ("No more data to read");
      return NULL;
    }
  }

  g_debug ("Read pos at start: %d", priv->read_pos);

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
    while (priv->read_buffer[priv->read_pos] == '\n' ||
           priv->read_buffer[priv->read_pos] == '\r') {
      priv->read_pos++;
    }
  } else {
    /* copy the first part up to the buffer end */
    g_autofree gchar *first =
      g_strndup (priv->read_buffer + priv->read_pos, i - priv->read_pos);

    /* read next chunk */
    g_debug ("Read next chunk");
    priv->read_size = archive_read_data (a, priv->read_buffer, BLOCK_SIZE);
    priv->read_pos = 0;

    if (priv->read_size < 0) {
      g_error ("Failed to read data");
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

    g_debug ("Found next line break at position: %d", i);

    /* copy next part, read from new buffer */
    g_autofree gchar *second = g_strndup (priv->read_buffer, i);

    /* skip upcoming newline(s) */
    while (priv->read_buffer[priv->read_pos] == '\n' ||
           priv->read_buffer[priv->read_pos] == '\r') {
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

static GHashTable *
parse_line (const gchar *line, gchar **header_fields, gint num_fields)
{
  gchar **fields = NULL;
  gboolean in_quotes = FALSE;
  gboolean escape = FALSE;

  if (line[0] == '\0')
    return NULL;

  if (g_strstr_len (line, -1, "\"")) {
    // if the input line contains no quoted strings, just do a simple split
    fields = g_strsplit (line, ",", -1);
  } else {
    g_autofree gchar *field = g_malloc0 (strlen (line) + 1);
    gint index = 0;
    gint j = 0;

    fields = g_malloc0_n (num_fields + 1, sizeof (gchar *));
    for (gint i = 0; line[i]; i++) {
      gchar c = line[i];

      if (index >= num_fields) {
        g_error ("Too many fields read");
        g_strfreev (fields);
        return NULL;
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
        for (gint k = 0; k <= num_fields; k++)
          field[k] = '\0';
        index++;
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
    g_strfreev (fields);
    return NULL;
  } else {
    GHashTable *result =
      g_hash_table_new_full (g_str_hash, g_str_equal, NULL, g_free);

    for (gint i = 0; i < num_fields; i++) {
      g_hash_table_insert (result, header_fields[i], fields[i]);
    }
    return result;
  }
}

static gboolean
process_agency (MapsGTFS *gtfs, GHashTable *entry)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  MapsGTFSAgency *agency;
  GTimeZone *tz;

  gchar *id = g_hash_table_lookup (entry, "agency_id");
  gchar *name = g_hash_table_lookup (entry, "agency_name");
  gchar *url = g_hash_table_lookup (entry, "agency_name");
  gchar *timezone = g_hash_table_lookup (entry, "agency_timezone");
  gchar *lang = g_hash_table_lookup (entry, "agency_lang");
  gchar *phone = g_hash_table_lookup (entry, "agency_phone");
  gchar *fare_url = g_hash_table_lookup (entry, "agency_fare_url");
  gchar *email = g_hash_table_lookup (entry, "agency_email");

  /* agency_id is required if there's more than one agency */
  if (!id && g_hash_table_size (priv->agencies) > 0) {
    g_error ("Field agency_id is required when there's more than one agency");
    return FALSE;
  }

  tz = g_time_zone_new (timezone);

  if (!priv->timezone) {
    priv->timezone = tz;
  } else if (!g_str_equal (g_time_zone_get_identifier (tz),
                           g_time_zone_get_identifier (priv->timezone))) {
    g_error ("All agencies in the feed must use the timezone");
    g_time_zone_unref (tz);
    return FALSE;
  }

  agency =
    maps_gtfs_agency_new (id, name, url, tz, lang, phone, fare_url, email);
  g_hash_table_insert (priv->agencies, g_strdup (id), agency);

  return TRUE;
}

static gboolean
process_stop (MapsGTFS *gtfs, GHashTable *entry)
{

  return TRUE;
}

static gboolean
process_entry (MapsGTFS *gtfs, FileType file_type, GHashTable *entry)
{
  switch (file_type) {
  case AGENCY: return process_agency (gtfs, entry);
  case STOPS:  return process_stop (gtfs, entry);
  default:     return TRUE; /* this shouldn't happen */
  }
}

static gboolean
parse_file (MapsGTFS *gtfs, struct archive *a, FileType file_type,
            const gchar *filename)
{
  g_autofree gchar *header;
  g_auto(GStrv) header_fields = NULL;
  gint num_fields;

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
    break;
  default:
    // skip other files for now
    return TRUE;
    break;
  }

  num_fields = g_strv_length (header_fields);

  for (;;) {
    g_autofree gchar *line = read_line (gtfs, a);
    g_autoptr(GHashTable) fields = NULL;
    if (!line)
      break;
    g_debug ("Line: %s", line);
    fields = parse_line (line, header_fields, num_fields);
    if (!process_entry (gtfs, file_type, fields)) {
      g_error ("Failed to parse entry in %s: %s", filename, line);
      return FALSE;
    }
  }

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

void
maps_gtfs_parse (MapsGTFS *gtfs, GError **error)
{
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);
  struct archive *a;
  int r;

  a = archive_read_new ();
  archive_read_support_format_zip (a);
  r = archive_read_open_filename (a, priv->file, BLOCK_SIZE);

  if (r != ARCHIVE_OK)
    {
      *error = g_error_new_literal (MAPS_GTFS_ERROR, 0,
                                    _("Failed to open GTFS ZIP file"));
      return;
    }

  if (!parse_entries (gtfs, a)) {
    *error = g_error_new_literal (MAPS_GTFS_ERROR, 0,
                                  _("Failed to parse GTFS file"));
    return;
  }

  r = archive_read_free(a);
  if (r != ARCHIVE_OK)
    *error = g_error_new_literal (MAPS_GTFS_ERROR, 0,
                                  _("Failed to free GTFS ZIP file"));

}
