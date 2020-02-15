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
#include "mapsintl.h"

#include <archive.h>
#include <archive_entry.h>
#include <glib.h>

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
};

enum {
  PROP_0,
};

G_DEFINE_TYPE_WITH_PRIVATE (MapsGTFS, maps_gtfs, G_TYPE_OBJECT)

static void
maps_gtfs_dispose (GObject *object)
{
  MapsGTFS *gtfs = MAPS_GTFS (object);
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  g_free (priv->file);
  priv->file = NULL;
  g_free (priv->read_buffer);
  priv->read_buffer = NULL;

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
}

MapsGTFS *
maps_gtfs_new (char *file)
{
  MapsGTFS *gtfs = g_object_new (MAPS_TYPE_GTFS, NULL);
  MapsGTFSPrivate *priv = maps_gtfs_get_instance_private (gtfs);

  priv->file = g_strdup (file);
  return gtfs;
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

static gboolean
parse_file (MapsGTFS *gtfs, struct archive *a, const gchar *filename)
{
  for (;;) {
    g_autofree gchar *line = read_line (gtfs, a);
    if (!line)
      break;
    g_debug ("Line: %s", line);
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

    g_debug ("Entry %s", archive_entry_pathname(entry));

    if (g_str_equal (filename, "agency.txt")) {
      found_agency = TRUE;
    } else if (g_str_equal (filename, "stops.txt")) {
      found_stops = TRUE;
    } else if (g_str_equal (filename, "routes.txt")) {
      found_routes = TRUE;
    } else if (g_str_equal (filename, "trips.txt")) {
      found_trips = TRUE;
    } else if (g_str_equal (filename, "stop_times.txt")) {
      found_stop_times = TRUE;
    }

    if (g_str_equal (filename, "routes.txt"))
      if (!parse_file (gtfs, a, filename))
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
